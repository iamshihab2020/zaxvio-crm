// Drizzle client
export { getDb, closeDb } from "./client";


// Schema (tables, enums, relations)
export * from "./schema/index";

// Re-export drizzle-orm operators so consumers use the same instance
export { eq, and, or, ne, not, gt, gte, lt, lte, inArray, notInArray, isNull, isNotNull, sql, ilike, desc, asc, count, countDistinct } from "drizzle-orm";
export type { SQL } from "drizzle-orm";
