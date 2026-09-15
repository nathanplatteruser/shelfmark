export const CONDITION_GRADES = [
  { id: "LN", label: "Like New", short: "Like new", hint: "Looks unread" },
  { id: "VG", label: "Very Good", short: "Very good", hint: "Light wear" },
  { id: "G", label: "Good", short: "Good", hint: "Reads well" },
  { id: "A", label: "Acceptable", short: "Acceptable", hint: "Worn but complete" },
] as const;

export type ConditionGrade = (typeof CONDITION_GRADES)[number]["id"];

export const DEFECTS = [
  { id: "highlight", label: "Highlight" },
  { id: "underline", label: "Underline" },
  { id: "writing", label: "Writing" },
  { id: "name", label: "Name inside" },
  { id: "exlib", label: "Ex-library" },
  { id: "water", label: "Water" },
  { id: "tear", label: "Tear" },
  { id: "spine", label: "Spine crease" },
  { id: "jacket", label: "Jacket wear" },
  { id: "odor", label: "Odor" },
  { id: "remainder", label: "Remainder mark" },
  { id: "stain", label: "Stain" },
] as const;

export type DefectId = (typeof DEFECTS)[number]["id"];

export const FORMATS = [
  "hardcover",
  "paperback",
  "mass-market",
  "trade",
  "textbook",
  "other",
] as const;

export type BookFormat = (typeof FORMATS)[number];

export const LIST_FORMATS = ["bin", "auction", "offer"] as const;
export type ListFormat = (typeof LIST_FORMATS)[number];

export const COPY_STATUSES = [
  "draft",
  "ready",
  "listed",
  "sold",
  "shipped",
  "skipped",
] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

export type CatalogBook = {
  isbn13: string;
  isbn10: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  pages: number | null;
  format: BookFormat;
  language: string;
  coverUrl: string;
  subjects: string;
  source: string;
};

export type CopyRecord = {
  id: number;
  sku: string;
  isbn13: string;
  isbn10: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  pages: number | null;
  format: BookFormat;
  language: string;
  coverUrl: string;
  subjects: string;
  conditionGrade: ConditionGrade | "";
  defects: DefectId[];
  conditionNotes: string;
  photos: string[];
  listFormat: ListFormat;
  listPrice: number | null;
  auctionStart: number | null;
  shippingWeightOz: number | null;
  binLocation: string;
  status: CopyStatus;
  ebayTitle: string;
  ebayDescription: string;
  conditionDescription: string;
  itemSpecifics: Record<string, string>;
  pricingRationale: string;
  shippingNote: string;
  skipReason: string;
  listedAt: string | null;
  soldAt: string | null;
  soldPrice: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DeskStats = {
  listedToday: number;
  readyCount: number;
  listedCount: number;
  soldCount: number;
  shippedCount: number;
  skippedCount: number;
  draftCount: number;
  inventoryValue: number;
  goal: number;
  duplicateIsbns: number;
};

export type ActivityRow = {
  id: number;
  kind: string;
  copyId: number | null;
  detail: string;
  createdAt: string;
};

export const CLIP_STATUSES = [
  "captured",
  "looked_up",
  "drafted",
  "listed",
  "skipped",
  "duplicate",
] as const;
export type ClipStatus = (typeof CLIP_STATUSES)[number];

export const REEL_KINDS = ["live", "practice", "upload"] as const;
export type ReelKind = (typeof REEL_KINDS)[number];

export type ReelRecord = {
  id: number;
  kind: ReelKind;
  status: string;
  taktMs: number;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  booksCaptured: number;
  booksListed: number;
  notes: string;
};

export type ReelClipRecord = {
  id: number;
  reelId: number;
  seq: number;
  isbn13: string;
  detectedAtMs: number;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  pages: number | null;
  format: BookFormat;
  language: string;
  coverUrl: string;
  subjects: string;
  catalogSource: string;
  stills: string[];
  suggestedGrade: ConditionGrade | "";
  suggestedPrice: number | null;
  conditionGrade: ConditionGrade | "";
  defects: DefectId[];
  ebayTitle: string;
  ebayDescription: string;
  copyId: number | null;
  status: ClipStatus;
  createdAt: string;
};

export type CrewStation = {
  id: number;
  slug: string;
  label: string;
  ageBand: string;
  duty: string;
  checklist: string[];
  todayCount: number;
  onDuty: boolean;
};
