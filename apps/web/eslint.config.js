/**
 * Flat config is resolved from the working directory, so every package needs a
 * file here even when it has nothing of its own to say. Re-export, never copy —
 * three divergent rule sets is how the same defect gets caught in one package
 * and shipped from another.
 *
 * The react-hooks rules live in the shared config, scoped to `**\/*.tsx`, rather
 * than being added here: `apps/api` renders React too (the PDF templates), so
 * "is this a React file" is a file-extension question, not a package question.
 */
export { default } from "@hvac-saas/config/eslint";
