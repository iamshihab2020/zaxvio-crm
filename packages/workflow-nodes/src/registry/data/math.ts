import type { NodeDefinition } from "../../node-definition.js";

/**
 * Arithmetic on two numbers, stored under a name.
 *
 * Deliberately **two operands and one operation**, not an expression field. An
 * expression parser is a second language inside a config panel: it needs its own
 * error reporting, its own precedence rules, and its own security review the
 * moment somebody types a variable into it. Two numbers and a dropdown covers
 * "10% deposit", "half up front", "add the callout fee" — which is the whole of
 * what a service business asks arithmetic for.
 *
 * Money arrives as a **string** from the database (`numeric` columns), which is
 * why the executor parses rather than trusting the type. `"1250.00" * 0.1` is
 * `125` in JavaScript and `NaN` for `"$1,250.00"`, and only one of those is
 * obviously wrong when you read the run log.
 */
export default {
  node: "data.math",
  version: 1,
  displayName: "Do a Calculation",
  description: "Add, subtract, multiply or divide, and remember the answer.",
  howItWorks:
    "Works out one sum and stores the answer under a name, so later steps can " +
    "use it as {{vars.yourName}}. Amounts from invoices and quotes can be " +
    "dropped straight in as variables.",
  icon: "IconMathSymbols",
  category: "data",
  subcategory: "data.transform",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  sideEffect: "none",

  properties: [
    {
      displayName: "Store the answer as",
      name: "name",
      type: "string",
      required: true,
      placeholder: "deposit",
      description: "Use it later as {{vars.deposit}}.",
    },
    {
      displayName: "First number",
      name: "left",
      type: "string",
      required: true,
      placeholder: "{{invoice.total}}",
    },
    {
      displayName: "Operation",
      name: "operation",
      type: "options",
      required: true,
      default: "multiply",
      options: [
        { name: "Add", value: "add" },
        { name: "Subtract", value: "subtract" },
        { name: "Multiply by", value: "multiply" },
        { name: "Divide by", value: "divide" },
        { name: "Percent of", value: "percentOf" },
      ],
    },
    {
      displayName: "Second number",
      name: "right",
      type: "string",
      required: true,
      placeholder: "0.1",
    },
    {
      displayName: "Round to",
      name: "decimals",
      type: "number",
      default: 2,
      typeOptions: { minValue: 0, maxValue: 6, step: 1 },
      description: "Decimal places. Money is usually 2.",
    },
  ],
} satisfies NodeDefinition;
