import type { EntityDefinition } from "./types";

export const ENTITY_DEFINITIONS: Record<string, EntityDefinition> = {
  create_customer: {
    name: "Customer",
    actionType: "create_customer",
    aliases: [
      "customer",
      "client",
      "contact",
      "person",
      "account",
    ],
    requiredFields: [
      { key: "firstName", label: "First Name", required: true },
      { key: "lastName", label: "Last Name", required: true },
    ],
    optionalFields: [
      { key: "email", label: "Email", required: false },
      { key: "phone", label: "Phone", required: false },
      { key: "address", label: "Address", required: false },
      { key: "city", label: "City", required: false },
      { key: "state", label: "State", required: false },
      { key: "zipCode", label: "Zip Code", required: false },
    ],
    fieldAliases: {
      name: "firstName+lastName",
      "full name": "firstName+lastName",
      "first name": "firstName",
      "last name": "lastName",
      "phone number": "phone",
      mobile: "phone",
      tel: "phone",
      "email address": "email",
      mail: "email",
      zip: "zipCode",
      "zip code": "zipCode",
      postal: "zipCode",
    },
    needsCustomerLookup: false,
  },

  create_event: {
    name: "Calendar Event",
    actionType: "create_event",
    aliases: [
      "event",
      "appointment",
      "meeting",
      "reminder",
      "calendar event",
      "calendar",
    ],
    requiredFields: [
      { key: "title", label: "Title", required: true },
      { key: "eventDate", label: "Date", required: true },
    ],
    optionalFields: [
      { key: "startTime", label: "Start Time", required: false },
      { key: "endTime", label: "End Time", required: false },
      { key: "description", label: "Description", required: false },
      { key: "contactName", label: "Contact Name", required: false },
      { key: "contactPhone", label: "Contact Phone", required: false },
      { key: "address", label: "Address", required: false },
      { key: "color", label: "Color", required: false },
    ],
    fieldAliases: {
      name: "title",
      subject: "title",
      what: "title",
      date: "eventDate",
      when: "eventDate",
      time: "startTime",
      start: "startTime",
      end: "endTime",
      "start time": "startTime",
      "end time": "endTime",
      location: "address",
      where: "address",
      contact: "contactName",
    },
    needsCustomerLookup: false,
  },

  create_job: {
    name: "Job",
    actionType: "create_job",
    aliases: [
      "job",
      "work order",
      "service call",
      "task",
      "service job",
      "work",
    ],
    requiredFields: [
      { key: "customerId", label: "Customer", required: true },
      { key: "serviceType", label: "Service Type", required: true },
      { key: "title", label: "Title", required: true },
      { key: "scheduledDate", label: "Scheduled Date", required: true },
    ],
    optionalFields: [
      { key: "description", label: "Description", required: false },
      { key: "scheduledStart", label: "Start Time", required: false },
      { key: "scheduledEnd", label: "End Time", required: false },
      { key: "address", label: "Address", required: false },
      { key: "priority", label: "Priority", required: false },
      { key: "notes", label: "Notes", required: false },
    ],
    fieldAliases: {
      customer: "customerName",
      client: "customerName",
      for: "customerName",
      type: "serviceType",
      "service type": "serviceType",
      service: "serviceType",
      date: "scheduledDate",
      when: "scheduledDate",
      time: "scheduledStart",
      start: "scheduledStart",
      end: "scheduledEnd",
      location: "address",
      where: "address",
      name: "title",
    },
    needsCustomerLookup: true,
  },

  create_invoice: {
    name: "Invoice",
    actionType: "create_invoice",
    aliases: [
      "invoice",
      "bill",
      "charge",
    ],
    requiredFields: [
      { key: "customerId", label: "Customer", required: true },
    ],
    optionalFields: [
      { key: "dueDate", label: "Due Date", required: false },
      { key: "taxRate", label: "Tax Rate", required: false },
      { key: "discountAmount", label: "Discount", required: false },
      { key: "notes", label: "Notes", required: false },
    ],
    fieldAliases: {
      customer: "customerName",
      client: "customerName",
      for: "customerName",
      due: "dueDate",
      "due date": "dueDate",
      tax: "taxRate",
      discount: "discountAmount",
    },
    needsCustomerLookup: true,
  },

  create_quote: {
    name: "Quote",
    actionType: "create_quote",
    aliases: [
      "quote",
      "estimate",
      "proposal",
      "bid",
    ],
    requiredFields: [
      { key: "customerId", label: "Customer", required: true },
    ],
    optionalFields: [
      { key: "expiryDate", label: "Expiry Date", required: false },
      { key: "taxRate", label: "Tax Rate", required: false },
      { key: "discountAmount", label: "Discount", required: false },
      { key: "notes", label: "Notes", required: false },
    ],
    fieldAliases: {
      customer: "customerName",
      client: "customerName",
      for: "customerName",
      expiry: "expiryDate",
      "expiry date": "expiryDate",
      "valid until": "expiryDate",
      tax: "taxRate",
      discount: "discountAmount",
    },
    needsCustomerLookup: true,
  },

  create_catalog_item: {
    name: "Catalog Item",
    actionType: "create_catalog_item",
    aliases: [
      "catalog item",
      "catalog",
      "service item",
      "product",
      "part",
      "item",
    ],
    requiredFields: [
      { key: "name", label: "Name", required: true },
      { key: "itemType", label: "Type (parts/labor/flat_rate)", required: true },
      { key: "unitPrice", label: "Price", required: true },
    ],
    optionalFields: [
      { key: "unit", label: "Unit", required: false },
      { key: "category", label: "Category", required: false },
      { key: "description", label: "Description", required: false },
    ],
    fieldAliases: {
      title: "name",
      type: "itemType",
      "item type": "itemType",
      kind: "itemType",
      price: "unitPrice",
      cost: "unitPrice",
      rate: "unitPrice",
      "unit price": "unitPrice",
    },
    needsCustomerLookup: false,
  },

  create_equipment: {
    name: "Equipment",
    actionType: "create_equipment",
    aliases: [
      "equipment",
      "asset",
      "unit",
      "machine",
      "device",
      "system",
    ],
    requiredFields: [
      { key: "customerId", label: "Customer", required: true },
      { key: "equipmentType", label: "Equipment Type", required: true },
    ],
    optionalFields: [
      { key: "brand", label: "Brand", required: false },
      { key: "model", label: "Model", required: false },
      { key: "serialNumber", label: "Serial Number", required: false },
      { key: "installDate", label: "Install Date", required: false },
      { key: "warrantyExpiry", label: "Warranty Expiry", required: false },
      { key: "location", label: "Location", required: false },
      { key: "notes", label: "Notes", required: false },
    ],
    fieldAliases: {
      customer: "customerName",
      client: "customerName",
      for: "customerName",
      type: "equipmentType",
      make: "brand",
      manufacturer: "brand",
      "serial number": "serialNumber",
      serial: "serialNumber",
      "model number": "model",
      installed: "installDate",
      warranty: "warrantyExpiry",
    },
    needsCustomerLookup: true,
  },

  create_booking: {
    name: "Booking",
    actionType: "create_booking",
    aliases: [
      "booking",
      "reservation",
      "schedule",
      "book",
    ],
    requiredFields: [
      { key: "customerName", label: "Customer Name", required: true },
      { key: "serviceType", label: "Service Type", required: true },
      { key: "bookingDate", label: "Date", required: true },
    ],
    optionalFields: [
      { key: "preferredTime", label: "Preferred Time", required: false },
      { key: "customerEmail", label: "Email", required: false },
      { key: "customerPhone", label: "Phone", required: false },
      { key: "address", label: "Address", required: false },
      { key: "description", label: "Description", required: false },
    ],
    fieldAliases: {
      customer: "customerName",
      client: "customerName",
      name: "customerName",
      for: "customerName",
      type: "serviceType",
      service: "serviceType",
      "service type": "serviceType",
      date: "bookingDate",
      when: "bookingDate",
      time: "preferredTime",
      email: "customerEmail",
      phone: "customerPhone",
      location: "address",
      where: "address",
    },
    needsCustomerLookup: false,
  },
};

/** Get entity definition by action type */
export function getEntityDefinition(
  actionType: string,
): EntityDefinition | undefined {
  return ENTITY_DEFINITIONS[actionType];
}

/** Find entity definition by alias word */
export function findEntityByAlias(word: string): EntityDefinition | undefined {
  const lower = word.toLowerCase();
  for (const def of Object.values(ENTITY_DEFINITIONS)) {
    if (def.aliases.some((alias) => lower.includes(alias))) {
      return def;
    }
  }
  return undefined;
}

/** Get all entity aliases for intent detection */
export function getAllEntityAliases(): string[] {
  const aliases: string[] = [];
  for (const def of Object.values(ENTITY_DEFINITIONS)) {
    aliases.push(...def.aliases);
  }
  return aliases;
}
