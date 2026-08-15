import type { NodeDefinition } from "../../node-definition.js";

/**
 * Post this run's data to a URL.
 *
 * ## Why this exists alongside `http.request`
 *
 * It is the same machinery with the decisions already made: POST, JSON, a body
 * built from the record rather than typed by hand. `http.request` is for calling
 * somebody's API on their terms; this is for telling another system that
 * something happened here, which is the overwhelmingly more common thing a
 * service business wants and is otherwise four fields of ceremony to express.
 *
 * The same guard applies — same validator, same address denial, same redirect
 * re-validation, same quota. Nothing about this node is a lighter path; only the
 * form is lighter.
 *
 * ## The body is ours, not the author's
 *
 * A fixed envelope — event, tenant, subject, and the record this run is about.
 * That is deliberate: a hand-written JSON body is where an author accidentally
 * ships a customer's full record to a third party, and a fixed shape is
 * something the receiving system can be written against once.
 */
export default {
  node: "webhook.send",
  version: 1,
  displayName: "Send to a URL",
  description: "Post this automation's data to another system.",
  howItWorks:
    "Sends a small JSON message about the customer or job this automation is " +
    "running for. Private and internal addresses are refused, and there is a " +
    "daily limit on outside calls.",
  icon: "IconSend",
  category: "integration",
  subcategory: "integration.http",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  sideEffect: "at-most-once",

  properties: [
    {
      displayName: "URL",
      name: "url",
      type: "string",
      required: true,
      placeholder: "https://hooks.example.com/zaxvio",
      description: "Must be http:// or https://.",
      encoding: "url",
    },
    {
      displayName: "Secret",
      name: "secret",
      type: "string",
      description:
        "Sent as an X-Zaxvio-Signature header so the other system can check the message really came from you.",
      // Not URL-encoded — it goes in a header, and encoding it would make the
      // signature the receiver computes differ from the one we sent.
      encoding: "none",
    },
    {
      displayName: "Extra fields",
      name: "extra",
      type: "keyValue",
      typeOptions: {
        keyPlaceholder: "source",
        valuePlaceholder: "zaxvio",
        addButtonText: "Add another field",
      },
      description: "Added alongside the standard fields. Variables work here.",
    },
  ],
} satisfies NodeDefinition;
