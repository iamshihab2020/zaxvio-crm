import type { Icon } from "@tabler/icons-react";
import {
  IconBell,
  IconCircleCheck,
  IconCoin,
  IconMail,
  IconNote,
  IconPlayerPlay,
  IconPlayerStop,
  IconQuestionMark,
  IconArrowRight,
  IconUser,
  IconArrowsSplit,
  IconArrowMerge,
  IconClock,
} from "@tabler/icons-react";

/**
 * Node icon name → component. **Curated and explicit. Never a wildcard import.**
 *
 * Node definitions reference their icon by *name string*, because the registry
 * is a plain data package that the API imports too and cannot hold React
 * components. Something has to resolve the string, and the obvious shortcut —
 *
 *     import * as Icons from "@tabler/icons-react";   // ← never do this
 *
 * — pulls several thousand components into the module graph and runs the Next
 * build out of memory during "Collecting page data". That is a failure that
 * only appears in a hosted build, which is the worst place to find it: this repo
 * has already had three consecutive `main` deploys fail, each hiding the next.
 *
 * The cost of the explicit map is one line per icon, added in the same commit as
 * the node that needs it. `resolveNodeIcon` falls back rather than throwing, so
 * forgetting the line renders a question mark instead of crashing the builder —
 * visible, and not fatal.
 */

const ICONS: Record<string, Icon> = {
  IconBell,
  IconCircleCheck,
  IconCoin,
  IconMail,
  IconNote,
  IconPlayerPlay,
  IconPlayerStop,
  IconArrowRight,
  IconUser,
  IconArrowsSplit,
  IconArrowMerge,
  IconClock,
};

/** Every icon named by a definition currently in the registry. */
export function resolveNodeIcon(name: string): Icon {
  return ICONS[name] ?? IconQuestionMark;
}

/** True when a definition names an icon nobody has added here yet. */
export function hasNodeIcon(name: string): boolean {
  return name in ICONS;
}
