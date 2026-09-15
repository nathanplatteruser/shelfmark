import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  CHANNELS,
  DEMO_SHIP_TO,
  DEFAULT_CHANNEL_SLUGS,
  channelBySlug,
  channelsForFormat,
  orderRefFor,
  remoteIdFor,
  type ChannelAccount,
  type ChannelListing,
  type CopyListings,
  type ListingStatus,
  type SaleRecord,
  type SyncEvent,
} from "@/lib/channels";

type AccountRow = {
  slug: string;
  connected: boolean;
  connected_at: string | null;
  last_push_at: string | null;
  last_pull_at: string | null;
  note: string;
};

type ListingRow = {
  id: number;
  copy_id: number;
  channel_slug: string;
  remote_id: string;
  status: string;
  push_method: string;
  last_error: string;
  listed_at: string | null;
  ended_at: string | null;
};

type SaleRow = {
  id: number;
  copy_id: number;
  channel_slug: string;
  order_ref: string;
  sold_price: string | number;
  ship_city: string;
  ship_region: string;
  ship_service: string;
  sold_at: string;
  created_at: string;
};

type EventRow = {
  id: number;
  copy_id: number | null;
  sale_id: number | null;
  kind: string;
  channel_slug: string | null;
  detail: string;
  created_at: string;
};

function num(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapAccount(row: AccountRow): ChannelAccount {
  return {
    slug: row.slug,
    connected: row.connected,
    connectedAt: row.connected_at,
    lastPushAt: row.last_push_at,
    lastPullAt: row.last_pull_at,
    note: row.note,
  };
}

function mapListing(row: ListingRow): ChannelListing {
  return {
    id: row.id,
    copyId: row.copy_id,
    channelSlug: row.channel_slug,
    remoteId: row.remote_id,
    status: row.status as ListingStatus,
    pushMethod: row.push_method === "file" ? "file" : "api",
    lastError: row.last_error,
    listedAt: row.listed_at,
    endedAt: row.ended_at,
  };
}

function mapSale(row: SaleRow): SaleRecord {
  return {
    id: row.id,
    copyId: row.copy_id,
    channelSlug: row.channel_slug,
    orderRef: row.order_ref,
    soldPrice: num(row.sold_price),
    shipCity: row.ship_city,
    shipRegion: row.ship_region,
    shipService: row.ship_service,
    soldAt: row.sold_at,
    createdAt: row.created_at,
  };
}

function mapEvent(row: EventRow): SyncEvent {
  return {
    id: row.id,
    copyId: row.copy_id,
    saleId: row.sale_id,
    kind: row.kind,
    channelSlug: row.channel_slug,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

export async function ensureChannelAccounts(): Promise<void> {
  const sql = await getSql();
  for (const ch of CHANNELS) {
    const connected = ch.kind !== "closed";
    await sql`
      insert into channel_accounts (slug, connected, connected_at, note)
      values (
        ${ch.slug},
        ${connected},
        ${connected ? new Date().toISOString() : null},
        ${ch.kind === "closed" ? "Marketplace closed 2020" : ""}
      )
      on conflict (slug) do nothing
    `;
  }
}

export async function writeListingsForCopy(opts: {
  copyId: number;
  sku: string;
  listFormat: string;
  slugs: string[];
  status?: "queued" | "live";
}): Promise<ChannelListing[]> {
  const sql = await getSql();
  const now = new Date().toISOString();
  const slugs = channelsForFormat(opts.listFormat, opts.slugs);
  const out: ChannelListing[] = [];
  for (const slug of slugs) {
    const ch = channelBySlug(slug);
    if (!ch) continue;
    const method = ch.kind === "file" ? "file" : "api";
    const status = opts.status ?? "live";
    const remote = remoteIdFor(slug, opts.sku, opts.copyId);
    const rows = await sql<ListingRow>`
      insert into channel_listings (
        copy_id, channel_slug, remote_id, status, push_method, listed_at
      ) values (
        ${opts.copyId}, ${slug}, ${remote}, ${status}, ${method}, ${now}
      )
      on conflict (copy_id, channel_slug) do update set
        remote_id = excluded.remote_id,
        status = excluded.status,
        push_method = excluded.push_method,
        listed_at = excluded.listed_at,
        ended_at = null,
        last_error = ''
      returning *
    `;
    if (rows[0]) out.push(mapListing(rows[0]));
  }
  for (const slug of slugs) {
    await sql`update channel_accounts set last_push_at = ${now} where slug = ${slug}`;
  }
  return out;
}

type CopyLite = {
  id: number;
  sku: string;
  title: string;
  author: string;
  cover_url: string;
  bin_location: string;
  list_price: string | number | null;
  status: string;
  isbn13: string | null;
  sold_price: string | number | null;
};

async function backfillListingsIfEmpty(): Promise<void> {
  const sql = await getSql();
  const copies = await sql<CopyLite>`
    select id, sku, title, author, cover_url, bin_location, list_price, status, isbn13, sold_price
    from copies
    where status in ('listed', 'sold', 'shipped', 'ready')
    order by id
  `;

  for (const copy of copies) {
    const have = await sql<{ n: number }>`
      select count(*)::int as n from channel_listings where copy_id = ${copy.id}
    `;
    if ((have[0]?.n ?? 0) > 0) continue;
    const isbn = copy.isbn13 ?? "";
    let slugs = DEFAULT_CHANNEL_SLUGS;
    if (isbn === "9780807508527") slugs = DEFAULT_CHANNEL_SLUGS;
    else if (isbn === "9780439023481") slugs = ["ebay", "amazon"];
    else if (isbn === "9780061120084") slugs = ["ebay"];
    else if (isbn === "9780743273565") slugs = DEFAULT_CHANNEL_SLUGS;
    else if (copy.status === "ready") slugs = [];
    else slugs = ["ebay"];

    if (slugs.length === 0) continue;

    const now = new Date().toISOString();
    for (const slug of slugs) {
      const ch = channelBySlug(slug);
      if (!ch) continue;
      const method = ch.kind === "file" ? "file" : "api";
      let listingStatus: ListingStatus = "live";
      if (copy.status === "sold" || copy.status === "shipped") {
        listingStatus = slug === slugs[0] ? "sold" : "ended";
      }
      await sql`
        insert into channel_listings (
          copy_id, channel_slug, remote_id, status, push_method, listed_at, ended_at
        ) values (
          ${copy.id},
          ${slug},
          ${remoteIdFor(slug, copy.sku, copy.id)},
          ${listingStatus},
          ${method},
          ${now},
          ${listingStatus === "ended" || listingStatus === "sold" ? now : null}
        )
        on conflict (copy_id, channel_slug) do nothing
      `;
    }

    if (copy.status === "sold" || copy.status === "shipped") {
      const winner = slugs[0];
      const ship = DEMO_SHIP_TO[winner] ?? { city: "Lincoln", region: "NE" };
      const price = num(copy.sold_price) || num(copy.list_price) || 7.99;
      const existing = await sql<{ n: number }>`
        select count(*)::int as n from sales where copy_id = ${copy.id}
      `;
      if ((existing[0]?.n ?? 0) === 0) {
        const saleRows = await sql<SaleRow>`
          insert into sales (
            copy_id, channel_slug, order_ref, sold_price, ship_city, ship_region, ship_service, sold_at
          ) values (
            ${copy.id}, ${winner}, ${orderRefFor(winner, copy.id)}, ${price},
            ${ship.city}, ${ship.region}, ${"USPS Media Mail"}, ${now}
          )
          returning *
        `;
        const sale = saleRows[0];
        await sql`
          insert into sync_events (copy_id, sale_id, kind, channel_slug, detail)
          values (
            ${copy.id},
            ${sale.id},
            ${"inbound_sale"},
            ${winner},
            ${`${channelBySlug(winner)?.name ?? winner} sold ${copy.title} for $${price.toFixed(2)}`}
          )
        `;
        await sql`
          insert into sync_events (copy_id, sale_id, kind, channel_slug, detail)
          values (
            ${copy.id},
            ${sale.id},
            ${"copy_closed"},
            ${null},
            ${`Copy ${copy.sku} closed. Bin ${copy.bin_location} held for pick.`}
          )
        `;
        for (const slug of slugs.slice(1)) {
          await sql`
            insert into sync_events (copy_id, sale_id, kind, channel_slug, detail)
            values (
              ${copy.id},
              ${sale.id},
              ${"delist_ack"},
              ${slug},
              ${`Took ${copy.sku} down on ${channelBySlug(slug)?.name ?? slug} so it could not sell twice.`}
            )
          `;
        }
      }
    }
  }
}

export async function ensureChannelState(): Promise<void> {
  await ensureChannelAccounts();
  await backfillListingsIfEmpty();
}

export const bootstrapChannels = createServerFn({ method: "GET" }).handler(async () => {
  await ensureChannelState();
  return { ok: true as const };
});

export const listChannelBoard = createServerFn({ method: "GET" }).handler(async () => {
  await ensureChannelState();
  const sql = await getSql();

  const accounts = await sql<AccountRow>`select * from channel_accounts`;
  const accountMap = Object.fromEntries(accounts.map((a) => [a.slug, mapAccount(a)]));

  const copies = await sql<CopyLite>`
    select id, sku, title, author, cover_url, bin_location, list_price, status, isbn13, sold_price
    from copies
    where status in ('ready', 'listed', 'sold', 'shipped')
    order by updated_at desc
  `;
  const listings = await sql<ListingRow>`select * from channel_listings`;
  const sales = await sql<SaleRow>`select * from sales order by sold_at desc`;
  const events = await sql<EventRow>`select * from sync_events order by created_at desc, id desc limit 80`;

  const listingsByCopy = new Map<number, ChannelListing[]>();
  for (const row of listings) {
    const list = listingsByCopy.get(row.copy_id) ?? [];
    list.push(mapListing(row));
    listingsByCopy.set(row.copy_id, list);
  }
  const saleByCopy = new Map<number, SaleRecord>();
  for (const row of sales) {
    if (!saleByCopy.has(row.copy_id)) saleByCopy.set(row.copy_id, mapSale(row));
  }

  const board: CopyListings[] = copies.map((c) => ({
    copyId: c.id,
    sku: c.sku,
    title: c.title,
    author: c.author,
    coverUrl: c.cover_url,
    binLocation: c.bin_location,
    listPrice: c.list_price == null || c.list_price === "" ? null : num(c.list_price),
    status: c.status,
    isbn13: c.isbn13 ?? "",
    listings: listingsByCopy.get(c.id) ?? [],
    sale: saleByCopy.get(c.id) ?? null,
  }));

  return {
    channels: CHANNELS.map((ch) => ({
      ...ch,
      account: accountMap[ch.slug] ?? {
        slug: ch.slug,
        connected: ch.kind !== "closed",
        connectedAt: null,
        lastPushAt: null,
        lastPullAt: null,
        note: "",
      },
    })),
    copies: board,
    events: events.map(mapEvent),
    sales: sales.map(mapSale),
  };
});

const ingestSchema = z.object({
  copyId: z.number(),
  channelSlug: z.string(),
  soldPrice: z.number().optional(),
  shipCity: z.string().optional(),
  shipRegion: z.string().optional(),
});

export const ingestSale = createServerFn({ method: "POST" })
  .validator((input: unknown) => ingestSchema.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await ensureChannelAccounts();

    const ch = channelBySlug(data.channelSlug);
    if (!ch || !ch.listable) {
      return { ok: false as const, error: "That shelf is not a listing destination." };
    }

    const copies = await sql<CopyLite>`
      select id, sku, title, author, cover_url, bin_location, list_price, status, isbn13, sold_price
      from copies where id = ${data.copyId}
    `;
    const copy = copies[0];
    if (!copy) return { ok: false as const, error: "Copy not on the desk." };
    if (copy.status === "sold" || copy.status === "shipped") {
      return { ok: false as const, error: "Already closed. The other shelves should already be down." };
    }
    if (copy.status === "skipped" || copy.status === "draft") {
      return { ok: false as const, error: "This copy was never listed." };
    }

    let listings = await sql<ListingRow>`
      select * from channel_listings where copy_id = ${copy.id}
    `;
    if (listings.length === 0) {
      await writeListingsForCopy({
        copyId: copy.id,
        sku: copy.sku,
        listFormat: "bin",
        slugs: DEFAULT_CHANNEL_SLUGS,
        status: "live",
      });
      listings = await sql<ListingRow>`select * from channel_listings where copy_id = ${copy.id}`;
    }

    const winner = listings.find((l) => l.channel_slug === data.channelSlug);
    if (!winner) {
      return {
        ok: false as const,
        error: `${copy.title} is not live on ${ch.name}. List it there first.`,
      };
    }
    if (winner.status !== "live" && winner.status !== "queued") {
      return { ok: false as const, error: `${ch.name} is not currently offering this copy.` };
    }

    const now = new Date().toISOString();
    const price = data.soldPrice ?? num(copy.list_price) ?? 8.5;
    const ship = {
      city: data.shipCity || DEMO_SHIP_TO[ch.slug]?.city || "Lincoln",
      region: data.shipRegion || DEMO_SHIP_TO[ch.slug]?.region || "NE",
    };
    const orderRef = orderRefFor(ch.slug, copy.id);

    const saleRows = await sql<SaleRow>`
      insert into sales (
        copy_id, channel_slug, order_ref, sold_price, ship_city, ship_region, ship_service, sold_at
      ) values (
        ${copy.id}, ${ch.slug}, ${orderRef}, ${price},
        ${ship.city}, ${ship.region}, ${"USPS Media Mail"}, ${now}
      )
      returning *
    `;
    const sale = mapSale(saleRows[0]);

    await sql`
      update copies
      set status = ${"sold"}, sold_at = ${now}, sold_price = ${price}, updated_at = ${now}
      where id = ${copy.id}
    `;
    await sql`
      update channel_listings
      set status = ${"sold"}, ended_at = ${now}
      where id = ${winner.id}
    `;

    const events: { kind: string; channelSlug: string | null; detail: string }[] = [];
    events.push({
      kind: "inbound_sale",
      channelSlug: ch.slug,
      detail: `${ch.name} completed the sale. Order ${orderRef} · $${price.toFixed(2)} · ship to ${ship.city}, ${ship.region}.`,
    });
    events.push({
      kind: "copy_closed",
      channelSlug: null,
      detail: `Shelfmark closed ${copy.sku}. Bin ${copy.bin_location} is the pick. One copy, one buyer.`,
    });

    const others = listings.filter((l) => l.id !== winner.id && (l.status === "live" || l.status === "queued"));
    for (const listing of others) {
      const other = channelBySlug(listing.channel_slug);
      const method = listing.push_method === "file" ? "file" : "api";
      await sql`
        update channel_listings
        set status = ${"delisting"}
        where id = ${listing.id}
      `;
      const pushDetail =
        method === "file"
          ? `Queued a delete row for ${copy.sku} on the next ${other?.name ?? listing.channel_slug} file drop.`
          : other?.slug === "ebay"
            ? `EndItem NotAvailable on eBay item ${listing.remote_id}.`
            : other?.slug === "amazon"
              ? `PATCH listings item quantity=0 for seller-sku ${copy.sku}.`
              : other?.slug === "abebooks"
                ? `Inventory Update delete vendorBookID=${copy.sku}.`
                : `Take down ${copy.sku} on ${other?.name ?? listing.channel_slug}.`;
      events.push({
        kind: "delist_push",
        channelSlug: listing.channel_slug,
        detail: pushDetail,
      });
      await sql`
        update channel_listings
        set status = ${"ended"}, ended_at = ${now}
        where id = ${listing.id}
      `;
      events.push({
        kind: "delist_ack",
        channelSlug: listing.channel_slug,
        detail: `${other?.name ?? listing.channel_slug} listing ended. It cannot sell twice.`,
      });
    }

    events.push({
      kind: "safe",
      channelSlug: null,
      detail: `Homebase is clean. ${others.length} other shelf${others.length === 1 ? "" : "ves"} pulled. Pick from bin ${copy.bin_location}.`,
    });

    for (const ev of events) {
      await sql`
        insert into sync_events (copy_id, sale_id, kind, channel_slug, detail)
        values (${copy.id}, ${sale.id}, ${ev.kind}, ${ev.channelSlug}, ${ev.detail})
      `;
    }
    await sql`
      insert into activity (kind, copy_id, detail)
      values (
        ${"sold"},
        ${copy.id},
        ${`Sold on ${ch.name} · ${orderRef} · ${copy.title}`}
      )
    `;
    const touch = [ch.slug, ...others.map((o) => o.channel_slug)];
    for (const slug of touch) {
      await sql`
        update channel_accounts
        set last_pull_at = ${now}, last_push_at = ${now}
        where slug = ${slug}
      `;
    }

    const written = await sql<EventRow>`
      select * from sync_events where sale_id = ${sale.id} order by id
    `;

    return {
      ok: true as const,
      sale,
      events: written.map(mapEvent),
      title: copy.title,
      sku: copy.sku,
      binLocation: copy.bin_location,
      winner: ch.slug,
      pulled: others.map((o) => o.channel_slug),
    };
  });

export const pushCopyToChannels = createServerFn({ method: "POST" })
  .validator((input: { copyId: number; slugs?: string[] }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const copies = await sql<{
      id: number;
      sku: string;
      list_format: string;
      status: string;
    }>`select id, sku, list_format, status from copies where id = ${data.copyId}`;
    const copy = copies[0];
    if (!copy) return { ok: false as const, error: "Copy not found." };
    if (copy.status === "sold" || copy.status === "shipped" || copy.status === "skipped") {
      return { ok: false as const, error: "This copy is not listable." };
    }
    const slugs = data.slugs?.length ? data.slugs : DEFAULT_CHANNEL_SLUGS;
    const listings = await writeListingsForCopy({
      copyId: copy.id,
      sku: copy.sku,
      listFormat: copy.list_format,
      slugs,
      status: "live",
    });
    const now = new Date().toISOString();
    await sql`
      update copies set status = ${"listed"}, listed_at = ${now}, updated_at = ${now}
      where id = ${copy.id}
    `;
    await sql`
      insert into activity (kind, copy_id, detail)
      values (${"listed"}, ${copy.id}, ${`Pushed ${copy.sku} to ${listings.map((l) => l.channelSlug).join(", ")}`})
    `;
    return { ok: true as const, listings };
  });

export const listingsForCopies = createServerFn({ method: "POST" })
  .validator((input: { copyIds: number[] }) => input)
  .handler(async ({ data }) => {
    if (data.copyIds.length === 0) return [] as ChannelListing[];
    const sql = await getSql();
    const rows: ListingRow[] = [];
    for (const id of data.copyIds) {
      const part = await sql<ListingRow>`select * from channel_listings where copy_id = ${id}`;
      rows.push(...part);
    }
    return rows.map(mapListing);
  });
