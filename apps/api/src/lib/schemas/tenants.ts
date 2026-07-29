import { z } from "zod";

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

export { ALLOWED_EXTENSIONS };

export const updateTenantBody = z.object({
  businessName: z.string().min(1).max(200).optional(),
  ownerName: z.string().min(1).max(200).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  state: z.string().max(200).optional(),
  zipCode: z.string().max(20).optional(),
  /**
   * A **fraction**, not a percentage: 0.0825 is 8.25%. That is how every reader
   * treats it — `recalculateInvoice` multiplies the subtotal by it directly,
   * and the PDF multiplies by 100 to print it — and the UI divides by 100
   * before sending. So `max(100)` was a bound in the wrong unit and permitted a
   * 10,000% tax rate to be set through the API (INV-40).
   */
  defaultTaxRate: z.coerce.number().min(0).max(1).optional(),
  googleReviewUrl: z
    .string()
    .url()
    .max(2000)
    .refine((u) => u.startsWith("https://") || u.startsWith("http://"), {
      message: "URL must use http or https protocol",
    })
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().url().max(2000).optional().or(z.literal("")).nullable(),
  timezone: z.string().max(100).optional(),
  licenseNumber: z.string().max(100).optional(),
  invoicePaymentTerms: z.string().max(500).optional(),
  invoicePaymentInstructions: z.string().max(2000).optional(),
  invoiceTermsConditions: z.string().max(5000).optional(),
  invoiceFooterMessage: z.string().max(1000).optional(),
  quoteTermsConditions: z.string().max(5000).optional(),
  quoteFooterMessage: z.string().max(1000).optional(),
  quoteOnlineAcceptanceEnabled: z.boolean().optional(),
  quotePostAcceptanceScheduling: z.boolean().optional(),
  quoteAutoConvertToJob: z.boolean().optional(),
});

export const uploadLogoBody = z.object({
  data: z.string().min(1),
  filename: z
    .string()
    .min(1)
    .max(255)
    .refine((f) => !/[/\\:]/.test(f), {
      message: "Filename contains invalid characters",
    })
    .refine(
      (f) => {
        const ext = f.split(".").pop()?.toLowerCase();
        return ext !== undefined && ALLOWED_EXTENSIONS.includes(ext);
      },
      { message: "Invalid file extension — allowed: png, jpg, jpeg, webp, gif" },
    ),
  mimeType: z.enum(ALLOWED_IMAGE_TYPES),
});
