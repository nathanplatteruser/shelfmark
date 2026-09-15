-- Video reel capture + crew stations. Unowned operational rows (auth off).
-- No personal names, emails, or kid identities — stations are roles.

create table if not exists reels (
  id serial primary key,
  kind text not null default 'practice',
  status text not null default 'recording',
  takt_ms integer not null default 3000,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer not null default 0,
  books_captured integer not null default 0,
  books_listed integer not null default 0,
  notes text not null default ''
);

create index if not exists reels_started_idx on reels (started_at desc);

create table if not exists reel_clips (
  id serial primary key,
  reel_id integer not null references reels(id),
  seq integer not null,
  isbn13 text not null default '',
  detected_at_ms integer not null default 0,
  title text not null default '',
  author text not null default '',
  publisher text not null default '',
  published_year text not null default '',
  pages integer,
  format text not null default 'paperback',
  language text not null default 'English',
  cover_url text not null default '',
  subjects text not null default '',
  catalog_source text not null default '',
  stills jsonb not null default '[]'::jsonb,
  suggested_grade text not null default '',
  suggested_price numeric,
  condition_grade text not null default '',
  defects jsonb not null default '[]'::jsonb,
  ebay_title text not null default '',
  ebay_description text not null default '',
  copy_id integer,
  status text not null default 'captured',
  created_at timestamptz not null default now()
);

create index if not exists reel_clips_reel_idx on reel_clips (reel_id, seq);
create index if not exists reel_clips_status_idx on reel_clips (status);

create table if not exists crew_stations (
  id serial primary key,
  slug text not null unique,
  label text not null,
  age_band text not null,
  duty text not null,
  checklist jsonb not null default '[]'::jsonb,
  today_count integer not null default 0,
  on_duty boolean not null default false,
  updated_at timestamptz not null default now()
);
