/**
 * The demo dataset generator: two months of a small trades business.
 *
 * `buildDemoDataset(today)` returns a `DemoDataset` (seed-demo-types.ts): every
 * record the writer in seed-demo-data.ts inserts, with relationships as array
 * indexes and every date as a day offset from `today` plus a wall-clock time.
 * Pure: no database, no clock. The same `today` always gives the same data,
 * because all randomness comes from one seeded PRNG.
 *
 * How it hangs together
 * ---------------------
 * The business is one owner-technician, so the schedule is a real constraint:
 * a `Board` holds every working day (Mon–Fri, minus the closed days) and a job
 * is placed in the first gap after its lead time, at most three jobs a day,
 * with travel time between them. Demand is processed in the order it was
 * created, so the board fills the way a real calendar does.
 *
 * - Customers who arrive in the window come in through the booking portal
 *   (a booking, then a job when it is confirmed) or by phone (a job).
 * - An estimate visit produces a quote. An accepted quote produces the
 *   install job, scheduled after the acceptance, with the quote's own lines.
 * - What has happened is decided by the date: work before today is done (a few
 *   cancelled, a couple waiting on parts), work after today is scheduled.
 * - Completed billable jobs get an invoice; payments follow the invoice's age,
 *   so older invoices are mostly paid and a handful are overdue.
 * - Hours come from time entries and costs from catalog unit costs and job
 *   expenses, so the Costs tab and the profitability report have real inputs.
 *   Three catalog parts have no cost on purpose, so some margins are
 *   incomplete, and a few jobs have no time logged.
 */

import type {
  BookingSource,
  BookingSpec,
  CalendarEventSpec,
  ChecklistTick,
  ContractSpec,
  CustomerNoteSpec,
  CustomerSegment,
  CustomerSource,
  CustomerSpec,
  DemoDataset,
  EquipmentSpec,
  ExpenseSpec,
  InvoiceSpec,
  JobSpec,
  Lifecycle,
  LineSpec,
  NotificationSpec,
  PaymentMethod,
  PaymentSpec,
  Priority,
  QuoteSpec,
  QuoteStatus,
  ScheduleOverrideSpec,
  ServiceType,
  TimeEntrySpec,
  When,
} from "./seed-demo-types.js";
import {
  createCalendar,
  createRng,
  roundMoney,
  toHhmm,
  toMinutes,
  type DemoCalendar,
  type Rng,
  type Weighted,
} from "./seed-demo-rng.js";
import {
  BOOKING_DESCRIPTIONS,
  BUSINESS_NOTE_ADDENDA,
  CANCEL_REASONS,
  CAT,
  CATALOG,
  CHECKLISTS,
  CUSTOMER_NOTES,
  DECLINE_REASONS,
  EMAIL_DOMAINS,
  EQUIPMENT_MODELS,
  FIRST_NAMES,
  JOB_TEXT,
  LAST_NAMES,
  PLACES,
  STREETS,
  TAGS,
  TENANT_PROFILE,
  VENDORS,
  type EquipmentModel,
} from "./seed-demo-banks.js";

/* ── knobs ─────────────────────────────────────────────────────────────── */

const SEED = 0x2e5eed;
/** How far back the dataset reaches, and how far ahead the schedule runs. */
const PAST_DAYS = 60;
const AHEAD_DAYS = 14;
/** Installs booked from a quote may land a little past the window. */
const INSTALL_HORIZON = 24;
/** Loaded hourly cost of the owner's time (wage plus burden). */
export const DEFAULT_LABOR_COST_RATE = 42;

const OPEN = toMinutes("08:00");
const CLOSE = toMinutes("17:00");
const FULL_DAY_END = toMinutes("16:30");
const TRAVEL = 30;
const MAX_JOBS_PER_DAY = 3;

/** Days to pay: TENANT_PROFILE.invoicePaymentTerms is "Net 15". */
const NET_DAYS = 15;

const ESTABLISHED_CUSTOMERS = 14;
const NEW_CUSTOMERS = 23;
/** Established customer who moved away during the window. */
const ARCHIVED_CUSTOMER = 13;
/** Established customer who unsubscribed from email. */
const OPTED_OUT_CUSTOMER = 9;

/* ── seasons ───────────────────────────────────────────────────────────── */

type Season = "cooling" | "changeover" | "heating";

function seasonForMonth(month: number): Season {
  if (month >= 6 && month <= 9) return "cooling";
  if (month === 12 || month <= 2) return "heating";
  return "changeover";
}

/* ── job kinds ─────────────────────────────────────────────────────────── */

type KindName =
  | "acRepair"
  | "furnaceRepair"
  | "acTuneup"
  | "furnaceTuneup"
  | "comboTuneup"
  | "diagnostic"
  | "thermostatSwap"
  | "drainFlush"
  | "blowerReplace"
  | "ductClean"
  | "roofRepair"
  | "handyman"
  | "emergency"
  | "warranty"
  | "estimate"
  | "installSystem"
  | "installFurnace"
  | "ductCombo"
  | "rtuRepair"
  | "gutterFlash"
  | "thermostatUpgrade";

type LineBuilder = (name: string, quantity: number) => LineSpec;

interface KindSpec {
  serviceType: ServiceType;
  text: string;
  /** Planned minutes; one is picked per job. */
  minutes: readonly number[];
  /** Whole working days (installs). Absent for jobs that fit in a gap. */
  fullDays?: number;
  family: "cooling" | "heating" | "other";
  lines: (L: LineBuilder, rng: Rng, season: Season) => LineSpec[];
}

const KINDS: Record<KindName, KindSpec> = {
  acRepair: {
    serviceType: "repair",
    text: "acRepair",
    minutes: [90, 120, 150],
    family: "cooling",
    lines: (L, rng) => {
      const out = [L(CAT.serviceCall, 1), L(CAT.labour, rng.step(1, 2, 0.5))];
      const fix = rng.weighted<number>([
        { value: 0, weight: 4 },
        { value: 1, weight: 3 },
        { value: 2, weight: 2 },
        { value: 3, weight: 2 },
      ]);
      if (fix === 0) out.push(L(CAT.capacitor, 1));
      if (fix === 1) out.push(L(CAT.contactor, 1));
      if (fix === 2) out.push(L(CAT.fanMotor, 1), L(CAT.misc, 1));
      if (fix === 3) out.push(L(CAT.refrigerant, rng.int(2, 4)), L(CAT.misc, 1));
      return out;
    },
  },
  furnaceRepair: {
    serviceType: "repair",
    text: "furnaceRepair",
    minutes: [90, 120],
    family: "heating",
    lines: (L, rng) => {
      const out = [L(CAT.serviceCall, 1), L(CAT.labour, rng.pick([1, 1.5]))];
      const roll = rng.next();
      if (roll < 0.6) out.push(L(CAT.ignitor, 1));
      else if (roll < 0.85) out.push(L(CAT.flueKit, 1), L(CAT.misc, 1));
      else out.push(L(CAT.filter, 1));
      return out;
    },
  },
  acTuneup: {
    serviceType: "maintenance",
    text: "acTuneup",
    minutes: [60, 90],
    family: "cooling",
    lines: (L, rng) => {
      const out = [L(CAT.acTuneup, 1), L(CAT.filter, rng.int(1, 2))];
      if (rng.chance(0.2)) out.push(L(CAT.capacitor, 1));
      return out;
    },
  },
  furnaceTuneup: {
    serviceType: "maintenance",
    text: "furnaceTuneup",
    minutes: [60, 90],
    family: "heating",
    lines: (L, rng) => {
      const out = [L(CAT.furnaceTuneup, 1), L(CAT.filter, rng.int(1, 2))];
      if (rng.chance(0.15)) out.push(L(CAT.ignitor, 1));
      return out;
    },
  },
  comboTuneup: {
    serviceType: "maintenance",
    text: "comboTuneup",
    minutes: [120, 150],
    family: "heating",
    lines: (L) => [L(CAT.acTuneup, 1), L(CAT.furnaceTuneup, 1), L(CAT.filter, 2)],
  },
  diagnostic: {
    serviceType: "inspection",
    text: "diagnostic",
    minutes: [60, 90],
    family: "cooling",
    lines: (L) => [L(CAT.serviceCall, 1), L(CAT.labour, 1)],
  },
  thermostatSwap: {
    serviceType: "repair",
    text: "thermostatSwap",
    minutes: [60, 90],
    family: "other",
    lines: (L, rng) => {
      const out = [L(CAT.thermostat, 1), L(CAT.labour, 1)];
      if (rng.chance(0.5)) out.push(L(CAT.misc, 1));
      return out;
    },
  },
  drainFlush: {
    serviceType: "maintenance",
    text: "drainFlush",
    minutes: [60],
    family: "cooling",
    lines: (L, rng) => {
      const out = [L(CAT.drainFlush, 1)];
      if (rng.chance(0.5)) out.push(L(CAT.floatSwitch, 1));
      return out;
    },
  },
  blowerReplace: {
    serviceType: "repair",
    text: "blowerReplace",
    minutes: [180],
    family: "heating",
    lines: (L) => [
      L(CAT.serviceCall, 1),
      L(CAT.blowerMotor, 1),
      L(CAT.labour, 2),
      L(CAT.misc, 1),
    ],
  },
  ductClean: {
    serviceType: "maintenance",
    text: "ductClean",
    minutes: [210, 240],
    family: "other",
    lines: (L, rng) => {
      const out = [L(CAT.ductCleaning, 1)];
      if (rng.chance(0.4)) out.push(L(CAT.mastic, 1));
      return out;
    },
  },
  roofRepair: {
    serviceType: "repair",
    text: "roofRepair",
    minutes: [120],
    family: "other",
    lines: (L, rng) => [L(CAT.roofRepair, rng.int(1, 2)), L(CAT.misc, 1)],
  },
  handyman: {
    serviceType: "other",
    text: "handyman",
    minutes: [90, 120],
    family: "other",
    lines: (L, rng) => [L(CAT.labour, rng.pick([1.5, 2, 2.5])), L(CAT.misc, rng.int(1, 2))],
  },
  emergency: {
    serviceType: "emergency",
    text: "emergency",
    minutes: [120],
    family: "cooling",
    lines: (L, rng, season) => {
      const out = [L(CAT.serviceCall, 1), L(CAT.labourAfterHours, rng.pick([1.5, 2, 2.5]))];
      if (season === "cooling") out.push(L(rng.pick([CAT.capacitor, CAT.contactor]), 1));
      else out.push(L(rng.pick([CAT.ignitor, CAT.flueKit]), 1));
      return out;
    },
  },
  warranty: {
    serviceType: "repair",
    text: "warranty",
    minutes: [60],
    family: "other",
    lines: () => [],
  },
  estimate: {
    serviceType: "consultation",
    text: "estimate",
    minutes: [60],
    family: "other",
    lines: () => [],
  },
  installSystem: {
    serviceType: "installation",
    text: "installSystem",
    minutes: [FULL_DAY_END - OPEN],
    fullDays: 2,
    family: "cooling",
    lines: (L) => [
      L(CAT.condenser, 1),
      L(CAT.airHandler, 1),
      L(CAT.lineSet, 1),
      L(CAT.refrigerant, 6),
      L(CAT.thermostat, 1),
      L(CAT.permit, 1),
      L(CAT.disposal, 1),
      L(CAT.labour, 14),
      L(CAT.misc, 3),
    ],
  },
  installFurnace: {
    serviceType: "installation",
    text: "installFurnace",
    minutes: [FULL_DAY_END - OPEN],
    fullDays: 1,
    family: "heating",
    lines: (L) => [
      L(CAT.furnace, 1),
      L(CAT.flueKit, 1),
      L(CAT.thermostat, 1),
      L(CAT.permit, 1),
      L(CAT.disposal, 1),
      L(CAT.labour, 6),
      L(CAT.misc, 2),
    ],
  },
  ductCombo: {
    serviceType: "maintenance",
    text: "ductCombo",
    minutes: [330, 360],
    family: "other",
    lines: (L) => [L(CAT.ductCleaning, 1), L(CAT.mastic, 2), L(CAT.labour, 3)],
  },
  rtuRepair: {
    serviceType: "repair",
    text: "rtuRepair",
    minutes: [180],
    family: "cooling",
    lines: (L, rng) => {
      const out = [L(CAT.serviceCall, 1), L(CAT.fanMotor, 1)];
      if (rng.chance(0.5)) out.push(L(CAT.capacitor, 1));
      out.push(L(CAT.labour, rng.pick([2.5, 3])), L(CAT.misc, 1));
      return out;
    },
  },
  gutterFlash: {
    serviceType: "repair",
    text: "gutterFlash",
    minutes: [180],
    family: "other",
    lines: (L) => [L(CAT.roofRepair, 3), L(CAT.misc, 2), L(CAT.labour, 1)],
  },
  thermostatUpgrade: {
    serviceType: "installation",
    text: "thermostatUpgrade",
    minutes: [150],
    family: "other",
    lines: (L) => [L(CAT.thermostat, 2), L(CAT.labour, 2), L(CAT.misc, 1)],
  },
};

/** What a phone call or a booking asks for, by season. */
function demandWeights(season: Season, segment: CustomerSegment): Weighted<KindName>[] {
  if (segment === "commercial") {
    return [
      { value: "rtuRepair", weight: 45 },
      { value: season === "cooling" ? "acTuneup" : "comboTuneup", weight: 20 },
      { value: "thermostatSwap", weight: 10 },
      { value: "diagnostic", weight: 10 },
      { value: "roofRepair", weight: 8 },
      { value: "estimate", weight: 7 },
    ];
  }
  if (season === "cooling") {
    return [
      { value: "acRepair", weight: 30 },
      { value: "drainFlush", weight: 10 },
      { value: "acTuneup", weight: 8 },
      { value: "estimate", weight: 13 },
      { value: "diagnostic", weight: 7 },
      { value: "thermostatSwap", weight: 5 },
      { value: "roofRepair", weight: 4 },
      { value: "blowerReplace", weight: 3 },
      { value: "ductClean", weight: 3 },
      { value: "handyman", weight: 3 },
      { value: "furnaceTuneup", weight: 1 },
    ];
  }
  if (season === "heating") {
    return [
      { value: "furnaceRepair", weight: 26 },
      { value: "furnaceTuneup", weight: 10 },
      { value: "diagnostic", weight: 8 },
      { value: "estimate", weight: 8 },
      { value: "thermostatSwap", weight: 6 },
      { value: "roofRepair", weight: 5 },
      { value: "comboTuneup", weight: 4 },
      { value: "handyman", weight: 4 },
      { value: "ductClean", weight: 3 },
      { value: "acRepair", weight: 3 },
    ];
  }
  return [
    { value: "furnaceTuneup", weight: 16 },
    { value: "comboTuneup", weight: 12 },
    { value: "acRepair", weight: 9 },
    { value: "furnaceRepair", weight: 9 },
    { value: "estimate", weight: 13 },
    { value: "diagnostic", weight: 7 },
    { value: "thermostatSwap", weight: 7 },
    { value: "drainFlush", weight: 4 },
    { value: "ductClean", weight: 4 },
    { value: "roofRepair", weight: 4 },
    { value: "handyman", weight: 3 },
    { value: "blowerReplace", weight: 3 },
  ];
}

/** What an estimate visit ends up quoting. */
function quoteWeights(season: Season): Weighted<KindName>[] {
  return [
    { value: "installSystem", weight: season === "cooling" ? 40 : 25 },
    { value: "installFurnace", weight: season === "cooling" ? 12 : 30 },
    { value: "ductCombo", weight: 15 },
    { value: "thermostatUpgrade", weight: 12 },
    { value: "gutterFlash", weight: 8 },
    { value: "blowerReplace", weight: 8 },
  ];
}

const REPAIR_KINDS: readonly KindName[] = [
  "acRepair",
  "furnaceRepair",
  "blowerReplace",
  "rtuRepair",
];

const JOB_NOTES: readonly string[] = [
  "Customer asked for a call 30 minutes before arrival.",
  "Gate code is on the customer record.",
  "Bring the 6-ft ladder — attic access is tight.",
  "Park on the street; the driveway is shared.",
  "Customer works nights — knock quietly.",
  "Second visit this year for the same unit; check the earlier notes.",
];

const TIME_NOTES: readonly string[] = [
  "Parts counter run included",
  "Customer walkthrough at the end",
  "Waited on the homeowner to arrive",
  "Extra time clearing the attic access",
];

const RTU_MODELS: readonly EquipmentModel[] = [
  { family: "cooling", equipmentType: "Rooftop package unit", brand: "Carrier", model: "48FCEM06", location: "Roof — north end" },
  { family: "cooling", equipmentType: "Rooftop package unit", brand: "Trane", model: "YSC060", location: "Roof — south end" },
  { family: "cooling", equipmentType: "Rooftop package unit", brand: "Lennox", model: "LGH072", location: "Roof — over the kitchen" },
];

const FAR_CITIES = new Set(["Georgetown", "Kyle", "Leander"]);

/* ── the schedule board ────────────────────────────────────────────────── */

interface Block {
  start: number;
  end: number;
  job: boolean;
}

class Board {
  private readonly days = new Map<number, Block[]>();

  constructor(
    private readonly cal: DemoCalendar,
    private readonly closed: ReadonlySet<number>,
  ) {}

  isWorkday(day: number): boolean {
    return this.cal.isWeekday(day) && !this.closed.has(day);
  }

  private blocks(day: number): Block[] {
    let list = this.days.get(day);
    if (!list) {
      list = [];
      this.days.set(day, list);
    }
    return list;
  }

  jobCount(day: number): number {
    return this.blocks(day).filter((b) => b.job).length;
  }

  free(day: number, start: number, end: number): boolean {
    return this.blocks(day).every(
      (b) => end + TRAVEL <= b.start || start >= b.end + TRAVEL,
    );
  }

  reserve(day: number, start: number, end: number, job: boolean): void {
    this.blocks(day).push({ start, end, job });
  }

  /** First working day in [from, to] with a gap of `minutes`. */
  place(
    from: number,
    to: number,
    minutes: number,
    prefer: number | null,
  ): { day: number; start: number } | null {
    for (let day = from; day <= to; day++) {
      if (!this.isWorkday(day) || this.jobCount(day) >= MAX_JOBS_PER_DAY) continue;
      for (const start of candidateStarts(minutes, prefer)) {
        if (this.free(day, start, start + minutes)) return { day, start };
      }
    }
    return null;
  }

  /** `count` consecutive working days, each with no job on it yet. */
  placeFullDays(from: number, to: number, count: number): number[] | null {
    for (let day = from; day <= to; day++) {
      const run: number[] = [];
      let d = day;
      while (run.length < count && d <= to + 7) {
        if (this.isWorkday(d)) {
          if (this.jobCount(d) > 0 || !this.free(d, OPEN, FULL_DAY_END)) break;
          run.push(d);
        } else if (this.cal.isWeekday(d)) {
          break; // a closed weekday interrupts an install
        }
        d += 1;
      }
      if (run.length === count) return run;
    }
    return null;
  }
}

function candidateStarts(minutes: number, prefer: number | null): number[] {
  const out: number[] = [];
  if (prefer !== null) out.push(prefer);
  out.push(OPEN, toMinutes("10:30"), toMinutes("13:00"), toMinutes("15:00"));
  for (let t = OPEN; t + minutes <= CLOSE; t += 30) out.push(t);
  return out.filter((t) => t >= OPEN && t + minutes <= CLOSE);
}

/* ── small helpers ─────────────────────────────────────────────────────── */

function when(day: number, minutes: number): When {
  return { day, time: toHhmm(minutes) };
}

function isBefore(a: When, b: When): boolean {
  return a.day < b.day || (a.day === b.day && toMinutes(a.time) < toMinutes(b.time));
}

function later(a: When, b: When): When {
  return isBefore(a, b) ? b : a;
}

/** Something that already happened cannot be dated after today. */
function notAfterToday(at: When): When {
  return at.day > 0 ? { day: 0, time: "23:55" } : at;
}

/** Move a moment forward by `minutes`, rolling into the next day if needed. */
function plus(at: When, minutes: number): When {
  const total = toMinutes(at.time) + minutes;
  const day = at.day + Math.floor(total / 1440);
  return { day, time: toHhmm(((total % 1440) + 1440) % 1440) };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function pickText(rng: Rng, key: string): { title: string; description: string } {
  const text = JOB_TEXT[key];
  if (!text) throw new Error(`No job text for "${key}"`);
  return { title: rng.pick(text.titles), description: rng.pick(text.descriptions) };
}

/* ── the generator ─────────────────────────────────────────────────────── */

interface CustomerMeta {
  source: CustomerSource;
  segment: CustomerSegment;
  established: boolean;
  cooling: number[];
  heating: number | null;
  jobs: number[];
}

type DemandVia = "phone" | "booking" | "quote" | "plan" | "warranty";

interface Demand {
  customer: number;
  kind: KindName;
  created: When;
  earliest: number;
  latest: number;
  prefer: number | null;
  via: DemandVia;
  booking: number | null;
  quote: number | null;
  lines: LineSpec[] | null;
  notes: string | null;
}

export function buildDemoDataset(today: string): DemoDataset {
  const rng = createRng(SEED);
  const cal = createCalendar(today);
  const [ty = 1970, tm = 1, td = 1] = today.split("-").map(Number);
  const seasonAt = (offset: number): Season =>
    seasonForMonth(new Date(Date.UTC(ty, tm - 1, td + offset, 12)).getUTCMonth() + 1);

  const catalogByName = new Map(CATALOG.map((c) => [c.name, c]));
  const L: LineBuilder = (name, quantity) => {
    const item = catalogByName.get(name);
    if (!item) throw new Error(`Unknown catalog item "${name}"`);
    // Supplier prices drift a little from the catalog; labour stays at 0
    // (costed from time entries) and unknown costs stay unknown.
    const unitCost =
      item.unitCost === null || item.unitCost === 0
        ? item.unitCost
        : roundMoney(item.unitCost * (0.94 + rng.next() * 0.12));
    return {
      catalog: item.name,
      itemType: item.itemType,
      description: item.name,
      quantity,
      unitPrice: item.unitPrice,
      unitCost,
    };
  };

  const customers: CustomerSpec[] = [];
  const meta: CustomerMeta[] = [];
  const customerNotes: CustomerNoteSpec[] = [];
  const equipment: EquipmentSpec[] = [];
  const contracts: ContractSpec[] = [];
  const quotes: QuoteSpec[] = [];
  const bookings: BookingSpec[] = [];
  const jobs: JobSpec[] = [];
  const invoices: InvoiceSpec[] = [];
  const calendarEvents: CalendarEventSpec[] = [];
  const notifications: NotificationSpec[] = [];

  /* Closed days first, so nothing is ever booked on them. */
  const scheduleOverrides: ScheduleOverrideSpec[] = [
    { day: cal.weekdayOnOrBefore(-24), reason: "Closed — supplier training in Dallas" },
    { day: cal.weekdayOnOrAfter(9), reason: "Closed — family commitment" },
  ];
  const board = new Board(cal, new Set(scheduleOverrides.map((o) => o.day)));

  /* ── customers and their equipment ─────────────────────────────────── */

  const firsts = rng.shuffle(FIRST_NAMES);
  const lasts = rng.shuffle(LAST_NAMES);
  const coolingModels = EQUIPMENT_MODELS.filter((m) => m.family === "cooling");
  const heatingModels = EQUIPMENT_MODELS.filter((m) => m.family === "heating");
  const otherModels = EQUIPMENT_MODELS.filter((m) => m.family === "other");
  const residentialNotes = CUSTOMER_NOTES.filter((n) => !n.startsWith("Landlord"));
  const landlordNote =
    CUSTOMER_NOTES.find((n) => n.startsWith("Landlord")) ??
    "Owns several rentals — each property has its own invoice.";

  const addEquipment = (
    customer: number,
    model: EquipmentModel,
    created: When,
    location: string,
  ): number => {
    const installDay = -rng.int(730, 5200);
    equipment.push({
      customer,
      equipmentType: model.equipmentType,
      brand: model.brand,
      model: model.model,
      serialNumber: `${model.brand.slice(0, 2).toUpperCase()}${rng.int(1000, 9999)}${String.fromCharCode(65 + rng.int(0, 25))}${rng.int(10000, 99999)}`,
      installDay,
      warrantyDay: installDay + 3650,
      location,
      notes: null,
      created,
    });
    return equipment.length - 1;
  };

  const total = ESTABLISHED_CUSTOMERS + NEW_CUSTOMERS;
  for (let i = 0; i < total; i++) {
    const established = i < ESTABLISHED_CUSTOMERS;
    const segment: CustomerSegment =
      i < 3 ? "landlord" : i < 6 ? "commercial" : "residential";
    const firstName = firsts[i] ?? "Alex";
    const lastName = lasts[i] ?? "Morgan";
    const place = rng.pick(PLACES);

    let joinedDay: number;
    let source: CustomerSource;
    if (established) {
      joinedDay = -rng.int(75, 540);
      source = rng.chance(0.25) ? "referral" : "phone";
    } else {
      const k = i - ESTABLISHED_CUSTOMERS;
      const spread = NEW_CUSTOMERS - 2;
      joinedDay =
        k === NEW_CUSTOMERS - 1
          ? 0
          : k === NEW_CUSTOMERS - 2
            ? -1
            : Math.min(-2, -58 + Math.floor((k * 56) / spread) + rng.int(0, 2));
      source =
        k >= NEW_CUSTOMERS - 2
          ? "portal"
          : rng.weighted<CustomerSource>([
              { value: "portal", weight: 45 },
              { value: "phone", weight: 35 },
              { value: "referral", weight: 20 },
            ]);
    }
    const joinedMinutes =
      source === "portal"
        ? joinedDay === 0
          ? rng.step(toMinutes("06:30"), toMinutes("08:30"), 5)
          : rng.step(toMinutes("07:00"), toMinutes("21:30"), 5)
        : rng.step(toMinutes("08:00"), toMinutes("17:00"), 5);
    const joined = when(joinedDay, joinedMinutes);

    const hasEmail = source === "portal" || rng.chance(0.85);
    const notes =
      segment === "commercial"
        ? rng.pick(BUSINESS_NOTE_ADDENDA)
        : segment === "landlord"
          ? landlordNote
          : rng.chance(0.25)
            ? rng.pick(residentialNotes)
            : null;

    customers.push({
      firstName,
      lastName,
      email: hasEmail ? `${slug(firstName)}.${slug(lastName)}@${rng.weighted(EMAIL_DOMAINS)}` : null,
      phone: `${rng.pick(["(512)", "(737)"])} 555-01${String(10 + i).padStart(2, "0")}`,
      address: `${rng.int(102, 9870)} ${rng.pick(STREETS)}`,
      city: place.city,
      state: "TX",
      zipCode: place.zipCode,
      joined,
      source,
      segment,
      tags: [],
      notes,
      archivedAt: i === ARCHIVED_CUSTOMER ? { day: -20, time: "10:15" } : null,
      emailOptOutAt:
        i === OPTED_OUT_CUSTOMER && hasEmail ? { day: -15, time: "19:42" } : null,
    });

    const m: CustomerMeta = { source, segment, established, cooling: [], heating: null, jobs: [] };
    const equipmentCreated = plus(joined, 10);
    if (segment === "commercial") {
      const [a, b] = rng.shuffle(RTU_MODELS);
      if (a) m.cooling.push(addEquipment(i, a, equipmentCreated, a.location));
      if (b) m.cooling.push(addEquipment(i, b, equipmentCreated, b.location));
    } else if (segment === "landlord") {
      const a = rng.pick(coolingModels);
      const b = rng.pick(coolingModels);
      m.cooling.push(addEquipment(i, a, equipmentCreated, `Unit A — ${a.location.toLowerCase()}`));
      m.cooling.push(addEquipment(i, b, equipmentCreated, `Unit B — ${b.location.toLowerCase()}`));
      const h = rng.pick(heatingModels);
      m.heating = addEquipment(i, h, equipmentCreated, `Unit A — ${h.location.toLowerCase()}`);
    } else {
      const c = rng.pick(coolingModels);
      m.cooling.push(addEquipment(i, c, equipmentCreated, c.location));
      if (rng.chance(0.75)) {
        const h = rng.pick(heatingModels);
        m.heating = addEquipment(i, h, equipmentCreated, h.location);
      }
      const water = otherModels[0];
      if (water && rng.chance(0.1)) addEquipment(i, water, equipmentCreated, water.location);
    }
    meta.push(m);
  }

  const customerAt = (i: number): CustomerSpec => {
    const c = customers[i];
    if (!c) throw new Error(`No customer at index ${i}`);
    return c;
  };
  const metaAt = (i: number): CustomerMeta => {
    const m = meta[i];
    if (!m) throw new Error(`No customer meta at index ${i}`);
    return m;
  };
  const fullName = (i: number) => `${customerAt(i).firstName} ${customerAt(i).lastName}`;
  const active = (i: number) => i !== ARCHIVED_CUSTOMER;

  /* Customer notes: a few things the owner wrote down along the way. */
  const noteBank = rng.shuffle(residentialNotes);
  const noteTargets = rng
    .shuffle(customers.map((_, i) => i).filter(active))
    .slice(0, 14);
  noteTargets.forEach((ci, n) => {
    const c = customerAt(ci);
    const day = Math.min(0, Math.max(c.joined.day + rng.int(1, 20), -PAST_DAYS));
    customerNotes.push({
      customer: ci,
      at: when(day, rng.step(toMinutes("08:00"), toMinutes("18:30"), 5)),
      content: noteBank[n % noteBank.length] ?? "Prefers a call before the visit.",
    });
  });

  /* ── maintenance contracts ─────────────────────────────────────────── */

  const establishedResidential = customers
    .map((_, i) => i)
    .filter((i) => metaAt(i).established && metaAt(i).segment === "residential" && active(i));
  const earlyNewResidential = customers
    .map((_, i) => i)
    .filter(
      (i) =>
        !metaAt(i).established &&
        metaAt(i).segment === "residential" &&
        customerAt(i).joined.day <= -35,
    );
  const contractCustomers = [
    0,
    ...rng.shuffle(establishedResidential).slice(0, 5),
    ...rng.shuffle(earlyNewResidential).slice(0, 2),
  ];
  for (const ci of contractCustomers) {
    const m = metaAt(ci);
    const quarterly = m.segment === "landlord";
    const semi = !quarterly && rng.chance(0.7);
    const joinedDay = customerAt(ci).joined.day;
    const startDay = m.established
      ? Math.max(-rng.int(60, 330), joinedDay + 1)
      : joinedDay + rng.int(1, 5);
    contracts.push({
      customer: ci,
      equipment: m.cooling[0] ?? null,
      name: quarterly
        ? "Comfort Club — quarterly (3 units)"
        : semi
          ? "Comfort Club — semi-annual"
          : "Comfort Club — annual",
      startDay,
      endDay: startDay + 365,
      frequency: quarterly ? "quarterly" : semi ? "semi_annual" : "annual",
      visitsPerYear: quarterly ? 4 : semi ? 2 : 1,
      annualPrice: quarterly ? 420 : semi ? 189 : 119,
      notes: semi
        ? "Two visits a year: cooling in spring, heating in fall. 15% off repairs."
        : quarterly
          ? "Filters and a check on every unit each quarter. Tenants are told by the owner."
          : "One combined tune-up a year. 10% off repairs.",
      renewalReminderDay: null,
    });
  }

  /* ── calendar events that hold time on the board ───────────────────── */

  const reserveEvent = (spec: CalendarEventSpec): void => {
    const start = toMinutes(spec.start);
    const end = toMinutes(spec.end);
    if (start < CLOSE && end > OPEN) board.reserve(spec.day, start, end, false);
    calendarEvents.push(spec);
  };
  const event = (
    day: number,
    start: string,
    end: string,
    title: string,
    color: CalendarEventSpec["color"],
    extra: Partial<CalendarEventSpec> = {},
  ): CalendarEventSpec => ({
    title,
    description: null,
    day,
    start,
    end,
    color,
    contactName: null,
    contactPhone: null,
    address: null,
    notes: null,
    customer: null,
    job: null,
    ...extra,
  });

  reserveEvent(
    event(cal.weekdayOnOrBefore(-33), "07:00", "07:50", "Truck service — oil change and tires", "teal", {
      address: "Lamar Blvd Auto Care",
    }),
  );
  reserveEvent(
    event(cal.weekdayOnOrBefore(-26), "16:30", "17:30", "Accountant — Q3 estimated taxes", "green", {
      notes: "Bring the mileage log and the supplier receipts folder.",
    }),
  );
  reserveEvent(
    event(cal.weekdayOnOrBefore(-12), "12:00", "13:30", "Lunch & learn — heat pump sizing", "purple", {
      address: `${VENDORS.supply[0]}, Burnet Rd`,
      description: "Manufacturer rep session at the supply house.",
    }),
  );
  reserveEvent(
    event(cal.weekdayOnOrBefore(-8), "16:00", "16:45", "Follow-up calls — open quotes", "blue"),
  );
  reserveEvent(
    event(cal.weekdayOnOrAfter(6), "16:00", "16:45", "Follow-up calls — open quotes", "blue"),
  );
  const landlordContact = 0;
  reserveEvent(
    event(cal.weekdayOnOrBefore(-16), "15:00", "16:00", `Walkthrough with ${fullName(landlordContact)}`, "blue", {
      customer: landlordContact,
      contactName: fullName(landlordContact),
      contactPhone: customerAt(landlordContact).phone,
      address: customerAt(landlordContact).address,
      description: "Walk the three rentals and plan the fall filter changes.",
    }),
  );
  for (const offset of [-37, -9]) {
    let day = offset;
    while (cal.weekday(day) !== 6) day += 1;
    reserveEvent(event(day, "09:00", "10:30", "Kids' soccer game", "red"));
  }
  reserveEvent(
    event(cal.weekdayOnOrAfter(3), "07:15", "07:45", "Furnace parts delivery window", "amber", {
      notes: "Supply house drops the order at the shop before 8.",
    }),
  );
  reserveEvent(
    event(cal.weekdayOnOrAfter(11), "17:30", "19:00", "EPA 608 refresher (online)", "purple"),
  );

  /* ── demand ────────────────────────────────────────────────────────── */

  const queue: Demand[] = [];
  const enqueue = (d: Demand) => {
    queue.push(d);
    queue.sort((a, b) =>
      a.created.day - b.created.day || toMinutes(a.created.time) - toMinutes(b.created.time),
    );
  };

  const demand = (partial: Omit<Demand, "prefer" | "booking" | "quote" | "lines" | "notes"> & Partial<Demand>): Demand => ({
    prefer: null,
    booking: null,
    quote: null,
    lines: null,
    notes: null,
    ...partial,
  });

  const officeTime = () => rng.step(toMinutes("08:00"), toMinutes("17:30"), 5);
  const bookingTimes = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"] as const;

  /** A portal booking. Returns its index; the job (if any) is queued by the caller. */
  const addBooking = (customer: number, kind: KindName, created: When, source: BookingSource): number => {
    const serviceType = KINDS[kind].serviceType;
    let day = cal.weekdayOnOrAfter(created.day + rng.int(1, 5));
    while (!board.isWorkday(day)) day = cal.nextWeekday(day);
    const bank = BOOKING_DESCRIPTIONS[serviceType] ?? BOOKING_DESCRIPTIONS.repair ?? [];
    bookings.push({
      customer,
      serviceType,
      day,
      time: rng.pick(bookingTimes),
      description: bank.length > 0 ? rng.pick(bank) : "Please call to arrange a visit.",
      status: "pending",
      source,
      created,
      job: null,
      confirmedAt: null,
      cancelled: null,
      rescheduled: null,
      completedAt: null,
      notes: null,
    });
    return bookings.length - 1;
  };

  /**
   * Decide what happened to a booking and queue its job when it was taken on.
   * Pending: made in the last day and a half. Cancelled: a few. Otherwise it was
   * confirmed within hours and converted to a job on the requested day.
   */
  const settleBooking = (bi: number, customer: number, kind: KindName): void => {
    const b = bookings[bi];
    if (!b) return;
    if (b.created.day >= -1) return; // still waiting for the owner to look
    if (rng.chance(0.07)) {
      const was = rng.chance(0.5) ? "confirmed" : "pending";
      if (was === "confirmed") b.confirmedAt = plus(b.created, rng.int(60, 600));
      const at = plus(b.created, rng.int(180, 2400));
      const cancelAt = at.day >= b.day ? when(b.day - 1, toMinutes("18:20")) : at;
      b.cancelled = { at: later(cancelAt, plus(b.confirmedAt ?? b.created, 30)), was };
      b.status = "cancelled";
      return;
    }
    const confirmed = plus(b.created, rng.int(45, 900));
    b.confirmedAt = confirmed;
    b.status = "confirmed";
    if (rng.chance(0.12)) {
      // The customer asked to move it once; the job is on the new day.
      const fromDay = b.day;
      const fromTime = b.time;
      b.day = cal.nextWeekday(b.day);
      while (!board.isWorkday(b.day)) b.day = cal.nextWeekday(b.day);
      b.time = rng.pick(bookingTimes);
      b.rescheduled = { at: plus(confirmed, rng.int(120, 1200)), fromDay, fromTime };
    }
    enqueue(
      demand({
        customer,
        kind,
        created: confirmed,
        earliest: Math.max(b.day, confirmed.day + 1),
        latest: b.day + 6,
        prefer: toMinutes(b.time),
        via: "booking",
        booking: bi,
      }),
    );
  };

  // New customers: the way they arrived is their first piece of work.
  for (let ci = ESTABLISHED_CUSTOMERS; ci < total; ci++) {
    const c = customerAt(ci);
    const m = metaAt(ci);
    const kind = rng.weighted(demandWeights(seasonAt(c.joined.day + 3), m.segment));
    if (m.source === "portal") {
      const bi = addBooking(ci, kind, c.joined, rng.weighted<BookingSource>([
        { value: "portal", weight: 70 },
        { value: "widget", weight: 20 },
        { value: "embed", weight: 10 },
      ]));
      settleBooking(bi, ci, kind);
    } else {
      enqueue(
        demand({
          customer: ci,
          kind,
          created: c.joined,
          earliest: c.joined.day + rng.int(1, 4),
          latest: c.joined.day + 20,
          via: "phone",
        }),
      );
    }
    // Some come back with a second job before the window ends.
    if (rng.chance(0.3)) {
      const day = c.joined.day + rng.int(12, 40);
      if (day <= 0) {
        enqueue(
          demand({
            customer: ci,
            kind: rng.weighted(demandWeights(seasonAt(day), m.segment)),
            created: when(day, officeTime()),
            earliest: day + rng.int(1, 5),
            latest: day + 20,
            via: "phone",
          }),
        );
      }
    }
  }

  // Established customers call or book through the window.
  for (let ci = 0; ci < ESTABLISHED_CUSTOMERS; ci++) {
    const m = metaAt(ci);
    if (ci === ARCHIVED_CUSTOMER) {
      enqueue(
        demand({
          customer: ci,
          kind: "acTuneup",
          created: when(-58, officeTime()),
          earliest: -56,
          latest: -50,
          via: "phone",
          notes: "Last visit before the move — tune-up for the sale inspection.",
        }),
      );
      continue;
    }
    const count = m.segment === "residential" ? rng.int(1, 3) : 3;
    for (let n = 0; n < count; n++) {
      const createdDay = -rng.int(0, PAST_DAYS + 2);
      const created = when(createdDay, officeTime());
      const kind = rng.weighted(demandWeights(seasonAt(createdDay + 3), m.segment));
      if (m.segment === "residential" && rng.chance(0.35)) {
        const bi = addBooking(ci, kind, created, "portal");
        settleBooking(bi, ci, kind);
        continue;
      }
      enqueue(
        demand({
          customer: ci,
          kind,
          created,
          earliest: createdDay + rng.int(1, 7),
          latest: createdDay + 24,
          via: "phone",
        }),
      );
    }
  }

  // One established customer booked yesterday evening and is still waiting.
  {
    const ci = rng.pick(establishedResidential);
    const created = when(-1, toMinutes("20:45"));
    addBooking(ci, rng.weighted(demandWeights(seasonAt(2), "residential")), created, "widget");
  }

  // Comfort Club visits: the plan pays for the tune-up, the invoice carries
  // only the filters and anything extra.
  contracts.forEach((contract, n) => {
    const ci = contract.customer;
    const earliest = Math.max(rng.int(-28, 12), customerAt(ci).joined.day + 3);
    const createdDay = Math.max(earliest - rng.int(5, 12), customerAt(ci).joined.day + 1, -PAST_DAYS);
    const season = seasonAt(earliest);
    const kind: KindName = season === "cooling" ? "acTuneup" : n % 2 === 0 ? "comboTuneup" : "furnaceTuneup";
    const lines = [L(CAT.filter, metaAt(ci).segment === "landlord" ? 3 : rng.int(1, 2))];
    if (rng.chance(0.2)) lines.push(L(CAT.capacitor, 1));
    enqueue(
      demand({
        customer: ci,
        kind,
        created: when(Math.min(createdDay, 0), officeTime()),
        earliest: Math.max(earliest, Math.min(createdDay, 0) + 1),
        latest: earliest + 14,
        via: "plan",
        lines,
        notes: "Comfort Club visit — tune-up covered by the plan.",
      }),
    );
  });

  // Emergencies: after-hours calls, done the same evening.
  for (const offset of [-52, -37, -19, -6]) {
    const day = offset + rng.int(-2, 2);
    const candidates = customers
      .map((_, i) => i)
      .filter((i) => active(i) && customerAt(i).joined.day < day);
    enqueue(
      demand({
        customer: rng.pick(candidates),
        kind: "emergency",
        created: when(day, rng.step(toMinutes("16:30"), toMinutes("18:00"), 5)),
        earliest: day,
        latest: day,
        via: "phone",
      }),
    );
  }

  /* ── quotes ────────────────────────────────────────────────────────── */

  /**
   * Issue a quote and decide its fate from its age. An accepted quote queues
   * the job it became; `job` is filled in when that job is placed.
   */
  const issueQuote = (customer: number, issued: When, kind: KindName): void => {
    if (issued.day > 0) return;
    const age = -issued.day;
    const season = seasonAt(issued.day);
    const lines = KINDS[kind].lines(L, rng, season);
    const big = kind === "installSystem" || kind === "installFurnace";
    const m = metaAt(customer);

    let status: QuoteStatus;
    let viewed = false;
    const roll = rng.next();
    if (age <= 2 && rng.chance(0.3)) status = "draft";
    else if (age >= 30) status = roll < 0.5 ? "accepted" : roll < 0.75 ? "declined" : "expired";
    else if (age >= 7) {
      status = roll < 0.45 ? "accepted" : roll < 0.6 ? "declined" : "sent";
      viewed = roll < 0.9;
    } else {
      status = roll < 0.2 ? "accepted" : "sent";
      viewed = roll < 0.65;
    }

    const sent = status === "draft" ? null : plus(issued, rng.int(20, 90));
    let responded: When | null = null;
    if ((status === "accepted" || status === "declined") && sent) {
      const day = Math.min(sent.day + rng.int(1, Math.max(1, Math.min(age, 9))), 0);
      responded = later(when(day, rng.step(toMinutes("07:30"), toMinutes("21:30"), 5)), plus(sent, 60));
      viewed = true;
    }
    if (status === "expired") viewed = rng.chance(0.6);
    let viewedAt: When | null = null;
    if (viewed && sent) {
      const v = plus(sent, rng.int(30, 60 * 30));
      viewedAt = responded && isBefore(responded, v) ? plus(sent, 15) : v;
      if (viewedAt.day > 0) viewedAt = plus(sent, 15);
    }

    const qi = quotes.length;
    quotes.push({
      customer,
      equipment: KINDS[kind].family === "heating" ? m.heating ?? m.cooling[0] ?? null : m.cooling[0] ?? null,
      status,
      issued,
      lines,
      discount: big && rng.chance(0.4) ? 150 : 0,
      notes: big ? "Includes permit, haul-away of the old equipment and a 1-year labour warranty." : null,
      declineReason: status === "declined" ? rng.pick(DECLINE_REASONS) : null,
      sent,
      viewed: viewedAt,
      responded,
      respondedOnline: rng.chance(0.7),
      job: null,
    });

    if (status === "accepted" && responded) {
      const earliest = responded.day + rng.int(3, 8);
      enqueue(
        demand({
          customer,
          kind,
          created: notAfterToday(plus(responded, rng.int(20, 240))),
          earliest,
          latest: Math.max(earliest + 10, INSTALL_HORIZON),
          via: "quote",
          quote: qi,
          lines: lines.map((l) => ({ ...l })),
        }),
      );
    }
  };

  // A few quotes go out after a phone conversation, with no visit first.
  for (const kind of ["thermostatUpgrade", "ductCombo", "gutterFlash", "installSystem", "blowerReplace", "thermostatUpgrade"] as const) {
    const ci = rng.pick(establishedResidential);
    issueQuote(ci, when(-rng.int(3, 45), officeTime()), kind);
  }

  /* ── place the work ────────────────────────────────────────────────── */

  let stuckOnParts = 0;
  let warrantyCallbacks = 0;

  while (queue.length > 0) {
    const d = queue.shift();
    if (!d) break;
    const spec = KINDS[d.kind];
    const m = metaAt(d.customer);
    const c = customerAt(d.customer);

    // Where it goes on the calendar.
    let days: number[];
    let start: number;
    let end: number;
    if (d.kind === "emergency") {
      days = [d.earliest];
      start = rng.pick([toMinutes("18:00"), toMinutes("18:30"), toMinutes("19:00")]);
      end = start + 120;
      board.reserve(d.earliest, start, end, false);
    } else if (spec.fullDays) {
      const run = board.placeFullDays(Math.max(d.earliest, d.created.day + 1), d.latest, spec.fullDays);
      if (!run) continue;
      days = run;
      start = OPEN;
      end = FULL_DAY_END;
      for (const day of run) board.reserve(day, start, end, true);
    } else {
      const minutes = rng.pick(spec.minutes);
      const prefer = d.prefer ?? rng.pick([OPEN, OPEN + 30, OPEN + 60, toMinutes("10:30"), toMinutes("13:00"), toMinutes("13:30"), toMinutes("15:00")]);
      const slot = board.place(Math.max(d.earliest, d.created.day + 1), d.latest, minutes, prefer);
      if (!slot) {
        if (d.booking !== null) {
          const b = bookings[d.booking];
          if (b) {
            b.status = "cancelled";
            b.cancelled = { at: plus(d.created, 60), was: "confirmed" };
          }
        }
        continue;
      }
      days = [slot.day];
      start = slot.start;
      end = slot.start + minutes;
      board.reserve(slot.day, start, end, true);
    }

    const first = days[0] ?? d.earliest;
    const last = days[days.length - 1] ?? first;
    const season = seasonAt(first);

    // What has happened to it by today.
    let lifecycle: Lifecycle;
    let cancelled: JobSpec["cancelled"] = null;
    let notes = d.notes;
    const cancellable = d.via !== "quote" && d.via !== "plan" && d.kind !== "emergency";
    if (cancellable && rng.chance(0.045)) {
      lifecycle = "cancelled";
      const at = later(when(Math.min(first - rng.int(0, 2), 0), rng.step(toMinutes("07:00"), toMinutes("18:00"), 5)), plus(d.created, 30));
      cancelled = { at, reason: rng.pick(CANCEL_REASONS) };
    } else if (last < 0) {
      lifecycle = "completed";
      if (first >= -7 && REPAIR_KINDS.includes(d.kind) && stuckOnParts < 2 && rng.chance(stuckOnParts === 0 ? 1 : 0.4)) {
        lifecycle = "in_progress";
        stuckOnParts += 1;
        notes = "Waiting on a back-ordered part; the customer has been told.";
      }
    } else if (first < 0) {
      lifecycle = "in_progress";
    } else if (first === 0 && days.length === 1) {
      lifecycle = end <= toMinutes("12:00") ? "completed" : start < toMinutes("14:00") ? "in_progress" : "scheduled";
    } else {
      lifecycle = "scheduled";
    }

    const worked = lifecycle === "completed" || lifecycle === "in_progress";
    const startedAt = worked ? when(first, start + rng.int(-5, 12)) : null;
    const completed = lifecycle === "completed" ? when(last, end + rng.int(0, 25)) : null;

    // Time on the job. A few completed jobs were never logged.
    const time: TimeEntrySpec[] = [];
    if (worked && !(lifecycle === "completed" && rng.chance(0.08))) {
      const loggedDays =
        lifecycle === "in_progress" && days.length === 1 ? [first] : days.filter((day) => day < 0);
      for (const day of loggedDays) {
        const s = start + rng.int(-5, 12);
        const planned = end - start;
        const duration = Math.round((planned * (0.85 + rng.next() * 0.35)) / 5) * 5;
        time.push({
          member: 0,
          day,
          start: toHhmm(s),
          end: toHhmm(Math.min(s + duration, toMinutes("21:30"))),
          note: rng.chance(0.12) ? rng.pick(TIME_NOTES) : null,
        });
      }
    }

    // Money spent on the job that is not a catalog line.
    const expenses: ExpenseSpec[] = [];
    if (spec.serviceType === "installation" && (d.kind === "installSystem" || d.kind === "installFurnace")) {
      const permitDay = first - rng.int(2, 5);
      if (permitDay <= 0) {
        expenses.push({ category: "permit", description: "Mechanical permit", amount: 95, day: permitDay, vendor: VENDORS.permit[0], member: 0 });
      }
      if (worked) {
        expenses.push({ category: "material", description: "Pad, disconnect and fittings", amount: rng.int(64, 128), day: first, vendor: rng.pick(VENDORS.supply), member: 0 });
      }
      if (lifecycle === "completed") {
        expenses.push({ category: "other", description: "Dump fee — old equipment", amount: rng.int(35, 48), day: last, vendor: VENDORS.dump[0], member: 0 });
      }
    } else if (worked) {
      if (rng.chance(0.15)) {
        expenses.push({ category: "material", description: "Parts counter run — fittings and wire", amount: rng.int(18, 75), day: first, vendor: rng.pick(VENDORS.supply), member: 0 });
      }
      if (FAR_CITIES.has(c.city) && rng.chance(0.35)) {
        expenses.push({ category: "fuel", description: "Fuel — out-of-area call", amount: rng.int(38, 64), day: first, vendor: rng.pick(VENDORS.fuel), member: 0 });
      }
    }

    const hasChecklist = CHECKLISTS.some((t) => t.serviceType === spec.serviceType);
    const checklist: ChecklistTick = !hasChecklist
      ? "none"
      : lifecycle === "completed"
        ? rng.chance(0.85) ? "all" : "required"
        : lifecycle === "in_progress"
          ? "partial"
          : "none";

    const text =
      d.kind === "emergency"
        ? {
            title: season === "cooling" ? "Emergency — no cooling" : season === "heating" ? "Emergency — no heat" : rng.pick(JOB_TEXT.emergency?.titles ?? ["After-hours call-out"]),
            description: rng.pick(JOB_TEXT.emergency?.descriptions ?? ["After-hours call-out."]),
          }
        : pickText(rng, spec.text);

    const equipmentIndex =
      spec.family === "heating"
        ? m.heating ?? m.cooling[0] ?? null
        : spec.family === "cooling"
          ? m.cooling.length > 0 ? rng.pick(m.cooling) : null
          : null;

    const priority: Priority =
      d.kind === "emergency" ? "emergency" : d.kind === "rtuRepair" && rng.chance(0.5) ? "urgent" : rng.chance(0.06) ? "urgent" : "standard";

    const ji = jobs.length;
    jobs.push({
      kind: d.kind,
      customer: d.customer,
      equipment: equipmentIndex,
      lifecycle,
      priority,
      serviceType: spec.serviceType,
      title: text.title,
      description: text.description,
      notes: notes ?? (rng.chance(0.12) ? rng.pick(JOB_NOTES) : null),
      day: first,
      start: toHhmm(start),
      end: toHhmm(end),
      assignee: 0,
      lines: d.lines ?? spec.lines(L, rng, season),
      created: d.created,
      startedAt,
      completed,
      cancelled,
      time,
      expenses,
      checklist,
      quote: d.quote,
      booking: d.booking,
    });
    m.jobs.push(ji);
    if (d.quote !== null) {
      const q = quotes[d.quote];
      if (q) q.job = ji;
    }
    if (d.booking !== null) {
      const b = bookings[d.booking];
      if (b) {
        b.job = ji;
        if (lifecycle === "cancelled" && cancelled) {
          b.status = "cancelled";
          b.cancelled = { at: cancelled.at, was: "confirmed" };
          b.job = null;
          jobs[ji] = { ...jobs[ji]!, booking: null };
        }
      }
    }

    // An install day is preceded by a supply-house pickup and followed by the
    // city's inspection.
    if (d.kind === "installSystem" && completed) {
      const pickup = first - 1;
      calendarEvents.push(
        event(cal.isWeekday(pickup) ? pickup : cal.weekdayOnOrBefore(pickup), "07:00", "07:45", `Pick up condenser — ${VENDORS.supply[0]}`, "amber", {
          job: ji,
          notes: "Order is under the business account.",
        }),
      );
    }
    if (spec.serviceType === "installation" && (d.kind === "installSystem" || d.kind === "installFurnace")) {
      let day = cal.nextWeekday(last);
      day = cal.nextWeekday(day);
      if (board.isWorkday(day)) {
        for (const s of [toMinutes("10:00"), toMinutes("11:30"), toMinutes("15:30")]) {
          if (board.free(day, s, s + 60)) {
            reserveEvent(
              event(day, toHhmm(s), toHhmm(s + 60), `City mechanical inspection — ${c.lastName}`, "blue", {
                customer: d.customer,
                job: ji,
                contactName: fullName(d.customer),
                contactPhone: c.phone,
                address: c.address,
                notes: "Inspector needs attic and outdoor unit access.",
              }),
            );
            break;
          }
        }
      }
    }

    // An estimate visit turns into a quote that evening or the next day.
    if (lifecycle === "completed" && completed) {
      const quoting = d.kind === "estimate" || (d.kind === "diagnostic" && rng.chance(0.5));
      if (quoting) {
        const issued = when(Math.min(completed.day + rng.int(0, 1), 0), rng.step(toMinutes("17:30"), toMinutes("20:30"), 5));
        issueQuote(d.customer, later(issued, plus(completed, 30)), rng.weighted(quoteWeights(season)));
      }
      // Now and then a repair needs a free return visit.
      if (REPAIR_KINDS.includes(d.kind) && warrantyCallbacks < 2 && rng.chance(0.12)) {
        const createdDay = completed.day + rng.int(5, 15);
        if (createdDay <= 0) {
          warrantyCallbacks += 1;
          enqueue(
            demand({
              customer: d.customer,
              kind: "warranty",
              created: when(createdDay, officeTime()),
              earliest: createdDay + 1,
              latest: createdDay + 10,
              via: "warranty",
              notes: "No charge — covered by our one-year labour warranty.",
            }),
          );
        }
      }
    }
  }

  // Bookings whose job is done were mostly closed off by the owner too.
  for (const b of bookings) {
    if (b.job === null) continue;
    const job = jobs[b.job];
    if (!job || job.lifecycle !== "completed" || !job.completed) continue;
    if (rng.chance(0.6)) {
      const at = plus(job.completed, rng.int(10, 900));
      b.status = "completed";
      b.completedAt = at.day > 0 ? plus(job.completed, 10) : at;
    }
  }

  /* ── invoices ──────────────────────────────────────────────────────── */

  const paymentMethod = (): PaymentMethod =>
    rng.weighted<PaymentMethod>([
      { value: "credit_card", weight: 45 },
      { value: "check", weight: 30 },
      { value: "bank_transfer", weight: 15 },
      { value: "cash", weight: 10 },
    ]);
  const reference = (method: PaymentMethod): string | null =>
    method === "check"
      ? `Check #${rng.int(1040, 4890)}`
      : method === "credit_card"
        ? `Card ending ${rng.int(1000, 9999)}`
        : method === "bank_transfer"
          ? `ACH ${rng.int(100000, 999999)}`
          : null;

  const firstInvoiceFor = new Set<number>();
  let voided = false;
  let overpaid = false;

  const billable = jobs
    .map((job, ji) => ({ job, ji }))
    .filter(({ job }) => job.lifecycle === "completed" && job.completed && job.lines.length > 0)
    .sort((a, b) => (a.job.completed && b.job.completed && isBefore(a.job.completed, b.job.completed) ? -1 : 1));

  for (const { job, ji } of billable) {
    const done = job.completed;
    if (!done) continue;
    const issuedDay = Math.min(rng.chance(0.75) ? done.day : cal.nextWeekday(done.day), 0);
    const issued = notAfterToday(later(when(issuedDay, rng.step(toMinutes("16:30"), toMinutes("20:00"), 5)), plus(done, 15)));
    const age = -issued.day;
    const isPlan = job.notes?.startsWith("Comfort Club") ?? false;
    const isInstall = job.kind === "installSystem" || job.kind === "installFurnace";
    const cust = customerAt(job.customer);
    // A quoted job is billed at the quoted price, discount included; a referred
    // customer gets $25 off their first invoice.
    const quoted = job.quote !== null ? quotes[job.quote] : undefined;
    const discount = quoted
      ? quoted.discount
      : cust.source === "referral" && !firstInvoiceFor.has(job.customer)
        ? 25
        : 0;
    firstInvoiceFor.add(job.customer);

    const payments: PaymentSpec[] = [];
    const payOn = (from: number, spread: number) => Math.min(from + rng.int(0, spread), 0);
    if (isPlan) {
      payments.push({ share: "rest", extra: 0, day: issued.day, method: "credit_card", reference: reference("credit_card") });
    } else if (isInstall) {
      payments.push({ share: 0.5, extra: 0, day: issued.day, method: rng.pick<PaymentMethod>(["check", "bank_transfer"]), reference: null });
      const restDay = issued.day + rng.int(5, 14);
      if (restDay <= 0) payments.push({ share: "rest", extra: 0, day: restDay, method: "check", reference: null });
    } else {
      const roll = rng.next();
      const paid = age >= 25 ? roll < 0.82 : age >= 10 ? roll < 0.65 : roll < 0.45;
      const partial = !paid && (age >= 25 ? roll < 0.88 : age >= 10 ? roll < 0.73 : false);
      if (paid) {
        const method = age < 10 ? rng.pick<PaymentMethod>(["credit_card", "cash"]) : paymentMethod();
        const extra = !overpaid && method === "check" && age >= 10 ? 20 : 0;
        if (extra > 0) overpaid = true;
        payments.push({ share: "rest", extra, day: age < 10 ? issued.day : payOn(issued.day, 14), method, reference: null });
      } else if (partial) {
        payments.push({ share: 0.5, extra: 0, day: payOn(issued.day, 6), method: paymentMethod(), reference: null });
      }
    }
    for (const p of payments) p.reference = p.reference ?? reference(p.method);

    const draft = age <= 2 && !isPlan && payments.length === 0 && rng.chance(0.35);

    // One invoice went out with the wrong labour, was voided and re-issued.
    if (!voided && age >= 20 && !isPlan && !isInstall && payments.length > 0) {
      voided = true;
      invoices.push({
        job: ji,
        customer: job.customer,
        issued,
        sent: true,
        void: true,
        lines: job.lines.map((l) => (l.itemType === "labor" ? { ...l, quantity: l.quantity + 1 } : { ...l })),
        discount,
        payments: [],
        notes: "Voided — labour hours were entered wrong. Re-issued.",
      });
      invoices.push({
        job: ji,
        customer: job.customer,
        issued: plus(issued, 60 * 15),
        sent: true,
        void: false,
        lines: job.lines.map((l) => ({ ...l })),
        discount,
        payments,
        notes: "Re-issued with corrected labour hours.",
      });
      continue;
    }

    invoices.push({
      job: ji,
      customer: job.customer,
      issued,
      sent: !draft,
      void: false,
      lines: job.lines.map((l) => ({ ...l })),
      discount,
      payments: draft ? [] : payments,
      notes: isPlan ? "Tune-up covered by your Comfort Club plan." : null,
    });
  }

  // Membership fees for plans that started inside the window.
  for (const contract of contracts) {
    if (contract.startDay < -PAST_DAYS || contract.startDay > 0) continue;
    const issued = when(contract.startDay, rng.step(toMinutes("09:00"), toMinutes("16:00"), 5));
    invoices.push({
      job: null,
      customer: contract.customer,
      issued: later(issued, plus(customerAt(contract.customer).joined, 30)),
      sent: true,
      void: false,
      lines: [
        {
          catalog: null,
          itemType: "service_call",
          description: `${contract.name} — 12-month membership`,
          quantity: 1,
          unitPrice: contract.annualPrice,
          unitCost: null,
        },
      ],
      discount: 0,
      payments: [{ share: "rest", extra: 0, day: contract.startDay, method: "credit_card", reference: reference("credit_card") }],
      notes: "Thanks for joining the Comfort Club.",
    });
  }

  /* ── tags ──────────────────────────────────────────────────────────── */

  const addTag = (ci: number, tag: string) => {
    const c = customerAt(ci);
    if (!TAGS.some((t) => t.name === tag)) throw new Error(`Unknown tag "${tag}"`);
    if (!c.tags.includes(tag)) c.tags.push(tag);
  };
  const invoiceTotal = (inv: InvoiceSpec) =>
    inv.void ? 0 : inv.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) - inv.discount;
  const spend = new Map<number, number>();
  for (const inv of invoices) spend.set(inv.customer, (spend.get(inv.customer) ?? 0) + invoiceTotal(inv));
  [...spend.entries()]
    .filter(([ci]) => active(ci))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .forEach(([ci]) => addTag(ci, "VIP"));
  for (const contract of contracts) addTag(contract.customer, "Maintenance plan");
  customers.forEach((c, ci) => {
    const m = metaAt(ci);
    if (m.segment === "landlord") addTag(ci, "Landlord");
    if (m.segment === "commercial") addTag(ci, "Commercial");
    if (c.source === "referral") addTag(ci, "Referral");
    if (m.jobs.length >= 3) addTag(ci, "Repeat customer");
    if (m.jobs.some((ji) => jobs[ji]?.kind === "warranty")) addTag(ci, "Warranty");
  });
  for (const inv of invoices) {
    if (inv.void || !inv.sent) continue;
    const paidShare = inv.payments.some((p) => p.share === "rest") ? 1 : inv.payments.length > 0 ? 0.5 : 0;
    if (paidShare < 1 && -inv.issued.day > NET_DAYS) addTag(inv.customer, "Past due");
  }

  /* ── notifications ─────────────────────────────────────────────────── */

  const recent = (at: When) => at.day >= -30;
  const read = (at: When) => at.day < -3 || (at.day < 0 && rng.chance(0.5));

  bookings.forEach((b, bi) => {
    if (recent(b.created)) {
      notifications.push({ type: "booking_received", ref: { kind: "booking", index: bi }, at: b.created, read: read(b.created), payment: 0 });
    }
    if (b.cancelled && recent(b.cancelled.at)) {
      notifications.push({ type: "booking_cancelled", ref: { kind: "booking", index: bi }, at: b.cancelled.at, read: read(b.cancelled.at), payment: 0 });
    }
  });
  quotes.forEach((q, qi) => {
    if (!q.responded || !recent(q.responded)) return;
    const type = q.status === "accepted" ? "quote_accepted" : q.status === "declined" ? "quote_declined" : null;
    if (type) notifications.push({ type, ref: { kind: "quote", index: qi }, at: q.responded, read: read(q.responded), payment: 0 });
  });
  invoices.forEach((inv, ii) => {
    inv.payments.forEach((p, pi) => {
      const at = when(p.day, rng.step(toMinutes("09:00"), toMinutes("18:00"), 5));
      if (recent(at)) notifications.push({ type: "invoice_paid", ref: { kind: "invoice", index: ii }, at, read: read(at), payment: pi });
    });
  });
  // The overdue sweep's notice, the morning after the due date (Net 15 is the
  // tenant's terms), for every invoice that is still not settled.
  invoices.forEach((inv, ii) => {
    if (inv.void || !inv.sent) return;
    if (inv.payments.some((p) => p.share === "rest")) return;
    const dueDay = inv.issued.day + NET_DAYS;
    if (dueDay >= 0) return;
    const at = when(dueDay + 1, toMinutes("09:00"));
    notifications.push({ type: "invoice_overdue", ref: { kind: "invoice", index: ii }, at, read: read(at), payment: 0 });
  });

  notifications.sort((a, b) => (isBefore(a.at, b.at) ? -1 : 1));

  return {
    tenant: TENANT_PROFILE,
    defaultLaborCostRate: DEFAULT_LABOR_COST_RATE,
    memberRates: [],
    catalog: CATALOG,
    tags: TAGS,
    customers,
    customerNotes,
    equipment,
    contracts,
    checklists: CHECKLISTS,
    quotes,
    bookings,
    jobs,
    invoices,
    calendarEvents,
    scheduleOverrides,
    notifications,
  };
}
