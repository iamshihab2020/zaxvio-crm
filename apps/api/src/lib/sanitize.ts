/**
 * Strip HTML tags and entities from a string.
 * Used to prevent stored XSS in fields rendered in emails and PDFs.
 */
export function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // remove HTML tags
    .replace(/&[a-zA-Z0-9#]+;/g, "") // remove HTML entities
    .trim();
}
