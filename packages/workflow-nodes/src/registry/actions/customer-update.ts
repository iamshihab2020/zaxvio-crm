import type { NodeDefinition } from "../../node-definition.js";

/**
 * Change a field on the customer.
 *
 * Deliberately a **fixed set of fields**, not a key/value pair list. A free-form
 * "column name" control lets an author write `tenant_id` and discover at run
 * time that it is refused, and there is no way to render a helpful error for a
 * column that never existed. The allow-list is also what makes the form
 * self-documenting: the fields you can change are the fields shown.
 *
 * Every field is optional and only the ones filled in are written, so this is a
 * patch rather than a replace. A step that blanked everything the author left
 * empty would destroy a customer record on its first run.
 */
export default {
  node: "customer.update",
  version: 1,
  displayName: "Update the Customer",
  description: "Change details on the customer this automation is running for.",
  howItWorks:
    "Only the fields you fill in are changed - anything left blank is left " +
    "alone. If nothing actually differs, the step reports that and moves on.",
  icon: "IconUserEdit",
  category: "crm",
  subcategory: "crm.customer",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["customer", "job", "invoice", "quote", "booking", "equipment", "maintenance_contract"],
  mutates: ["customer"],
  // Writing the same values twice is a no-op the service refuses, so re-running
  // after a crash cannot double anything.
  sideEffect: "idempotent",

  properties: [
    {
      displayName: "Notes",
      name: "notes",
      type: "text",
      typeOptions: { rows: 3 },
      description: "Replaces the customer's notes. Leave blank to keep what is there.",
      encoding: "none",
    },
    {
      displayName: "Phone",
      name: "phone",
      type: "string",
      placeholder: "Leave blank to keep the current number",
    },
    {
      displayName: "Address",
      name: "address",
      type: "string",
      placeholder: "Leave blank to keep the current address",
    },
    {
      displayName: "City",
      name: "city",
      type: "string",
    },
    {
      displayName: "Postcode",
      name: "zipCode",
      type: "string",
    },
  ],
} satisfies NodeDefinition;
