import type { NodeDefinition } from "../../node-definition.js";

/**
 * Call another system's API.
 *
 * ## Read the guard before changing anything here
 *
 * [[wf-10-security|§10.5]] calls outbound HTTP *"the single highest-severity
 * risk in the feature"*, and it is not rhetorical. An unguarded version of this
 * node lets any tenant read cloud metadata credentials
 * (`169.254.169.254`), reach anything inside the private network this API runs
 * in, and use us as an open proxy with our IP and our reputation.
 *
 * Every one of those is closed in `services/workflow/http/`, not here — a
 * definition declares fields, it does not enforce anything. The two that are
 * easiest to reintroduce by accident:
 *
 * - The connection is pinned to an address the validator already approved. If
 *   this ever moves to `fetch`, that pinning is gone and DNS rebinding is back.
 * - **Every redirect hop is re-validated.** A 302 to a private address defeats
 *   any guard that only inspected the URL the author typed.
 *
 * ## The response body is not readable outside a test run
 *
 * `{{previous.…}}` gets the status and the headers always, and the body only on
 * a test run. That is §10.5's rule and the reasoning is worth keeping: a body
 * written into `node_execution_logs` is whatever the remote server chose to
 * send, stored indefinitely, readable by anyone with run-history access. A
 * tenant pointing this at their own admin API would be exfiltrating it into our
 * logs without meaning to.
 */
export default {
  node: "http.request",
  version: 1,
  displayName: "Call a URL",
  description: "Send a request to another system's API.",
  howItWorks:
    "Calls the address you give it and carries on. Private and internal " +
    "addresses are refused. The reply's status is available to later steps; " +
    "the reply body is only shown when you test the step.",
  icon: "IconWorldBolt",
  category: "integration",
  subcategory: "integration.http",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  // Two runs is two requests, and the receiving system decides what that means.
  // Claiming `idempotent` would let a resume replay a payment or a purchase.
  sideEffect: "at-most-once",

  properties: [
    {
      displayName: "Method",
      name: "method",
      type: "options",
      required: true,
      default: "POST",
      options: [
        { name: "GET", value: "GET" },
        { name: "POST", value: "POST" },
        { name: "PUT", value: "PUT" },
        { name: "PATCH", value: "PATCH" },
        { name: "DELETE", value: "DELETE" },
      ],
    },
    {
      displayName: "URL",
      name: "url",
      type: "string",
      required: true,
      placeholder: "https://example.com/api/jobs",
      description: "Must be http:// or https://. Variables work here.",
      // URL-encoded, so a customer name with an `&` in it does not become two
      // query parameters. Declared on the field rather than chosen at the call
      // site — the reference implementation chose per call and a field that
      // forgot silently got none.
      encoding: "url",
    },
    {
      displayName: "Headers",
      name: "headers",
      type: "keyValue",
      typeOptions: {
        keyPlaceholder: "Authorization",
        valuePlaceholder: "Bearer …",
        addButtonText: "Add another header",
      },
      description: "Host and content-length are set for you and cannot be overridden.",
    },
    {
      displayName: "Body",
      name: "body",
      type: "text",
      typeOptions: { rows: 6 },
      placeholder: '{ "jobNumber": "{{job.number}}" }',
      description: "Sent as-is. Set a Content-Type header to say what it is.",
      displayOptions: { hide: { method: ["GET", "DELETE"] } },
      // Not interpolation-encoded: a JSON body needs its own quoting, and
      // URL-encoding it would corrupt it. Variables still resolve.
      encoding: "none",
    },
    {
      displayName: "Note",
      name: "notice",
      type: "notice",
      typeOptions: {
        noticeType: "warning",
        noticeMessage:
          "Anything you put in a header here is stored with the automation. Use a value you can rotate, and never your own Zaxvio password.",
      },
    },
  ],
} satisfies NodeDefinition;
