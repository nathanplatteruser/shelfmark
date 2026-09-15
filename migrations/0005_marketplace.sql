-- Live eBay / Amazon seller connections. Tokens are per signed-in family account.
create table if not exists marketplace_accounts (
  user_id text not null,
  channel text not null,
  client_id text not null default '',
  client_secret text not null default '',
  runame text not null default '',
  access_token text not null default '',
  refresh_token text not null default '',
  token_expires_at timestamptz,
  seller_id text not null default '',
  marketplace_id text not null default '',
  ship_city text not null default '',
  ship_region text not null default '',
  ship_postal text not null default '',
  ship_country text not null default 'US',
  merchant_location_key text not null default 'SHELFMARK-HOME',
  fulfillment_policy_id text not null default '',
  payment_policy_id text not null default '',
  return_policy_id text not null default '',
  connected boolean not null default false,
  connected_at timestamptz,
  last_error text not null default '',
  last_list_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

create table if not exists marketplace_oauth_state (
  state text primary key,
  user_id text not null,
  channel text not null,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_oauth_user_idx on marketplace_oauth_state (user_id);
