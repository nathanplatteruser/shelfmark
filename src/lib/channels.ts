export const CHANNEL_KINDS = ["rest", "file", "closed"] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export const LISTING_STATUSES = [
  "queued",
  "live",
  "sold",
  "delisting",
  "ended",
  "failed",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type ChannelDef = {
  slug: string;
  name: string;
  mark: string;
  kind: ChannelKind;
  listable: boolean;
  defaultOn: boolean;
  supportsAuction: boolean;
  supportsBin: boolean;
  skuField: string;
  wire: string;
  inbound: string;
  outboundList: string;
  outboundDelist: string;
  cadence: string;
  blurb: string;
};

/** Catalog of used-book shelves Shelfmark can speak to. Source of truth for copy, not the DB. */
export const CHANNELS: ChannelDef[] = [
  {
    slug: "ebay",
    name: "eBay",
    mark: "EB",
    kind: "rest",
    listable: true,
    defaultOn: true,
    supportsAuction: true,
    supportsBin: true,
    skuField: "SKU / CustomLabel",
    wire: "Sell Inventory API, Trading EndItem, Commerce Notification API",
    inbound: "Push: order created / item sold. Fallback: Fulfillment API poll.",
    outboundList: "Create inventory item + offer and publish, or Seller Hub CSV.",
    outboundDelist: "EndItem / withdraw offer, or quantity 0 with Out-of-Stock Control.",
    cadence: "Seconds",
    blurb: "The general marketplace. Auctions live here only. Best real-time pair.",
  },
  {
    slug: "amazon",
    name: "Amazon",
    mark: "AZ",
    kind: "rest",
    listable: true,
    defaultOn: true,
    supportsAuction: false,
    supportsBin: true,
    skuField: "seller-sku",
    wire: "Selling Partner API — Listings Items, Feeds, Orders, Notifications",
    inbound: "ORDER_CHANGE and LISTINGS_ITEM_MFN_QUANTITY_CHANGE. Buyer street needs a Restricted Data Token.",
    outboundList: "Used copies as merchant-fulfilled (MFN). Not FBA.",
    outboundDelist: "PATCH quantity to 0, or delete the listings item.",
    cadence: "Seconds to a few minutes",
    blurb: "Biggest used-book demand. Developer + selling-partner approval required.",
  },
  {
    slug: "abebooks",
    name: "AbeBooks",
    mark: "AB",
    kind: "rest",
    listable: true,
    defaultOn: true,
    supportsAuction: false,
    supportsBin: true,
    skuField: "vendorBookID",
    wire: "Inventory Update API (XML/HTTPS) and Order Update API",
    inbound: "Pull: searchOrders on the Order Update API. No public webhook.",
    outboundList: "transactionType=add, vendorBookID = Shelfmark SKU, up to 100 books/call.",
    outboundDelist: "transactionType=delete by vendorBookID.",
    cadence: "Near-real-time inventory; orders on a short poll",
    blurb: "The used and rare-book native, Amazon-owned. Closest cousin to the old B&N marketplace feed.",
  },
  {
    slug: "biblio",
    name: "Biblio",
    mark: "BL",
    kind: "file",
    listable: true,
    defaultOn: true,
    supportsAuction: false,
    supportsBin: true,
    skuField: "SKU / Book ID",
    wire: "FTP or dashboard upload — UIEE, tab, HomeBase, custom filter",
    inbound: "Order files and the seller dashboard. Not a REST webhook.",
    outboundList: "File with SKU, author, title, description, price. Biblio can also route onward.",
    outboundDelist: "Delete-status row in the next file, or bulk-delete by SKU.",
    cadence: "Minutes, on the next drop",
    blurb: "Independent book marketplace. File-based, reliable, no public listing REST API.",
  },
  {
    slug: "alibris",
    name: "Alibris",
    mark: "AL",
    kind: "file",
    listable: true,
    defaultOn: true,
    supportsAuction: false,
    supportsBin: true,
    skuField: "SKU",
    wire: "Dashboard / FTP upload — 1,200+ formats, UIEE, HomeBase, Excel skinny",
    inbound: "Order files and email. Not a REST webhook.",
    outboundList: "Skinny file: ISBN, condition, price — their catalog fills the rest.",
    outboundDelist: "Delete or quantity-0 row in the next file.",
    cadence: "Minutes, on the next drop",
    blurb: "Used books, media, and textbooks. File in, file out.",
  },
  {
    slug: "barnes",
    name: "Barnes & Noble",
    mark: "BN",
    kind: "closed",
    listable: false,
    defaultOn: false,
    supportsAuction: false,
    supportsBin: false,
    skuField: "—",
    wire: "None",
    inbound: "None",
    outboundList: "Marketplace dealer program ended 26 March 2020.",
    outboundDelist: "—",
    cadence: "—",
    blurb: "Not a listing destination. Used to be fed by Alibris. The same sell-once flow now runs on AbeBooks.",
  },
];

export const LISTABLE_CHANNELS = CHANNELS.filter((c) => c.listable);
export const DEFAULT_CHANNEL_SLUGS = LISTABLE_CHANNELS.filter((c) => c.defaultOn).map((c) => c.slug);

export function channelBySlug(slug: string): ChannelDef | undefined {
  return CHANNELS.find((c) => c.slug === slug);
}

export function channelsForFormat(listFormat: string, slugs: string[]): string[] {
  return slugs.filter((slug) => {
    const ch = channelBySlug(slug);
    if (!ch || !ch.listable) return false;
    if (listFormat === "auction") return ch.supportsAuction;
    return ch.supportsBin;
  });
}

export function remoteIdFor(slug: string, sku: string, seq = 1): string {
  const digits = sku.replace(/\D/g, "") || String(seq);
  if (slug === "ebay") return `33${digits.slice(-10).padStart(10, "0")}`;
  if (slug === "amazon") return sku;
  return sku;
}

export function orderRefFor(slug: string, copyId: number): string {
  const n = 100000 + (copyId * 17) % 900000;
  if (slug === "ebay") return `16-${n}-39${String(copyId).padStart(4, "0")}`;
  if (slug === "amazon") return `112-7${n}-4${String(copyId).padStart(6, "0")}`;
  if (slug === "abebooks") return `AB-${n}`;
  if (slug === "biblio") return `B-${n}`;
  if (slug === "alibris") return `AL-${n}`;
  return `ORD-${n}`;
}

export const DEMO_SHIP_TO: Record<string, { city: string; region: string }> = {
  ebay: { city: "Portland", region: "OR" },
  amazon: { city: "Austin", region: "TX" },
  abebooks: { city: "Omaha", region: "NE" },
  biblio: { city: "Madison", region: "WI" },
  alibris: { city: "Denver", region: "CO" },
};

export type ChannelAccount = {
  slug: string;
  connected: boolean;
  connectedAt: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  note: string;
};

export type ChannelListing = {
  id: number;
  copyId: number;
  channelSlug: string;
  remoteId: string;
  status: ListingStatus;
  pushMethod: "api" | "file";
  lastError: string;
  listedAt: string | null;
  endedAt: string | null;
};

export type SaleRecord = {
  id: number;
  copyId: number;
  channelSlug: string;
  orderRef: string;
  soldPrice: number;
  shipCity: string;
  shipRegion: string;
  shipService: string;
  soldAt: string;
  createdAt: string;
};

export type SyncEvent = {
  id: number;
  copyId: number | null;
  saleId: number | null;
  kind: string;
  channelSlug: string | null;
  detail: string;
  createdAt: string;
};

export type CopyListings = {
  copyId: number;
  sku: string;
  title: string;
  author: string;
  coverUrl: string;
  binLocation: string;
  listPrice: number | null;
  status: string;
  isbn13: string;
  listings: ChannelListing[];
  sale: SaleRecord | null;
};
