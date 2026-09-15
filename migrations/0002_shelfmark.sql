-- Shelfmark inventory: unowned rows (auth off). Book copies, not people.
create table if not exists copies (
  id serial primary key,
  sku text not null unique,
  isbn13 text,
  isbn10 text,
  title text not null default '',
  author text not null default '',
  publisher text not null default '',
  published_year text not null default '',
  pages integer,
  format text not null default 'paperback',
  language text not null default 'English',
  cover_url text not null default '',
  subjects text not null default '',
  condition_grade text not null default '',
  defects jsonb not null default '[]'::jsonb,
  condition_notes text not null default '',
  photos jsonb not null default '[]'::jsonb,
  list_format text not null default 'bin',
  list_price numeric,
  auction_start numeric,
  shipping_weight_oz numeric,
  bin_location text not null default '',
  status text not null default 'draft',
  ebay_title text not null default '',
  ebay_description text not null default '',
  condition_description text not null default '',
  item_specifics jsonb not null default '{}'::jsonb,
  pricing_rationale text not null default '',
  shipping_note text not null default '',
  skip_reason text not null default '',
  listed_at timestamptz,
  sold_at timestamptz,
  sold_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists copies_status_idx on copies (status);
create index if not exists copies_isbn13_idx on copies (isbn13);
create index if not exists copies_sku_idx on copies (sku);
create index if not exists copies_created_idx on copies (created_at desc);

create table if not exists activity (
  id serial primary key,
  kind text not null,
  copy_id integer,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_created_idx on activity (created_at desc);
