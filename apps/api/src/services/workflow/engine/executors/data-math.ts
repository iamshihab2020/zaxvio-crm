/**
 * `data.math` — arithmetic on two numbers, stored under a name.
 *
 * Deliberately **two operands and one operation**, not an expression field. An
 * expression parser is a second language inside a config panel: its own error
 * reporting, its own precedence, and its own security review the moment somebody
 * types a variable into it. Two numbers and a dropdown covers "10% deposit",
 * "half up front" and "add the callout fee" — the whole of what a service
 * business asks arithmetic for.
 */

import { assertName, toNumber } from "./data-shared.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const dataMath: Executor = async ({ ctx, params, node }) => {
  const name = assertName(params.name, node.label);
  const left = toNumber(params.left);
  const right = toNumber(params.right);

  if (left === null || right === null) {
    // A config problem the author can see: either they typed something that is
    // not a number, or a variable resolved to nothing. Both are fixable by
    // opening the step, which is the test for failing loudly.
    throw new NodeFailure(
      `data.math got a non-number in ${node.id}`,
      `"${node.label}" could not read one of its numbers — ${left === null ? "the first" : "the second"} one came out as "${left === null ? String(params.left ?? "") : String(params.right ?? "")}". If it is a variable, check it against what this automation's trigger provides.`,
    );
  }

  let answer: number;
  switch (params.operation) {
    case "add":
      answer = left + right;
      break;
    case "subtract":
      answer = left - right;
      break;
    case "multiply":
      answer = left * right;
      break;
    case "divide":
      // Refused rather than producing `Infinity`, which would print as the word
      // "Infinity" in whatever message used it next.
      if (right === 0) {
        throw new NodeFailure(
          `data.math divide by zero in ${node.id}`,
          `"${node.label}" tried to divide by zero. If the second number is a variable, it may have come out empty.`,
        );
      }
      answer = left / right;
      break;
    case "percentOf":
      answer = (left * right) / 100;
      break;
    default:
      throw new NodeFailure(
        `data.math unknown operation in ${node.id}`,
        `"${node.label}" has no calculation chosen. Open the step and pick one.`,
      );
  }

  const decimals =
    typeof params.decimals === "number" && params.decimals >= 0 && params.decimals <= 6
      ? params.decimals
      : 2;
  const rounded = Number(answer.toFixed(decimals));

  // Stored as a **number**, not a formatted string. Formatting is `data.format`,
  // and a value that arrives here pre-formatted cannot be compared by a
  // condition or fed into a second calculation.
  ctx.vars[name] = rounded;

  return { output: { name, value: rounded } };
};

export default dataMath;
