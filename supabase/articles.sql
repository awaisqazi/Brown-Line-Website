-- Schema for public.articles: the newsletter issues that live on the site
-- itself (older issues stay on Beehiiv; see MIGRATED_ISSUES in src/lib/issues.ts).
--
-- Run this ONCE in the Supabase SQL editor (or via supabase db query). This
-- project applies DDL directly to the hosted database and documents it in
-- PRIVATE_README.md; there is no migrations directory. Run
-- supabase/articles-seed.sql afterwards to load the two existing issues.
--
-- Authorization reuses the events admin credential: RLS policies call
-- private.events_admin_password_matches(), which reads the x-admin-password
-- request header. That function already exists (created with the events
-- tables); this file must not recreate it.

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  -- URL segment under /newsletter/. Unique because it is the public route key.
  slug text not null unique,
  title text not null,
  -- Kicker above the headline, same vocabulary as the homepage issue cards.
  category text not null,
  -- Topical tags, free text: these drive the similar-articles rail, so they are
  -- deliberately not restricted to the fixed nine-tag events taxonomy.
  tags text[] not null default '{}',
  -- One or two sentences in the newsletter's voice, shown on similar cards.
  summary text not null default '',
  -- Meta description for the share card and search results.
  description text not null default '',
  -- Article body as HTML. <hr class="transit-divider-slot" /> marks each place
  -- the site's TransitDivider belongs; the renderer swaps the marker for the
  -- real divider markup.
  body_html text not null default '',
  -- Either an absolute http(s) URL or a site-relative path such as
  -- /images/newsletter/<slug>/hero.png for art committed under public/.
  hero_image_url text,
  hero_alt text,
  -- Optional art credit rendered under the hero frame; may contain a link.
  hero_credit_html text,
  published_at timestamptz not null,
  -- Drafts stay in the admin list only: the public SELECT policy hides them.
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_hero_image_url_scheme check (
    hero_image_url is null
    or hero_image_url ~ '^https?://'
    or hero_image_url ~ '^/'
  )
);

create index if not exists articles_published_at_idx
  on public.articles (published_at desc);

-- updated_at is maintained server side so it cannot drift when a client omits it.
create or replace function public.articles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row
  execute function public.articles_set_updated_at();

alter table public.articles enable row level security;

drop policy if exists "Published articles are publicly readable" on public.articles;
create policy "Published articles are publicly readable"
  on public.articles
  for select
  to anon, authenticated
  using (is_published);

-- Admin reads (drafts included) and writes all go through the same header
-- password check the events admin portal uses.
drop policy if exists "Admin portal can read all articles" on public.articles;
create policy "Admin portal can read all articles"
  on public.articles
  for select
  to anon, authenticated
  using (private.events_admin_password_matches());

drop policy if exists "Admin portal can insert articles" on public.articles;
create policy "Admin portal can insert articles"
  on public.articles
  for insert
  to anon, authenticated
  with check (
    private.events_admin_password_matches()
    and length(btrim(slug)) > 0
    and length(btrim(title)) > 0
    and length(btrim(category)) > 0
  );

drop policy if exists "Admin portal can update articles" on public.articles;
create policy "Admin portal can update articles"
  on public.articles
  for update
  to anon, authenticated
  using (private.events_admin_password_matches())
  with check (
    private.events_admin_password_matches()
    and length(btrim(slug)) > 0
    and length(btrim(title)) > 0
    and length(btrim(category)) > 0
  );

drop policy if exists "Admin portal can delete articles" on public.articles;
create policy "Admin portal can delete articles"
  on public.articles
  for delete
  to anon, authenticated
  using (private.events_admin_password_matches());

notify pgrst, 'reload schema';
