import { z } from "zod";

export const updateTenantBody = z.object({
  businessName: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  googleReviewUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")).nullable(),
  timezone: z.string().optional(),
  licenseNumber: z.string().optional(),
  invoicePaymentTerms: z.string().optional(),
  invoicePaymentInstructions: z.string().optional(),
  invoiceTermsConditions: z.string().optional(),
  invoiceFooterMessage: z.string().optional(),
  quoteTermsConditions: z.string().optional(),
  quoteFooterMessage: z.string().optional(),
});

export const uploadLogoBody = z.object({
  data: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().regex(/^image\//),
});
