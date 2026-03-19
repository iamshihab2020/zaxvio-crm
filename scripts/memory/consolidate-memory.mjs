#!/usr/bin/env node

/**
 * Claude Code Memory Consolidation Script
 *
 * Zero-dependency Node.js ESM script that parses JSONL conversation logs
 * and generates structured memory files for Claude Code context loading.
 *
 * Usage:
 *   node scripts/memory/consolidate-memory.mjs [--hours=24] [--dry-run]
 *
 * Outputs (in scripts/memory/):
 *   recent-memory.md      — Rolling 48hr session summaries
 *   long-term-memory.md   — Stable facts, preferences, architecture decisions
 *   project-memory.md     — Active project snapshot (branch, tasks, progress)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve, basename, dirname } from "path";
import { execSync } from "child_process";
import { homedir } from "os";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const hoursArg = args.find((a) => a.startsWith("--hours="));
const HOURS = hoursArg ? parseInt(hoursArg.split("=")[1], 10) : 24;
const DRY_RUN = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const SCRIPT_DIR = decodeURIComponent(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")));
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const MEMORY_DIR = SCRIPT_DIR;
const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

const LESSONS_PATH = join(REPO_ROOT, "docs", "lessons.md");
const TODO_PATH = join(REPO_ROOT, "docs", "todo.md");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readFileOr(path, fallback = "") {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return fallback;
  }
}

function gitCmd(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", timeout: 10000 }).trim();
  } catch {
    return "";
  }
}

function isRecent(filePath, cutoffMs) {
  try {
    const stat = statSync(filePath);
    return stat.mtimeMs >= cutoffMs;
  } catch {
    return false;
  }
}

/**
 * Derive the Claude Code project hash from the repo root path.
 * Claude stores per-project data at ~/.claude/projects/<project-hash>/
 * where <project-hash> is the absolute path with separators replaced by "--".
 */
function getProjectHash() {
  const normalized = REPO_ROOT.replace(/\\/g, "/").replace(/\/$/, "");
  // e.g. "C:/Users/Victus/OneDrive/Documents/HVAC Software/Code/zaxvio-crm"
  // →    "C--Users-Victus-OneDrive-Documents-HVAC-Software-Code-zaxvio-crm"
  return normalized
    .replace(/^([A-Z]):/, "$1-") // drive colon becomes dash (C: → C-)
    .replace(/[/\\ ]/g, "-");   // replace separators and spaces with dashes
}

/**
 * Find JSONL conversation files for THIS project modified within the time window.
 * Only scans the project-specific directory, not all projects.
 */
function findRecentJsonlFiles(cutoffMs) {
  const files = [];
  const projectHash = getProjectHash();
  const projectPath = join(CLAUDE_PROJECTS_DIR, projectHash);

  console.log(`[memory] Project hash: ${projectHash}`);

  if (!existsSync(projectPath)) {
    console.log(`[memory] Project directory not found: ${projectPath}`);
    return files;
  }

  for (const file of readdirSync(projectPath)) {
    if (!file.endsWith(".jsonl")) continue;
    const filePath = join(projectPath, file);
    if (isRecent(filePath, cutoffMs)) {
      files.push(filePath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// JSONL Parsing
// ---------------------------------------------------------------------------

/** Correction-detection heuristics */
const CORRECTION_PATTERNS = [
  /\bno[,.]?\s/i,
  /\bwrong\b/i,
  /\bactually\b/i,
  /\binstead\b/i,
  /\bwhy not\b/i,
  /\bdon't\b/i,
  /\bshouldn't\b/i,
  /\bnever\b/i,
  /\bstop\b/i,
  /\bfix\b/i,
  /\bwhat I (said|meant|asked)\b/i,
];

function looksLikeCorrection(text) {
  if (!text || text.length > 500) return false; // long messages are unlikely corrections
  return CORRECTION_PATTERNS.some((p) => p.test(text));
}

/**
 * Parse a single JSONL file and extract structured session data.
 */
function parseJsonlFile(filePath) {
  const content = readFileOr(filePath);
  if (!content) return null;

  const lines = content.split("\n").filter((l) => l.trim());
  const session = {
    file: basename(filePath),
    timestamp: null,
    userRequests: [],
    assistantSummaries: [],
    filesChanged: new Set(),
    corrections: [],
    decisions: [],
  };

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Extract timestamp from first entry
    if (!session.timestamp && entry.timestamp) {
      session.timestamp = entry.timestamp;
    }

    const role = entry.role || entry.type;
    const message = entry.message || entry;

    // User messages
    if (role === "human" || role === "user") {
      const text = extractText(message);
      if (text) {
        session.userRequests.push(text.slice(0, 300));
        if (looksLikeCorrection(text)) {
          session.corrections.push(text.slice(0, 200));
        }
      }
    }

    // Assistant messages — extract brief summaries
    if (role === "assistant") {
      const text = extractText(message);
      if (text && text.length > 20) {
        session.assistantSummaries.push(text.slice(0, 200));
      }
    }

    // Tool use — detect file changes
    if (role === "assistant") {
      extractFileChanges(message, session.filesChanged);
    }
  }

  if (session.userRequests.length === 0) return null;
  return session;
}

/** Extract plain text from a message (handles string, array of content blocks, etc.) */
function extractText(message) {
  if (typeof message === "string") return message.trim();

  if (message && typeof message === "object") {
    // Content array format
    if (Array.isArray(message.content)) {
      return message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text || "")
        .join(" ")
        .trim();
    }
    // Direct text field
    if (message.text) return message.text.trim();
    if (message.content && typeof message.content === "string") return message.content.trim();
  }

  return "";
}

/** Extract file paths from Write/Edit tool_use blocks */
function extractFileChanges(message, filesSet) {
  if (!message || typeof message !== "object") return;

  const content = Array.isArray(message.content)
    ? message.content
    : Array.isArray(message)
      ? message
      : [];

  for (const block of content) {
    if (block.type === "tool_use" || block.type === "tool_call") {
      const name = block.name || block.tool || "";
      const input = block.input || block.arguments || {};

      if (
        (name === "Write" || name === "Edit" || name === "NotebookEdit") &&
        input.file_path
      ) {
        // Normalize to relative path
        const fp = input.file_path.replace(/\\/g, "/");
        const repoNorm = REPO_ROOT.replace(/\\/g, "/");
        const rel = fp.startsWith(repoNorm) ? fp.slice(repoNorm.length + 1) : fp;
        filesSet.add(rel);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Memory File Generators
// ---------------------------------------------------------------------------

function generateRecentMemory(sessions) {
  const lines = [
    "# Recent Memory (Auto-Generated)",
    "",
    `> Last updated: ${new Date().toISOString()}`,
    `> Window: last ${HOURS} hours`,
    "",
  ];

  if (sessions.length === 0) {
    lines.push("No sessions found in the time window.");
    return lines.join("\n");
  }

  for (const s of sessions) {
    const ts = s.timestamp
      ? new Date(s.timestamp).toLocaleString()
      : "unknown";
    lines.push(`## Session: ${s.file}`);
    lines.push(`- **Time**: ${ts}`);

    if (s.userRequests.length > 0) {
      lines.push(`- **Requests** (${s.userRequests.length}):`);
      for (const r of s.userRequests.slice(0, 10)) {
        lines.push(`  - ${r.replace(/\n/g, " ").slice(0, 150)}`);
      }
    }

    if (s.filesChanged.size > 0) {
      lines.push(`- **Files changed** (${s.filesChanged.size}):`);
      for (const f of [...s.filesChanged].slice(0, 20)) {
        lines.push(`  - \`${f}\``);
      }
    }

    if (s.corrections.length > 0) {
      lines.push(`- **Corrections/Feedback**:`);
      for (const c of s.corrections) {
        lines.push(`  - ${c.replace(/\n/g, " ")}`);
      }
    }

    if (s.assistantSummaries.length > 0) {
      lines.push(`- **Key responses** (${Math.min(s.assistantSummaries.length, 5)}):`);
      for (const a of s.assistantSummaries.slice(0, 5)) {
        lines.push(`  - ${a.replace(/\n/g, " ").slice(0, 150)}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function generateLongTermMemory(sessions) {
  // Seed from existing lessons.md
  const lessons = readFileOr(LESSONS_PATH);
  const existingLtm = readFileOr(join(MEMORY_DIR, "long-term-memory.md"));

  const lines = [
    "# Long-Term Memory (Auto-Generated)",
    "",
    `> Last updated: ${new Date().toISOString()}`,
    "",
    "## User Preferences",
    "",
    "- Icon library: Tabler Icons (`@tabler/icons-react`), never lucide-react",
    "- Fonts: Space Grotesk (headings), DM Sans (body). Never Inter/Roboto/Arial",
    "- Colors: CSS variables only, never hardcoded hex/rgb/hsl",
    "- Component library: shadcn/ui (Radix + CVA + tailwind-merge)",
    "- Loading states: skeleton loaders, never spinners",
    "- Animations: CSS-only, no framer-motion",
    "- Use Popover over Select for inline table dropdowns (prevents layout shift)",
    "- All `.md` files except `CLAUDE.md` live in `docs/`",
    "- Component organization: entity components in `components/dashboard/<entity>/`, reusable in `components/dashboard/reusable/`",
    "- Never use `template.tsx` for route group layouts",
    "",
    "## Architecture Decisions",
    "",
    "- Auth: Better Auth (not Supabase Auth) with organization + admin plugins",
    "- ORM: Drizzle ORM (schema-as-code), not Prisma",
    "- DB: Supabase PostgreSQL 15, application-level tenant isolation (no RLS)",
    "- Monorepo: Turborepo + pnpm workspaces",
    "- Frontend: Next.js 14 App Router, server actions for all API calls",
    "- Backend: Fastify on port 4000",
    "- Billing: Lemon Squeezy (subscriptions + affiliate)",
    "- Email: Resend + React Email templates",
    "",
    "## Known Gotchas (from docs/lessons.md)",
    "",
  ];

  // Extract key gotchas from lessons.md
  if (lessons) {
    const gotchaLines = lessons
      .split("\n")
      .filter((l) => l.startsWith("- **"))
      .map((l) => l.slice(0, 200));
    for (const g of gotchaLines.slice(0, 30)) {
      lines.push(g);
    }
  }

  lines.push("");
  lines.push("## Project Milestones");
  lines.push("");
  lines.push("- [x] Auth system (Better Auth migration)");
  lines.push("- [x] Next.js 14 + Tailwind + shadcn/ui frontend");
  lines.push("- [x] Landing page");
  lines.push("- [x] Organization/Tenant creation flow (#1)");
  lines.push("- [x] Customer CRUD (#2)");
  lines.push("- [x] Customer Detail Page");
  lines.push("- [x] Service Catalog + Settings Pages (#3)");
  lines.push("- [ ] Job Management Kanban (#4) — next up");
  lines.push("- [ ] Invoicing (#5)");
  lines.push("- [ ] Quote Builder (#6)");
  lines.push("");

  // Append corrections from recent sessions
  const allCorrections = sessions.flatMap((s) => s.corrections);
  if (allCorrections.length > 0) {
    lines.push("## Recent Corrections (Review for Patterns)");
    lines.push("");
    for (const c of allCorrections.slice(0, 10)) {
      lines.push(`- ${c.replace(/\n/g, " ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateProjectMemory() {
  const todo = readFileOr(TODO_PATH);

  // Git state
  const branch = gitCmd("git rev-parse --abbrev-ref HEAD");
  const lastCommit = gitCmd('git log -1 --format="%h %s"');
  const lastCommitDate = gitCmd('git log -1 --format="%ci"');
  const status = gitCmd("git status --short");

  const lines = [
    "# Project Memory (Auto-Generated)",
    "",
    `> Last updated: ${new Date().toISOString()}`,
    "",
    "## Git State",
    "",
    `- **Branch**: \`${branch || "unknown"}\``,
    `- **Last commit**: ${lastCommit || "unknown"}`,
    `- **Last commit date**: ${lastCommitDate || "unknown"}`,
    `- **Working tree**: ${status ? "dirty" : "clean"}`,
  ];

  if (status) {
    lines.push("- **Changed files**:");
    for (const line of status.split("\n").slice(0, 10)) {
      lines.push(`  - \`${line.trim()}\``);
    }
  }

  lines.push("");
  lines.push("## Current Task");
  lines.push("");

  // Extract "In Progress" and "Upcoming" from todo.md
  if (todo) {
    const inProgressMatch = todo.match(
      /## In Progress\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/
    );
    if (inProgressMatch) {
      const content = inProgressMatch[1].trim();
      lines.push(
        content === "(none)" ? "No task in progress." : `In progress: ${content.slice(0, 300)}`
      );
    } else {
      lines.push("No task in progress.");
    }

    lines.push("");

    const upcomingMatch = todo.match(
      /## Upcoming\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/
    );
    if (upcomingMatch) {
      lines.push("## Next Up");
      lines.push("");
      const upcoming = upcomingMatch[1].trim();
      for (const line of upcoming.split("\n").slice(0, 5)) {
        lines.push(line);
      }
    }
  } else {
    lines.push("Could not read docs/todo.md");
  }

  lines.push("");
  lines.push("## Build Order Progress");
  lines.push("");

  // Parse build order from todo.md
  if (todo) {
    const doneMatch = todo.match(/## Done\s*\n([\s\S]*?)$/);
    if (doneMatch) {
      const doneItems = doneMatch[1]
        .split("\n")
        .filter((l) => l.startsWith("- [x]"))
        .map((l) => l.match(/\*\*(.*?)\*\*/)?.[1] || l.slice(6))
        .slice(0, 15);

      lines.push(`Completed: ${doneItems.length} features`);
      for (const item of doneItems) {
        lines.push(`- [x] ${item}`);
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cutoffMs = Date.now() - HOURS * 60 * 60 * 1000;

  console.log(`[memory] Scanning for JSONL files modified in last ${HOURS} hours...`);
  console.log(`[memory] Claude projects dir: ${CLAUDE_PROJECTS_DIR}`);

  const jsonlFiles = findRecentJsonlFiles(cutoffMs);
  console.log(`[memory] Found ${jsonlFiles.length} recent JSONL file(s)`);

  const sessions = [];
  for (const file of jsonlFiles) {
    const session = parseJsonlFile(file);
    if (session) {
      sessions.push(session);
      console.log(
        `[memory]   ${session.file}: ${session.userRequests.length} requests, ${session.filesChanged.size} files changed, ${session.corrections.length} corrections`
      );
    }
  }

  // Sort sessions by timestamp (newest first)
  sessions.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  const recentMd = generateRecentMemory(sessions);
  const longTermMd = generateLongTermMemory(sessions);
  const projectMd = generateProjectMemory();

  if (DRY_RUN) {
    console.log("\n=== DRY RUN — would write: ===\n");
    console.log("--- recent-memory.md ---");
    console.log(recentMd.slice(0, 1000));
    console.log("\n--- long-term-memory.md ---");
    console.log(longTermMd.slice(0, 1000));
    console.log("\n--- project-memory.md ---");
    console.log(projectMd.slice(0, 1000));
    console.log("\n[memory] Dry run complete. No files written.");
    return;
  }

  writeFileSync(join(MEMORY_DIR, "recent-memory.md"), recentMd, "utf8");
  writeFileSync(join(MEMORY_DIR, "long-term-memory.md"), longTermMd, "utf8");
  writeFileSync(join(MEMORY_DIR, "project-memory.md"), projectMd, "utf8");

  console.log(`\n[memory] Written:`);
  console.log(`  ${join(MEMORY_DIR, "recent-memory.md")}`);
  console.log(`  ${join(MEMORY_DIR, "long-term-memory.md")}`);
  console.log(`  ${join(MEMORY_DIR, "project-memory.md")}`);
  console.log(`[memory] Done.`);
}

main();
