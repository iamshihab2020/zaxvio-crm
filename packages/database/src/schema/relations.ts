import { relations } from "drizzle-orm";
import { tenants } from "./tenants";
import {
  user,
  session,
  account,
  organization,
  member,
  invitation,
} from "./auth";
import {
  adminAuditLog,
  adminImpersonationSessions,
  platformEvents,
} from "./admin";
import { tenantSubscriptions } from "./subscriptions";
import { customers } from "./customers";
import { catalogItems } from "./catalog";
import { equipment, refrigerantLogs } from "./equipment";
import { maintenanceContracts } from "./maintenance";
import { bookings } from "./bookings";
import { jobs, jobLineItems, jobPhotos } from "./jobs";
import { invoices, invoiceLineItems, invoicePayments } from "./invoices";
import { quotes, quoteLineItems } from "./quotes";
import { availabilitySchedules, scheduleOverrides } from "./schedule";
import {
  checklistTemplates,
  checklistItems,
  jobChecklistCompletions,
} from "./checklists";

// --- Better Auth: User relations ---
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// --- Better Auth: Organization relations ---
export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

// --- Tenant relations ---
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  organization: one(organization, {
    fields: [tenants.organizationId],
    references: [organization.id],
  }),
  subscription: one(tenantSubscriptions),
  customers: many(customers),
  catalogItems: many(catalogItems),
  jobs: many(jobs),
  invoices: many(invoices),
  quotes: many(quotes),
  bookings: many(bookings),
  equipment: many(equipment),
  maintenanceContracts: many(maintenanceContracts),
  checklistTemplates: many(checklistTemplates),
  availabilitySchedules: many(availabilitySchedules),
  scheduleOverrides: many(scheduleOverrides),
  platformEvents: many(platformEvents),
}));

// --- Subscription relations ---
export const tenantSubscriptionsRelations = relations(
  tenantSubscriptions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [tenantSubscriptions.tenantId],
      references: [tenants.id],
    }),
  }),
);

// --- Customer relations ---
export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  equipment: many(equipment),
  jobs: many(jobs),
  invoices: many(invoices),
  quotes: many(quotes),
  bookings: many(bookings),
  maintenanceContracts: many(maintenanceContracts),
}));

// --- Catalog relations ---
export const catalogItemsRelations = relations(catalogItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [catalogItems.tenantId],
    references: [tenants.id],
  }),
}));

// --- Equipment relations ---
export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [equipment.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [equipment.customerId],
    references: [customers.id],
  }),
  refrigerantLogs: many(refrigerantLogs),
  maintenanceContracts: many(maintenanceContracts),
}));

export const refrigerantLogsRelations = relations(
  refrigerantLogs,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [refrigerantLogs.tenantId],
      references: [tenants.id],
    }),
    equipment: one(equipment, {
      fields: [refrigerantLogs.equipmentId],
      references: [equipment.id],
    }),
  }),
);

// --- Maintenance contract relations ---
export const maintenanceContractsRelations = relations(
  maintenanceContracts,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [maintenanceContracts.tenantId],
      references: [tenants.id],
    }),
    customer: one(customers, {
      fields: [maintenanceContracts.customerId],
      references: [customers.id],
    }),
    equipment: one(equipment, {
      fields: [maintenanceContracts.equipmentId],
      references: [equipment.id],
    }),
  }),
);

// --- Booking relations ---
export const bookingsRelations = relations(bookings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [bookings.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.id],
  }),
}));

// --- Job relations ---
export const jobsRelations = relations(jobs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [jobs.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [jobs.customerId],
    references: [customers.id],
  }),
  lineItems: many(jobLineItems),
  photos: many(jobPhotos),
  checklistCompletions: many(jobChecklistCompletions),
  invoices: many(invoices),
  refrigerantLogs: many(refrigerantLogs),
}));

export const jobLineItemsRelations = relations(jobLineItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [jobLineItems.tenantId],
    references: [tenants.id],
  }),
  job: one(jobs, {
    fields: [jobLineItems.jobId],
    references: [jobs.id],
  }),
  catalogItem: one(catalogItems, {
    fields: [jobLineItems.catalogItemId],
    references: [catalogItems.id],
  }),
}));

export const jobPhotosRelations = relations(jobPhotos, ({ one }) => ({
  tenant: one(tenants, {
    fields: [jobPhotos.tenantId],
    references: [tenants.id],
  }),
  job: one(jobs, {
    fields: [jobPhotos.jobId],
    references: [jobs.id],
  }),
}));

// --- Invoice relations ---
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  lineItems: many(invoiceLineItems),
  payments: many(invoicePayments),
}));

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [invoiceLineItems.tenantId],
      references: [tenants.id],
    }),
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
    catalogItem: one(catalogItems, {
      fields: [invoiceLineItems.catalogItemId],
      references: [catalogItems.id],
    }),
  }),
);

export const invoicePaymentsRelations = relations(
  invoicePayments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [invoicePayments.tenantId],
      references: [tenants.id],
    }),
    invoice: one(invoices, {
      fields: [invoicePayments.invoiceId],
      references: [invoices.id],
    }),
  }),
);

// --- Quote relations ---
export const quotesRelations = relations(quotes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [quotes.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
  convertedToJob: one(jobs, {
    fields: [quotes.convertedToJobId],
    references: [jobs.id],
  }),
  lineItems: many(quoteLineItems),
}));

export const quoteLineItemsRelations = relations(
  quoteLineItems,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [quoteLineItems.tenantId],
      references: [tenants.id],
    }),
    quote: one(quotes, {
      fields: [quoteLineItems.quoteId],
      references: [quotes.id],
    }),
    catalogItem: one(catalogItems, {
      fields: [quoteLineItems.catalogItemId],
      references: [catalogItems.id],
    }),
  }),
);

// --- Schedule relations ---
export const availabilitySchedulesRelations = relations(
  availabilitySchedules,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [availabilitySchedules.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const scheduleOverridesRelations = relations(
  scheduleOverrides,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [scheduleOverrides.tenantId],
      references: [tenants.id],
    }),
  }),
);

// --- Checklist relations ---
export const checklistTemplatesRelations = relations(
  checklistTemplates,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [checklistTemplates.tenantId],
      references: [tenants.id],
    }),
    items: many(checklistItems),
  }),
);

export const checklistItemsRelations = relations(
  checklistItems,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [checklistItems.tenantId],
      references: [tenants.id],
    }),
    template: one(checklistTemplates, {
      fields: [checklistItems.templateId],
      references: [checklistTemplates.id],
    }),
    catalogItem: one(catalogItems, {
      fields: [checklistItems.catalogItemId],
      references: [catalogItems.id],
    }),
  }),
);

export const jobChecklistCompletionsRelations = relations(
  jobChecklistCompletions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [jobChecklistCompletions.tenantId],
      references: [tenants.id],
    }),
    job: one(jobs, {
      fields: [jobChecklistCompletions.jobId],
      references: [jobs.id],
    }),
    checklistItem: one(checklistItems, {
      fields: [jobChecklistCompletions.checklistItemId],
      references: [checklistItems.id],
    }),
    completedByUser: one(user, {
      fields: [jobChecklistCompletions.completedBy],
      references: [user.id],
    }),
  }),
);

// --- Admin relations ---
export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  adminUser: one(user, {
    fields: [adminAuditLog.adminUserId],
    references: [user.id],
  }),
  targetTenant: one(tenants, {
    fields: [adminAuditLog.targetTenantId],
    references: [tenants.id],
  }),
}));

export const adminImpersonationSessionsRelations = relations(
  adminImpersonationSessions,
  ({ one }) => ({
    adminUser: one(user, {
      fields: [adminImpersonationSessions.adminUserId],
      references: [user.id],
    }),
    tenant: one(tenants, {
      fields: [adminImpersonationSessions.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const platformEventsRelations = relations(
  platformEvents,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [platformEvents.tenantId],
      references: [tenants.id],
    }),
  }),
);
