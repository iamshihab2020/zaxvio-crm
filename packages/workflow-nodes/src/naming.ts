/**
 * What counts as "you never named this".
 *
 * The builder opens on a placeholder name so nobody is asked to name a thing
 * they have not built yet — that is the least answerable question you can put
 * first, and it is why the create flow has no name dialog. Deferring the
 * question is only safe because something later insists on an answer; without
 * that, every workspace fills up with "Untitled automation".
 *
 * Publish is where it insists, not Save. A draft may be called anything — Save
 * must never refuse work — but the moment an automation is going to start
 * touching customers, someone has to be able to identify it in a list, a run
 * log and an alert email.
 *
 * Shared rather than duplicated so the toolbar's warning and the server's
 * refusal are the same rule. The server is the one that actually enforces it;
 * the client copy exists to say so before the user clicks.
 */

/** What a new automation is called before the user names it. */
export const DEFAULT_WORKFLOW_NAME = "Untitled automation";

/**
 * Placeholders, lower-cased. Includes the names other tools default to, because
 * an automation imported or copied from elsewhere arrives with theirs.
 */
const PLACEHOLDER_NAMES = new Set([
  "untitled automation",
  "untitled workflow",
  "untitled",
  "new automation",
  "new workflow",
  "automation",
  "workflow",
]);

/** Below this, a name cannot distinguish one automation from another. */
const MIN_MEANINGFUL_LENGTH = 3;

/**
 * True when this name identifies the automation to a person.
 *
 * Deliberately permissive beyond the placeholder list — this is a nudge, not a
 * style guide, and refusing a name someone chose on purpose is worse than
 * accepting a vague one.
 */
export function isNamedWorkflow(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < MIN_MEANINGFUL_LENGTH) return false;
  return !PLACEHOLDER_NAMES.has(trimmed.toLowerCase());
}
