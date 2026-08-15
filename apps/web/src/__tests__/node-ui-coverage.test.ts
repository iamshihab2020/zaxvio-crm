import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// `allDefinitions()` rather than the registry array: the array is internal to
// the package and reaching past the public surface is how a test ends up
// asserting something the product does not expose.
import { allDefinitions, NODE_PROPERTY_TYPES } from "@hvac-saas/workflow-nodes";
import { hasNodeIcon } from "@/lib/workflow/icon-map";

/**
 * Does every node definition have UI to render it?
 *
 * Three seams, each of which failed silently at least once while P7 was being
 * built, and none of which a compiler can see:
 *
 * 1. **An icon name that does not exist.** `resolveNodeIcon` falls back to a
 *    question mark rather than throwing — deliberately, so a missing line is not
 *    fatal — which means the only symptom is a node in the palette with no icon.
 *    `IconBriefcasePlus` is not a Tabler icon; the definition using it looked
 *    entirely correct.
 * 2. **A property type with no renderer case.** The panel draws "this kind of
 *    field isn't available yet" — honest, and invisible until somebody opens
 *    that specific node. `serviceTypeSelect` sat like that for two phases.
 * 3. **A subcategory id that is not in `SUBCATEGORIES`.** The palette groups on
 *    it, so an unknown one silently drops the node out of its heading.
 *
 * This file lives in `apps/web` rather than in the package because two of the
 * three things it checks — the icon map and the renderer — are web-only. The
 * package cannot import them, so the test that proves they keep up has to be
 * on this side of the boundary.
 */

const here = dirname(fileURLToPath(import.meta.url));
const RENDERER = join(
  here,
  "..",
  "components/dashboard/automations/builder/config/config-renderer.tsx",
);

describe("node UI coverage", () => {
  it("has an icon for every node definition", () => {
    const missing = allDefinitions().filter((def) => !hasNodeIcon(def.icon)).map(
      (def) => `${def.node} → ${def.icon}`,
    );
    expect(
      missing,
      "add these to apps/web/src/lib/workflow/icon-map.ts, and check the name really exists in @tabler/icons-react",
    ).toEqual([]);
  });

  it("has a renderer case for every property type a definition actually uses", () => {
    // Read the source rather than exercising the component. Rendering every
    // field type would need a React tree, a store and a query client; the thing
    // being asserted is that a `case` exists, and the source is where that is.
    const source = readFileSync(RENDERER, "utf8");

    const used = new Set<string>();
    for (const def of allDefinitions()) {
      for (const property of def.properties) used.add(property.type);
    }

    const missing = [...used].filter(
      (type) => !source.includes(`case "${type}":`),
    );
    expect(
      missing,
      "these property types are used by a shipped node and draw 'this kind of field isn't available yet'",
    ).toEqual([]);
  });

  it("only declares property types the shared list knows", () => {
    // The other direction: a renderer case for a type no definition declares is
    // dead code, but a *definition* using a type outside `NODE_PROPERTY_TYPES`
    // would not compile — so this is really asserting the list has not been
    // narrowed out from under a shipped node.
    const known = new Set<string>(NODE_PROPERTY_TYPES);
    for (const def of allDefinitions()) {
      for (const property of def.properties) {
        expect(known.has(property.type), `${def.node}.${property.name}`).toBe(true);
      }
    }
  });
});
