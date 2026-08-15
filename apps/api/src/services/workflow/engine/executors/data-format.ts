/**
 * `data.format` — reshape a value for a human, under a name.
 *
 * The formatters already exist and interpolation applies them automatically from
 * the **declaration** of the variable being rendered. That is right for a
 * declared variable and useless for one the author built themselves with Do a
 * Calculation, which has no declaration to read a format off. This is where the
 * author says so explicitly.
 *
 * It does **not** guess from the value's shape. That is the mistake
 * `interpolate.ts` refuses to make, because the system this was ported from
 * rendered a ten-digit advertising campaign id as a phone number.
 */

import {
  formatDateOnly,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatPhoneDisplay,
  titleCase,
} from "@hvac-saas/workflow-nodes";
import { assertName, toNumber } from "./data-shared.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const dataFormat: Executor = async ({ ctx, params, node }) => {
  const name = assertName(params.name, node.label);
  const raw = params.value;
  const format = typeof params.format === "string" ? params.format : "money";

  // The tenant's zone, never the server's. A date rendered in UTC for a
  // Chicago business reads as tomorrow from 6pm onward, and the message it
  // lands in is usually about an appointment.
  const text = formatValue(raw, format, ctx.tenant.timezone);
  if (text === null) {
    throw new NodeFailure(
      `data.format could not format ${node.id}`,
      `"${node.label}" could not read "${String(raw ?? "")}" as ${format === "money" ? "an amount" : format === "date" || format === "datetime" ? "a date" : "a number"}. If it is a variable, check what it resolves to.`,
    );
  }

  ctx.vars[name] = text;
  return { output: { name, value: text } };
};

function formatValue(
  raw: unknown,
  format: string,
  timezone: string,
): string | null {
  const asText = typeof raw === "string" ? raw : String(raw ?? "");

  switch (format) {
    case "money": {
      const n = toNumber(raw);
      return n === null ? null : formatMoney(n);
    }
    case "percent": {
      const n = toNumber(raw);
      return n === null ? null : formatPercent(n);
    }
    case "date": {
      if (!asText) return null;
      const out = formatDateOnly(asText);
      return out || null;
    }
    case "datetime": {
      if (!asText) return null;
      const out = formatDateTime(asText, timezone);
      return out || null;
    }
    case "phone":
      return asText ? formatPhoneDisplay(asText) : null;
    case "titleCase":
      return asText ? titleCase(asText) : null;
    case "upper":
      return asText.toUpperCase();
    case "lower":
      return asText.toLowerCase();
    default:
      return asText;
  }
}

export default dataFormat;
