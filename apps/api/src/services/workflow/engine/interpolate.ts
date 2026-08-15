/**
 * `{{token}}` resolution.
 *
 * **One pass, over the whole parameters object, before dispatch** (wf-00 D-08).
 * The system this was ported from interpolated per field at each call site, so
 * a new node could ship a field that forgot to resolve variables and nobody
 * would notice until a customer received `Hi {{customer.firstName}}`. Here an
 * executor receives parameters that are *already* resolved and has no way to
 * skip the step.
 *
 * Three things this module refuses to do, each for a reason:
 *
 * 1. **It does not traverse the context freely.** Declared paths resolve through
 *    a closed `Map`; only four namespaces (`previous`, `vars`, `trigger`,
 *    `loop`) walk an object, and they walk *their own* object, not the context.
 *    Prototype-chain access is therefore unreachable by construction, and the
 *    deny-list below is defence in depth rather than the mechanism.
 * 2. **It does not guess a format from a value's shape.** `format` comes off the
 *    declaration. The reference implementation guessed and rendered a ten-digit
 *    Google Ads campaign id as `(123) 456-7890`.
 * 3. **It does not fail silently.** An unknown variable produces a diagnostic
 *    naming the node, the field and a suggestion — a blank email is otherwise
 *    the least debuggable thing this feature can produce.
 */

import {
  DYNAMIC_NAMESPACES,
  VARIABLE_MAP,
  interpolationToken,
  formatDateOnly,
  formatDateTime,
  formatList,
  formatMoney,
  formatPercent,
  formatPhoneDisplay,
  formatTimeOnly,
  namespaceOf,
  suggestVariables,
  titleCase,
  type ExecutionContext,
  type VariableDef,
} from "@hvac-saas/workflow-nodes";

// The token shape now lives in `@hvac-saas/workflow-nodes`, because the graph
// validator has to find the same tokens at publish time in order to report a
// path that will never resolve. Two copies of this regex is a validator that
// stops seeing a shape the engine still honours — and the failure would be
// silent in the direction that matters, since the validator's job is to notice.
//
// A factory, not a shared const: a `g` regex carries `lastIndex` between calls,
// so one instance shared by two consumers interleaves and drops matches.

/**
 * Paths that are refused outright.
 *
 * They are unreachable anyway — see rule 1 above — but a user who types
 * `{{env.DATABASE_URL}}` should see a **visible** refusal in their test email
 * rather than an empty string, and learn immediately that this is not a thing
 * the product does.
 */
const BLOCKED = /(^|\.)(env|process|globalThis|__proto__|prototype|constructor)(\.|$)/i;
const BLOCKED_MARKER = "[BLOCKED: not allowed]";

export interface Diagnostic {
  /** The token as typed, without braces. */
  path: string;
  /** Which config field it was in — `body`, `subject`. */
  field: string;
  message: string;
  suggestions: string[];
}

export interface InterpolateResult<T> {
  value: T;
  diagnostics: Diagnostic[];
}

/**
 * Resolve every `{{token}}` in a parameters object.
 *
 * Walks strings, arrays and plain objects. `noInterpolate` fields are skipped —
 * a regex pattern or a raw request body has `{` in it legitimately.
 */
export function interpolateParameters(
  parameters: Record<string, unknown>,
  ctx: ExecutionContext,
  options: { skip?: Set<string>; encodings?: Record<string, VariableDef["encoding"]> } = {},
): InterpolateResult<Record<string, unknown>> {
  const diagnostics: Diagnostic[] = [];
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (options.skip?.has(key)) {
      out[key] = value;
      continue;
    }
    out[key] = walk(value, ctx, key, options.encodings?.[key], diagnostics);
  }

  return { value: out, diagnostics };
}

/** Resolve one string. Exposed for the preview endpoint and for tests. */
export function interpolateString(
  template: string,
  ctx: ExecutionContext,
  field = "value",
  encodingOverride?: VariableDef["encoding"],
): InterpolateResult<string> {
  const diagnostics: Diagnostic[] = [];
  const value = substitute(template, ctx, field, encodingOverride, diagnostics);
  return { value, diagnostics };
}

function walk(
  value: unknown,
  ctx: ExecutionContext,
  field: string,
  encoding: VariableDef["encoding"] | undefined,
  diagnostics: Diagnostic[],
): unknown {
  if (typeof value === "string") {
    return substitute(value, ctx, field, encoding, diagnostics);
  }
  if (Array.isArray(value)) {
    return value.map((item, i) =>
      walk(item, ctx, `${field}[${i}]`, encoding, diagnostics),
    );
  }
  // Plain objects only. A `Date` or a class instance in node parameters would
  // be a bug elsewhere — parameters come out of `jsonb` — and reconstructing
  // one here would quietly change its type.
  if (value !== null && typeof value === "object" && isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = walk(inner, ctx, `${field}.${key}`, encoding, diagnostics);
    }
    return out;
  }
  return value;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function substitute(
  template: string,
  ctx: ExecutionContext,
  field: string,
  encodingOverride: VariableDef["encoding"] | undefined,
  diagnostics: Diagnostic[],
): string {
  // Cheap exit. Most fields contain no tokens at all and this runs per node per
  // run; `.replace` with a global regex on every string is not free.
  if (!template.includes("{{")) return template;

  return template.replace(interpolationToken(), (_match, rawPath: string) => {
    const path = rawPath.trim();

    if (BLOCKED.test(path)) {
      console.warn(
        `[workflow] Blocked variable "${path}" in ${field} (workflow "${ctx.workflowName}", execution ${ctx.executionId})`,
      );
      diagnostics.push({
        path,
        field,
        message: `"${path}" is not a variable you can use.`,
        suggestions: [],
      });
      return BLOCKED_MARKER;
    }

    const declared = VARIABLE_MAP.get(path);
    if (declared) {
      return render(
        declared.resolve(ctx),
        declared,
        ctx,
        encodingOverride ?? declared.encoding ?? "none",
      );
    }

    const namespace = namespaceOf(path);
    if ((DYNAMIC_NAMESPACES as readonly string[]).includes(namespace)) {
      const value = resolveDynamic(path, namespace, ctx);
      if (value === undefined) {
        diagnostics.push(missing(path, field, ctx));
        return "";
      }
      return encode(stringify(value), encodingOverride ?? "none");
    }

    diagnostics.push(missing(path, field, ctx));
    return "";
  });
}

/**
 * The **raw** value at a variable path — unformatted, unstringified.
 *
 * Interpolation renders values for a human: money becomes "$1,250.00", a date
 * becomes "12 Aug". A comparison needs the number and the instant, or
 * `greaterThan 500` would be comparing the string "$1,250.00" against 500 and
 * quietly getting it wrong.
 *
 * Shares `VARIABLE_MAP`, the blocked-path check and the dynamic namespaces with
 * `substitute` above, so a condition and an interpolation can never disagree
 * about what a path means or which paths are reachable.
 *
 * `found: false` is distinct from `value: undefined` — a variable that exists
 * and is genuinely empty is a different thing from one that was never declared,
 * and only the second is a mistake worth reporting.
 */
export function resolveVariable(
  path: string,
  ctx: ExecutionContext,
): { found: boolean; value: unknown } {
  if (BLOCKED.test(path)) return { found: false, value: undefined };

  const declared = VARIABLE_MAP.get(path);
  if (declared) return { found: true, value: declared.resolve(ctx) };

  const namespace = namespaceOf(path);
  if ((DYNAMIC_NAMESPACES as readonly string[]).includes(namespace)) {
    const value = resolveDynamic(path, namespace, ctx);
    return value === undefined
      ? { found: false, value: undefined }
      : { found: true, value };
  }

  return { found: false, value: undefined };
}

function missing(path: string, field: string, ctx: ExecutionContext): Diagnostic {
  const suggestions = suggestVariables(path);
  const message =
    suggestions.length > 0
      ? `Unknown variable "${path}" — did you mean ${suggestions.join(", ")}?`
      : `Unknown variable "${path}".`;

  // Logged for us and returned for the user. The same sentence reaches the
  // replay page next to the node — a server log the customer cannot read is
  // precisely why this class of feature generates tickets.
  console.warn(
    `[workflow] ${message} (field: ${field}, workflow "${ctx.workflowName}", execution ${ctx.executionId})`,
  );

  return { path, field, message, suggestions };
}

/**
 * `previous.*` · `vars.*` · `trigger.*` · `loop.*`
 *
 * Each walks **its own object**, never the context, so there is no path from a
 * user-typed string to `ctx.tenantId` or to a prototype. `previous` accepts a
 * node label as well as an id, because `{{previous.Send Email.messageId}}` is
 * what an author would write and node ids are UUIDs nobody types.
 */
function resolveDynamic(
  path: string,
  namespace: string,
  ctx: ExecutionContext,
): unknown {
  const rest = path.slice(namespace.length + 1);

  switch (namespace) {
    case "vars":
      return getPath(ctx.vars, rest);
    case "trigger":
      return getPath(ctx.trigger.payload, rest);
    case "loop":
      // Written out rather than cast. An interface gets no implicit index
      // signature in TypeScript, so `ctx.loop` needs an `as unknown as Record`
      // to reach `getPath` — and [[strict-rules]] §4 bans exactly that pair.
      // Three named fields is the honest version, and it also documents what
      // `{{loop.*}}` can address.
      return ctx.loop
        ? getPath(
            { item: ctx.loop.item, index: ctx.loop.index, total: ctx.loop.total },
            rest,
          )
        : undefined;
    case "previous": {
      const dot = rest.indexOf(".");
      const head = dot === -1 ? rest : rest.slice(0, dot);
      const tail = dot === -1 ? "" : rest.slice(dot + 1);
      const nodeId = ctx.nodeLabels[head] ?? head;
      const output = ctx.nodeOutputs[nodeId];
      if (output === undefined) return undefined;
      if (!tail) return output;
      return output !== null && typeof output === "object"
        ? getPath(output as Record<string, unknown>, tail)
        : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Dotted lookup with **own-property checks only**.
 *
 * `in` and bare bracket access both walk the prototype chain, so `a.toString`
 * would resolve to a function. `Object.prototype.hasOwnProperty.call` is the
 * one that does not.
 */
function getPath(source: Record<string, unknown>, path: string): unknown {
  if (!path) return source;
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Apply the declared format, then the declared encoding. In that order — an
 *  html-encoded value re-formatted would have its entities mangled. */
function render(
  value: unknown,
  def: VariableDef,
  ctx: ExecutionContext,
  encoding: VariableDef["encoding"],
): string {
  if (value === null || value === undefined) return "";

  let text: string;
  switch (def.format) {
    case "phone":
      text = formatPhoneDisplay(String(value));
      break;
    case "money":
      text = formatMoney(value as string | number);
      break;
    case "percent":
      text = formatPercent(value as string | number);
      break;
    case "date":
      text = formatDateOnly(String(value));
      break;
    case "datetime":
      text = formatDateTime(String(value), ctx.timezone);
      break;
    case "time":
      // The date is passed so the abbreviation follows it: the same stored
      // `09:00:00` is CDT in August and CST in January, and a reminder that
      // names the wrong one is worse than one that names none.
      text = formatTimeOnly(String(value), ctx.timezone, ctx.job?.scheduledDate ?? null);
      break;
    case "titleCase":
      text = titleCase(String(value));
      break;
    case "list":
      text = formatList(value);
      break;
    default:
      text = stringify(value);
  }

  return encode(text, encoding ?? "none");
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return formatList(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Output encoding, **declared with the property** rather than chosen per call
 * site (wf-00 D-08).
 *
 * `html` matters more here than it looks: a customer's last name goes into a
 * React Email template, and `O'Brien <script>` reaching that template unescaped
 * is a stored XSS in an email nobody audits.
 */
export function encode(value: string, encoding: VariableDef["encoding"]): string {
  switch (encoding) {
    case "html":
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    case "url":
      return encodeURIComponent(value);
    default:
      return value;
  }
}
