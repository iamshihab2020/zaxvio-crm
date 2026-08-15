import type { NodeDefinition } from "../../node-definition.js";

/**
 * Reshape a value for a human, and store it under a name.
 *
 * The formatters already exist — `formatMoney`, `formatDateOnly`,
 * `formatPhoneDisplay`, `titleCase` — and interpolation applies them
 * automatically based on the **declaration** of the variable being rendered.
 * That is right for a declared variable and useless for one the author built
 * themselves with Do a Calculation, which has no declaration to read a format
 * off. This node is where the author says so explicitly.
 *
 * It does **not** guess the format from the value's shape. That is the mistake
 * `interpolate.ts` refuses to make, and it refuses it because the system this
 * was ported from rendered a ten-digit advertising campaign id as a phone
 * number.
 */
export default {
  node: "data.format",
  version: 1,
  displayName: "Format a Value",
  description: "Turn a number or date into something readable, under a name.",
  howItWorks:
    "Pick what the value is and it comes out the way a customer should see it " +
    "- money with a currency symbol, a date written out, a phone number spaced. " +
    "Store it under a name and use it as {{vars.yourName}}.",
  icon: "IconTextWrap",
  category: "data",
  subcategory: "data.transform",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  sideEffect: "none",

  properties: [
    {
      displayName: "Store the result as",
      name: "name",
      type: "string",
      required: true,
      placeholder: "amountDue",
    },
    {
      displayName: "Value",
      name: "value",
      type: "string",
      required: true,
      placeholder: "{{vars.deposit}}",
    },
    {
      displayName: "Format it as",
      name: "format",
      type: "options",
      required: true,
      default: "money",
      options: [
        { name: "Money", value: "money" },
        { name: "A date", value: "date" },
        { name: "A date and time", value: "datetime" },
        { name: "A percentage", value: "percent" },
        { name: "A phone number", value: "phone" },
        { name: "Title Case", value: "titleCase" },
        { name: "UPPERCASE", value: "upper" },
        { name: "lowercase", value: "lower" },
      ],
    },
  ],
} satisfies NodeDefinition;
