/** HVAC-relevant units ordered by frequency of use */
export const CATALOG_UNITS = [
  "each",
  "hour",
  "sq ft",
  "linear ft",
  "lb",
  "gallon",
  "ton",
  "unit",
  "set",
  "roll",
  "box",
  "bag",
  "pair",
  "trip",
  "flat rate",
] as const;

/** HVAC-specific categories in alphabetical order */
export const CATALOG_CATEGORIES = [
  "Air Quality",
  "Capacitors & Electrical",
  "Compressors",
  "Controls & Thermostats",
  "Ductwork",
  "Filters",
  "General Parts",
  "Installation",
  "Labor",
  "Maintenance",
  "Motors & Fans",
  "Plumbing",
  "Refrigerant",
  "Service Calls",
  "Sheet Metal",
  "Tools & Equipment",
  "Warranties",
] as const;
