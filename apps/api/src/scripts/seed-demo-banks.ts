/**
 * Static content for the demo dataset: names, places, the catalog, the tag set,
 * checklist templates and the text banks the job templates draw from.
 *
 * Pure data. The generator in seed-demo-dataset.ts decides *which* of it to use
 * and *when*; nothing here knows what day it is.
 *
 * The tenant is a small, HVAC-first trades business ("Shihab Roofing Corp" is
 * the tenant's name and is left alone). Nothing about the platform is trade
 * specific — only these strings are. All contact details are fictional: phone
 * numbers sit in the reserved 555-01xx block and every email is on an
 * example.* domain, which can never deliver to a real inbox.
 */

import type {
  CatalogSpec,
  ChecklistTemplateSpec,
  TagSpec,
  TenantProfile,
} from "./seed-demo-types.js";

export const TENANT_PROFILE: TenantProfile = {
  ownerName: "Shihab Hossain",
  phone: "(512) 555-0147",
  address: "2214 Burnet Road, Suite B",
  city: "Austin",
  state: "TX",
  zipCode: "78756",
  licenseNumber: "TACLA-118422E",
  /** numeric(5,4) as text: 8.25% Austin sales tax. */
  defaultTaxRate: "0.0825",
  invoicePaymentTerms: "Net 15",
  invoicePaymentInstructions:
    "Pay online with the button above, or by check made out to Shihab Roofing Corp. Cards accepted on site.",
  invoiceTermsConditions:
    "Balance is due within 15 days of the invoice date. Labour is warranted for one year; parts carry the manufacturer's warranty.",
  invoiceFooterMessage: "Thanks for choosing us — we appreciate the referral too.",
  quoteTermsConditions:
    "Pricing holds for 30 days. Final cost may change if additional work is found once the job is opened up; we will call you before doing anything that is not on this quote.",
  quoteFooterMessage: "Questions? Call (512) 555-0147 and ask for Shihab.",
  googleReviewUrl: "https://g.page/r/shihab-roofing-austin/review",
  bookingSlotCapacity: 2,
};

/* ── catalog ───────────────────────────────────────────────────────────────
   Every name a job template refers to lives in CAT, so a typo is a compile
   error rather than a runtime "unknown catalog item".

   Labour lines carry unit_cost 0, and that is deliberate. The costing service
   adds `line_items.cost_total` AND `time_entries.hours x hourly_cost_rate`
   (services/costing/costing.service.ts). A labour line costed at the technician's
   loaded rate would therefore count the same hour twice and make nearly every
   job look like it lost money. Labour is costed once, from the time entries; a
   labour line adds no separate cost. Flat-rate service items carry only the
   consumables they use, for the same reason.

   Three parts (floatSwitch, flueKit, mastic) have NO cost on purpose, so the
   "incomplete margin" state is exercised by real jobs. */

export const CAT = {
  serviceCall: "Service call & diagnostic",
  labour: "Labour — standard",
  labourAfterHours: "Labour — after hours / emergency",
  acTuneup: "AC tune-up (flat rate)",
  furnaceTuneup: "Furnace tune-up (flat rate)",
  ductCleaning: "Duct cleaning — whole home",
  drainFlush: "Condensate drain flush",
  roofRepair: "Roof flashing / pipe boot repair",
  capacitor: "Run capacitor 45/5 MFD",
  contactor: "Contactor 30A 2-pole",
  fanMotor: "Condenser fan motor 1/4 HP",
  blowerMotor: "ECM blower motor",
  ignitor: "Hot surface ignitor",
  thermostat: "Smart thermostat",
  filter: "Air filter 16x25x1 (MERV 8)",
  floatSwitch: "Float switch / drain-pan sensor",
  flueKit: "Flue pipe & vent fittings",
  mastic: "Duct mastic & seal kit",
  refrigerant: "Refrigerant R-410A",
  lineSet: "Copper line set (25 ft)",
  condenser: "Condenser — 3 ton, 14.3 SEER2",
  airHandler: "Air handler with coil — 3 ton",
  furnace: "Gas furnace — 80% AFUE, 80k BTU",
  permit: "Permit & inspection fee",
  disposal: "Old equipment disposal",
  misc: "Misc. materials & fasteners",
} as const;

export const CATALOG: CatalogSpec[] = [
  { name: CAT.serviceCall, itemType: "service_call", unitPrice: 89, unitCost: 4, unit: "visit", category: "Service Calls", description: "Trip charge and diagnostic. Credited toward the repair when you approve it." },
  { name: CAT.labour, itemType: "labor", unitPrice: 95, unitCost: 0, unit: "hour", category: "Labour", description: "Technician time, billed per hour." },
  { name: CAT.labourAfterHours, itemType: "labor", unitPrice: 145, unitCost: 0, unit: "hour", category: "Labour", description: "Evenings, weekends and emergency call-outs, billed per hour." },
  { name: CAT.acTuneup, itemType: "service_call", unitPrice: 149, unitCost: 16, unit: "visit", category: "Maintenance", description: "Cooling tune-up: coil, electrical, refrigerant check, condensate drain and filter." },
  { name: CAT.furnaceTuneup, itemType: "service_call", unitPrice: 139, unitCost: 14, unit: "visit", category: "Maintenance", description: "Heating tune-up: burners, heat exchanger check, safeties, gas pressure and filter." },
  { name: CAT.ductCleaning, itemType: "service_call", unitPrice: 389, unitCost: 42, unit: "visit", category: "Maintenance", description: "Whole-home supply and return duct cleaning." },
  { name: CAT.drainFlush, itemType: "service_call", unitPrice: 119, unitCost: 8, unit: "visit", category: "Maintenance", description: "Flush and treat the condensate line, test the safety switch." },
  { name: CAT.roofRepair, itemType: "service_call", unitPrice: 285, unitCost: 41, unit: "each", category: "Roof & Exterior", description: "Reflash or replace a pipe boot or vent flashing and reseal." },
  { name: CAT.capacitor, itemType: "part", unitPrice: 85, unitCost: 41, unit: "each", category: "Electrical", description: "Dual-run capacitor for the condenser." },
  { name: CAT.contactor, itemType: "part", unitPrice: 74, unitCost: 36, unit: "each", category: "Electrical", description: "30A two-pole contactor." },
  { name: CAT.fanMotor, itemType: "part", unitPrice: 325, unitCost: 176, unit: "each", category: "Motors", description: "Condenser fan motor, 1/4 HP." },
  { name: CAT.blowerMotor, itemType: "part", unitPrice: 645, unitCost: 372, unit: "each", category: "Motors", description: "Variable-speed ECM blower motor." },
  { name: CAT.ignitor, itemType: "part", unitPrice: 119, unitCost: 58, unit: "each", category: "Heating Parts", description: "Hot surface ignitor." },
  { name: CAT.thermostat, itemType: "part", unitPrice: 189, unitCost: 112, unit: "each", category: "Controls", description: "Wi-Fi smart thermostat." },
  { name: CAT.filter, itemType: "part", unitPrice: 18, unitCost: 9, unit: "each", category: "Filters", description: "16x25x1 pleated air filter, MERV 8." },
  { name: CAT.floatSwitch, itemType: "part", unitPrice: 48, unitCost: null, unit: "each", category: "Controls", description: "Condensate float switch / drain-pan sensor." },
  { name: CAT.flueKit, itemType: "part", unitPrice: 58, unitCost: null, unit: "kit", category: "Heating Parts", description: "Flue pipe, collar and vent fittings." },
  { name: CAT.mastic, itemType: "material", unitPrice: 36, unitCost: null, unit: "kit", category: "Ductwork", description: "Duct mastic, mesh tape and sealing kit." },
  { name: CAT.refrigerant, itemType: "material", unitPrice: 65, unitCost: 29, unit: "lb", category: "Refrigerant", description: "R-410A refrigerant, per pound." },
  { name: CAT.lineSet, itemType: "material", unitPrice: 210, unitCost: 128, unit: "each", category: "Refrigerant", description: "Insulated copper line set, 25 ft." },
  { name: CAT.condenser, itemType: "part", unitPrice: 3150, unitCost: 1880, unit: "each", category: "Equipment", description: "3-ton condenser, 14.3 SEER2." },
  { name: CAT.airHandler, itemType: "part", unitPrice: 2450, unitCost: 1420, unit: "each", category: "Equipment", description: "3-ton air handler with matched evaporator coil." },
  { name: CAT.furnace, itemType: "part", unitPrice: 2150, unitCost: 1290, unit: "each", category: "Equipment", description: "80% AFUE, 80,000 BTU gas furnace." },
  { name: CAT.permit, itemType: "other", unitPrice: 125, unitCost: 95, unit: "each", category: "Fees", description: "Mechanical permit and inspection fee, passed through." },
  { name: CAT.disposal, itemType: "other", unitPrice: 85, unitCost: 40, unit: "each", category: "Fees", description: "Recovery and disposal of the old equipment." },
  { name: CAT.misc, itemType: "other", unitPrice: 40, unitCost: 18, unit: "each", category: "Materials", description: "Fasteners, sealant, tape and small fittings." },
];

/* ── tags ──────────────────────────────────────────────────────────────────
   Hex colours: the Customers UI renders them as CSS values, so colour *names*
   such as "violet" or "amber" do not paint. */

export const TAGS: TagSpec[] = [
  { name: "VIP", color: "#8b5cf6" },
  { name: "Maintenance plan", color: "#22c55e" },
  { name: "Landlord", color: "#3b82f6" },
  { name: "Commercial", color: "#6b7280" },
  { name: "Referral", color: "#f97316" },
  { name: "Repeat customer", color: "#eab308" },
  { name: "Past due", color: "#ef4444" },
  { name: "Warranty", color: "#ec4899" },
];

/* ── checklists ────────────────────────────────────────────────────────────
   One active template per service type — `attachChecklistToJob` takes the
   first match. Consultation and "other" have none, so jobs of those types are
   created without a checklist, exactly as in the app. */

export const CHECKLISTS: ChecklistTemplateSpec[] = [
  {
    serviceType: "installation",
    name: "Equipment installation",
    items: [
      { label: "Confirm the permit is posted and utilities are located", required: true },
      { label: "Protect floors and set up staging", required: true },
      { label: "Recover refrigerant and remove the old equipment", required: true },
      { label: "Set the new equipment, level and secure it", required: true },
      { label: "Braze the line set and pressure-test with nitrogen", required: true },
      { label: "Pull a vacuum to 500 microns and hold", required: true },
      { label: "Connect electrical, disconnect and condensate drain", required: false },
      { label: "Commission: charge, superheat/subcooling and airflow", required: false },
      { label: "Program the thermostat and walk the customer through it", required: false },
      { label: "Clean up, haul away the old unit and photograph the install", required: false },
    ],
  },
  {
    serviceType: "repair",
    name: "Repair visit",
    items: [
      { label: "Confirm the complaint with the customer", required: true },
      { label: "Photograph the data plate and the fault", required: true },
      { label: "Diagnose with gauges and meter and note the readings", required: true },
      { label: "Get approval before using any parts", required: false },
      { label: "Complete the repair", required: false },
      { label: "Run the system through a full cycle", required: false },
      { label: "Clear the work area and review the invoice", required: false },
    ],
  },
  {
    serviceType: "maintenance",
    name: "Seasonal tune-up",
    items: [
      { label: "Replace or clean the air filter", required: true },
      { label: "Inspect electrical connections and test the capacitor", required: true },
      { label: "Check refrigerant pressures or gas manifold pressure", required: true },
      { label: "Clean the condenser coil or burners", required: false },
      { label: "Flush the condensate drain and test the float switch", required: false },
      { label: "Test the thermostat and safety controls", required: false },
      { label: "Record readings and photograph the unit", required: false },
    ],
  },
  {
    serviceType: "inspection",
    name: "Diagnostic visit",
    items: [
      { label: "Interview the customer about the symptoms", required: true },
      { label: "Visually inspect the indoor and outdoor units", required: true },
      { label: "Take meter, gauge and temperature-split readings", required: true },
      { label: "Write up findings and options", required: false },
      { label: "Send the report", required: false },
    ],
  },
  {
    serviceType: "emergency",
    name: "Emergency call-out",
    items: [
      { label: "Safety check: gas, carbon monoxide and electrical", required: true },
      { label: "Restore comfort or make the system safe", required: true },
      { label: "Photograph the fault and the parts replaced", required: true },
      { label: "Explain what failed and what comes next", required: false },
      { label: "Book any follow-up work", required: false },
    ],
  },
];

/* ── people and places ─────────────────────────────────────────────────── */

export const FIRST_NAMES: readonly string[] = [
  "James", "Maria", "Robert", "Linda", "Michael", "Priya", "David", "Sofia", "Carlos", "Aaliyah",
  "Daniel", "Mei", "Thomas", "Fatima", "Kevin", "Hannah", "Andre", "Rosa", "Brian", "Naomi",
  "Luis", "Emily", "Omar", "Grace", "Tyler", "Valentina", "Jamal", "Chloe", "Ethan", "Isabel",
  "Marcus", "Nina", "Samuel", "Tanya", "Victor", "Whitney", "Raj", "Dana", "Felix", "Gloria",
  "Hector", "Irene", "Jerome", "Keisha",
];

export const LAST_NAMES: readonly string[] = [
  "Alvarez", "Brooks", "Castillo", "Dawson", "Ellison", "Fitzgerald", "Gutierrez", "Hammond", "Ibarra", "Jennings",
  "Kowalski", "Lambert", "Mendoza", "Nguyen", "Okafor", "Patel", "Quintero", "Reyes", "Sullivan", "Thornton",
  "Underwood", "Vasquez", "Whitaker", "Xiong", "Yoon", "Zimmerman", "Abbott", "Bishop", "Coleman", "Delgado",
  "Escobar", "Foster", "Grant", "Holloway", "Iyer", "Jordan", "Kim", "Larsen", "Moreno", "Navarro",
  "Ortiz", "Pruitt", "Rivera", "Soto",
];

export const STREETS: readonly string[] = [
  "Ramsey Ave", "Kinney Ave", "Duval St", "Manchaca Rd", "Balcones Dr", "Bouldin Ave", "Alta Vista Ave",
  "Red River St", "Burnet Rd", "Lamar Blvd", "Manor Rd", "Oltorf St", "Riverside Dr", "Guadalupe St",
  "Anderson Ln", "Research Blvd", "Slaughter Ln", "Parmer Ln", "Rutland Dr", "Cameron Rd", "Springdale Rd",
  "Airport Blvd", "Bee Cave Rd", "Dessau Rd", "Braker Ln", "Brodie Ln", "Menchaca Rd", "Westlake Dr",
  "Barton Hills Dr", "Windsor Rd", "Enfield Rd", "Koenig Ln", "Justin Ln", "Shoal Creek Blvd", "Mueller Blvd",
  "Chicon St", "Cesar Chavez St", "Live Oak St", "Oak Hill Dr", "Wells Branch Pkwy",
];

/** City and a plausible ZIP. Everything within a short drive of Austin. */
export const PLACES: readonly { city: string; zipCode: string }[] = [
  { city: "Austin", zipCode: "78701" },
  { city: "Austin", zipCode: "78702" },
  { city: "Austin", zipCode: "78704" },
  { city: "Austin", zipCode: "78705" },
  { city: "Austin", zipCode: "78721" },
  { city: "Austin", zipCode: "78723" },
  { city: "Austin", zipCode: "78731" },
  { city: "Austin", zipCode: "78745" },
  { city: "Austin", zipCode: "78749" },
  { city: "Austin", zipCode: "78756" },
  { city: "Austin", zipCode: "78757" },
  { city: "Austin", zipCode: "78758" },
  { city: "Austin", zipCode: "78759" },
  { city: "Round Rock", zipCode: "78664" },
  { city: "Round Rock", zipCode: "78681" },
  { city: "Pflugerville", zipCode: "78660" },
  { city: "Cedar Park", zipCode: "78613" },
  { city: "Leander", zipCode: "78641" },
  { city: "Georgetown", zipCode: "78628" },
  { city: "Kyle", zipCode: "78640" },
];

export const EMAIL_DOMAINS: readonly { value: string; weight: number }[] = [
  { value: "example.com", weight: 6 },
  { value: "example.net", weight: 3 },
  { value: "example.org", weight: 1 },
];

export const CUSTOMER_NOTES: readonly string[] = [
  "Prefers a text message before the tech arrives.",
  "Dog in the back yard — latch the gate behind you.",
  "Call the day before; works from home and likes to be in the house.",
  "Pays by check and mails it within the week.",
  "Referred by a neighbour — remember the referral discount on the next quote.",
  "Thermostat is in the hallway. Booties on, please.",
  "Wants photos of any problem before approving a repair.",
  "Prefers morning appointments; the afternoon sun is on the unit.",
  "Attic access is a pull-down ladder in the garage.",
  "Landlord of three rentals — each property has its own invoice.",
  "Key is in the lockbox on the side gate. Code is on the job.",
  "Elderly occupant — treat no-cool calls as urgent in summer.",
  "Asked about financing for a full system replacement next year.",
  "Has a window unit as backup; no rush on non-emergency repairs.",
];

export const BUSINESS_NOTE_ADDENDA: readonly string[] = [
  "Bills to the property LLC, not to the contact personally.",
  "Roof-top units; roof hatch key is held by the building manager.",
  "Open Tue–Sat. Service before 10am or after 3pm to avoid the lunch rush.",
];

/* ── equipment ───────────────────────────────────────────────────────────── */

export interface EquipmentModel {
  family: "cooling" | "heating" | "other";
  equipmentType: string;
  brand: string;
  model: string;
  location: string;
}

export const EQUIPMENT_MODELS: readonly EquipmentModel[] = [
  { family: "cooling", equipmentType: "Central AC condenser", brand: "Carrier", model: "24ACC636A003", location: "Backyard — east side" },
  { family: "cooling", equipmentType: "Central AC condenser", brand: "Trane", model: "4TTR4036L1000A", location: "Side yard" },
  { family: "cooling", equipmentType: "Central AC condenser", brand: "Lennox", model: "XC21-036-230", location: "Backyard — by the fence" },
  { family: "cooling", equipmentType: "Central AC condenser", brand: "Goodman", model: "GSXC180361", location: "Side yard" },
  { family: "cooling", equipmentType: "Central AC condenser", brand: "Rheem", model: "RA1636AJ1NA", location: "Backyard" },
  { family: "cooling", equipmentType: "Central AC condenser", brand: "Daikin", model: "DX16SA0361", location: "Side yard — north" },
  { family: "cooling", equipmentType: "Heat pump", brand: "Carrier", model: "25HCE436A003", location: "Backyard" },
  { family: "cooling", equipmentType: "Ductless mini-split", brand: "Mitsubishi", model: "MUZ-FS12NA", location: "Garage conversion" },
  { family: "heating", equipmentType: "Gas furnace", brand: "Carrier", model: "59TP6A060M1417", location: "Attic" },
  { family: "heating", equipmentType: "Gas furnace", brand: "Trane", model: "S9V2B060U3PSAB", location: "Hall closet" },
  { family: "heating", equipmentType: "Gas furnace", brand: "Lennox", model: "SL280V", location: "Attic" },
  { family: "heating", equipmentType: "Gas furnace", brand: "Goodman", model: "GMVC960603BN", location: "Garage" },
  { family: "heating", equipmentType: "Gas furnace", brand: "Rheem", model: "R801TA060317MSA", location: "Utility room" },
  { family: "other", equipmentType: "Tankless water heater", brand: "Rinnai", model: "RU199iN", location: "Garage wall" },
];

/* ── job text ────────────────────────────────────────────────────────────── */

export const JOB_TEXT: Record<string, { titles: readonly string[]; descriptions: readonly string[] }> = {
  acRepair: {
    titles: ["AC not cooling", "AC won't start", "Outdoor unit not running", "AC freezing up", "Warm air from vents"],
    descriptions: [
      "Unit runs but the house will not drop below 80. Customer reports the outdoor fan is not always spinning.",
      "AC cuts out after ten minutes. Breaker has not tripped.",
      "Ice on the refrigerant line and weak airflow since yesterday.",
      "Outdoor unit hums but the compressor does not start.",
      "Upstairs is much warmer than downstairs; system runs constantly.",
    ],
  },
  furnaceRepair: {
    titles: ["Furnace not heating", "No heat call", "Furnace short-cycling", "Furnace blower noise"],
    descriptions: [
      "Furnace tries to light and shuts off after a few seconds.",
      "No heat since last night; thermostat is calling but nothing happens.",
      "Furnace turns on and off every couple of minutes.",
      "Loud rattling from the blower when the heat starts.",
    ],
  },
  acTuneup: {
    titles: ["AC tune-up"],
    descriptions: [
      "Annual cooling tune-up: coil, electrical, refrigerant check and drain.",
      "Pre-summer maintenance visit on the outdoor and indoor units.",
    ],
  },
  furnaceTuneup: {
    titles: ["Furnace tune-up"],
    descriptions: [
      "Annual heating tune-up before the cold weather: burners, safeties and gas pressure.",
      "Pre-season furnace maintenance visit.",
    ],
  },
  comboTuneup: {
    titles: ["Seasonal tune-up (AC + furnace)"],
    descriptions: [
      "Combined heating and cooling tune-up at the changeover.",
      "Both systems serviced in one visit.",
    ],
  },
  diagnostic: {
    titles: ["System diagnostic", "Diagnostic visit", "Performance check"],
    descriptions: [
      "Uneven temperatures between floors. Full airflow and temperature-split check.",
      "Higher energy bills than last year; check system performance.",
      "Strange smell when the system starts; inspect and report.",
    ],
  },
  thermostatSwap: {
    titles: ["Smart thermostat install", "Thermostat replacement"],
    descriptions: [
      "Replace the old thermostat with a Wi-Fi model and set up the app.",
      "Thermostat is blank. Replace and test heating and cooling.",
    ],
  },
  drainFlush: {
    titles: ["Condensate drain clog", "Drain line flush"],
    descriptions: [
      "Water pooling under the indoor unit. Clear the drain and test the safety switch.",
      "Float switch keeps shutting the AC off. Flush the line.",
    ],
  },
  blowerReplace: {
    titles: ["Blower motor replacement"],
    descriptions: [
      "Blower motor seized. Replace with a variable-speed ECM motor and test airflow.",
    ],
  },
  ductClean: {
    titles: ["Duct cleaning"],
    descriptions: [
      "Whole-home supply and return duct cleaning after renovation dust.",
    ],
  },
  roofRepair: {
    titles: ["Roof vent flashing leak", "Pipe boot repair"],
    descriptions: [
      "Water stain on the ceiling below a plumbing vent. Reflash and reseal the penetration.",
      "Cracked pipe boot letting water into the attic.",
    ],
  },
  handyman: {
    titles: ["General repair", "Odd jobs and repairs"],
    descriptions: [
      "Punch list of small repairs: attic hatch, return grille, loose duct hanger.",
      "Re-hang a sagging flex duct and replace two supply registers.",
    ],
  },
  emergency: {
    titles: ["Emergency — no cooling", "Emergency — no heat", "After-hours call-out"],
    descriptions: [
      "No cooling and an elderly resident in the house. Same-evening call-out.",
      "No heat overnight with the temperature dropping.",
      "Burning smell from the unit; system shut off at the breaker.",
    ],
  },
  warranty: {
    titles: ["Warranty callback"],
    descriptions: [
      "Follow-up visit on recent work, covered under our one-year labour warranty.",
    ],
  },
  estimate: {
    titles: ["Free estimate"],
    descriptions: [
      "On-site estimate for equipment replacement. Measure, check ductwork and discuss options.",
    ],
  },
  installSystem: {
    titles: ["Full AC system replacement"],
    descriptions: [
      "Replace the condenser, air handler and line set. Two-day install including permit and commissioning.",
    ],
  },
  installFurnace: {
    titles: ["Furnace replacement"],
    descriptions: [
      "Remove the old furnace and install a new 80% AFUE unit with new flue and thermostat.",
    ],
  },
  ductCombo: {
    titles: ["Duct sealing and cleaning"],
    descriptions: [
      "Seal leaking trunk joints with mastic and clean the whole duct system.",
    ],
  },
  rtuRepair: {
    titles: ["Rooftop unit repair"],
    descriptions: [
      "Rooftop unit short-cycling during service hours. Replace the failed motor and recheck the economiser.",
    ],
  },
  gutterFlash: {
    titles: ["Flashing and vent repair"],
    descriptions: [
      "Reflash two roof vents and the furnace flue cap, reseal the penetrations.",
    ],
  },
  thermostatUpgrade: {
    titles: ["Dual smart thermostat upgrade"],
    descriptions: [
      "Install two smart thermostats and rebalance the zones.",
    ],
  },
};

export const BOOKING_DESCRIPTIONS: Record<string, readonly string[]> = {
  repair: [
    "The AC is running but the house will not cool below 82.",
    "Furnace clicks and then shuts off after a minute.",
    "Water dripping from the indoor unit onto the floor.",
    "Outdoor fan is not spinning but the unit hums.",
    "Thermostat screen is blank and nothing responds.",
  ],
  maintenance: [
    "Annual tune-up before the season.",
    "Haven't had the furnace serviced in two years.",
    "Drain line keeps clogging — flush and check please.",
    "Want the AC looked at before summer is over.",
  ],
  inspection: [
    "Buying the house — need an HVAC inspection before closing.",
    "System is 12 years old; want to know how much life is left.",
    "Uneven temperatures between the floors.",
  ],
  emergency: [
    "No heat and it is cold out tonight.",
    "AC is out and there is an elderly parent in the house.",
    "Burning smell from the furnace.",
  ],
  installation: [
    "Need a quote to replace the whole system.",
    "Looking to add a second zone upstairs.",
  ],
  consultation: [
    "Free estimate for a new system, please.",
    "Considering a heat pump — would like to talk options.",
  ],
};

export const DECLINE_REASONS: readonly string[] = [
  "Went with a lower bid from another company.",
  "Decided to wait until next season.",
  "Getting a second opinion first.",
  "Over budget right now; may revisit in the spring.",
];

export const CANCEL_REASONS: readonly string[] = [
  "Customer rescheduled with another contractor.",
  "Problem went away on its own; customer cancelled.",
  "Customer is out of town and will rebook.",
  "Tenant was not home and the owner asked to cancel.",
];

/* ── expenses ────────────────────────────────────────────────────────────── */

export const VENDORS = {
  supply: ["Johnstone Supply", "Ferguson HVAC", "Home Depot", "Hill Country Supply"],
  fuel: ["Shell", "Buc-ee's", "Valero"],
  permit: ["City of Austin Development Services"],
  electrician: ["Capitol Electric"],
  crane: ["Lone Star Crane & Rigging"],
  rental: ["Hill Country Rentals"],
  dump: ["Austin Recycling Center"],
} as const;
