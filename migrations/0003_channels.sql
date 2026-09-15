-- Multi-channel homebase: one copy, many shelves, sell once.
-- Unowned operational rows (auth off). No buyer names, emails, or street addresses.

create table if not exists channel_accounts (
  slug text primary key,
  connected boolean not null default true,
  connected_at timestamptz,
  last_push_at timestamptz,
  last_pull_at timestamptz,
  note text not null default ''
);

create table if not exists channel_listings (
  id serial primary key,
  copy_id integer not null references copies(id),
  channel_slug text not null,
  remote_id text not null default '',
  status text not null default 'queued',
  push_method text not null default 'api',
  last_error text not null default '',
  listed_at timestamptz,
  ended_at timestamptz,
  unique (copy_id, channel_slug)
);

create index if not exists channel_listings_copy_idx on channel_listings (copy_id);
create index if not exists channel_listings_channel_idx on channel_listings (channel_slug, status);

create table if not exists sales (
  id serial primary key,
  copy_id integer not null references copies(id),
  channel_slug text not null,
  order_ref text not null,
  sold_price numeric not null,
  ship_city text not null default '',
  ship_region text not null default '',
  ship_service text not null default 'USPS Media Mail',
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sales_copy_idx on sales (copy_id);
create index if not exists sales_created_idx on sales (created_at desc);

create table if not exists sync_events (
  id serial primary key,
  copy_id integer,
  sale_id integer,
  kind text not null,
  channel_slug text,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists sync_events_created_idx on sync_events (created_at desc);
create index if not exists sync_events_copy_idx on sync_events (copy_id);
