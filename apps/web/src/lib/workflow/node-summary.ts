import {
  isPropertyVisible,
  VARIABLE_MAP,
  type NodeDefinition,
  type NodeProperty,
} from "@hvac-saas/workflow-nodes";

/**
 * One line describing what a step is actually set up to do.
 *
 * A node that says "Add a Note / Add a Note" tells you its type twice and its
 * configuration never — so a canvas of six steps is six identical cards and you
 * have to open each one to remember which is which. The summary is what makes
 * the graph readable without clicking through it.
 *
 * **Derived from the definition, not written per node.** The moment this needs
 * a `switch` on node type, adding a node stops being "a definition and an
 * executor" — which is the property the whole feature is built on.
 */

/**
 * Roughly what fits on the 170px caption at 10px before the ellipsis takes over.
 *
 * Shorter than it looks it should be, deliberately: the caption is centred under
 * a 92px tile, so a long line overhangs its neighbours on both sides and starts
 * reading as belonging to the wrong step.
 */
const MAX_LENGTH = 30;

export function summariseNode(
  def: NodeDefinition,
  parameters: Record<string, unknown>,
): string | null {
  // Required fields first: they are what the node is *for*. An email's subject
  // says more than its optional button label, and picking by declaration order
  // alone would surface whichever happened to be written first.
  const ordered = [
    ...def.properties.filter((p) => p.required),
    ...def.properties.filter((p) => !p.required),
  ];

  // A mode switch is chrome, not content. `delay.wait` declares `mode` first and
  // required, so a card would read "for a length of time" — true, and it tells
  // you nothing the title "Wait" did not. Which properties are switches is
  // already stated in the definition: they are the ones other properties key
  // their `displayOptions` off. So it is derived, not a per-node exception, and
  // a node added tomorrow gets the same treatment for free.
  //
  // Second pass, not a filter, because for some nodes the switch really is the
  // most informative field. Losing the caption entirely is worse than a weak one.
  const switches = discriminators(def);

  return (
    firstSummary(ordered.filter((p) => !switches.has(p.name)), parameters) ??
    firstSummary(ordered.filter((p) => switches.has(p.name)), parameters)
  );
}

function firstSummary(
  properties: NodeProperty[],
  parameters: Record<string, unknown>,
): string | null {
  for (const property of properties) {
    if (property.type === "notice") continue;
    // A hidden field is not describing this node's current configuration — the
    // HTML body of an email set to plain text is stale, not current.
    if (!isPropertyVisible(property, parameters)) continue;

    const summary = describe(property, parameters[property.name]);
    if (summary) return summary;
  }
  return null;
}

/** Every property name some other property's visibility depends on. */
function discriminators(def: NodeDefinition): Set<string> {
  const names = new Set<string>();
  for (const property of def.properties) {
    for (const rule of [
      property.displayOptions?.show,
      property.displayOptions?.hide,
    ]) {
      if (rule) for (const name of Object.keys(rule)) names.add(name);
    }
  }
  return names;
}

function describe(property: NodeProperty, value: unknown): string | null {
  if (value === undefined || value === null) return null;

  // A chosen option reads as its label, never its stored value: "The customer"
  // rather than `customer`.
  if (property.options?.length) {
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      const names = value
        .map((v) => property.options?.find((o) => String(o.value) === String(v))?.name)
        .filter(Boolean);
      if (names.length === 0) return null;
      // Two names, then a count — "Repair, Maintenance +2" stays scannable
      // where a full list wraps or truncates mid-word.
      return names.length <= 2
        ? names.join(", ")
        : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    }
    const match = property.options.find((o) => String(o.value) === String(value));
    if (match) return match.name;
  }

  // A variable path, which is a string but not a phrase. Left alone it prints
  // `booking.date` on a card whose entire job is to say what the step does in
  // the language the rest of the product uses — and unlike a member or stage id,
  // this one resolves without reaching for the builder context, because the
  // declaration is the same one the picker was populated from.
  if (property.type === "dateVariable" && typeof value === "string") {
    return VARIABLE_MAP.get(value)?.label ?? null;
  }

  if (typeof value === "string") {
    const flat = collapse(value);
    return flat ? truncate(flat) : null;
  }

  if (typeof value === "number") {
    // `moneyInput` is the only numeric field with a unit worth showing.
    return property.type === "moneyInput"
      ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : String(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} item${value.length === 1 ? "" : "s"}` : null;
  }

  // The one object-valued field type worth reading on a card, and the reason
  // `delay.wait` had no caption at all: "3 days" *is* what that step does.
  if (property.type === "duration") {
    const { amount, unit } = value as { amount?: unknown; unit?: unknown };
    const n = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(n) || n <= 0 || typeof unit !== "string") return null;
    return `${n} ${n === 1 ? unit.replace(/s$/, "") : unit}`;
  }

  // An id — a member, a pipeline, a stage. The id itself is meaningless on a
  // card, and resolving it would mean the node reaching for the builder
  // context. Left to `null` so the next property gets a turn.
  return null;
}

/** Newlines and runs of whitespace become single spaces — an email body is
 *  multi-line and a node card is one. */
function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string): string {
  if (value.length <= MAX_LENGTH) return value;
  // Cut on a word boundary where one is close, so the preview does not end
  // mid-token — `{{customer.firs…` is worse than stopping a word early.
  const cut = value.slice(0, MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > MAX_LENGTH - 12 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
