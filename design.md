# The Brown Line: Design System & Brand Guidelines

## 1. Brand Identity & Mission
- **Mission:** A cultural newsletter spotlighting Chicago's overlooked life-events, stories, and voices that mainstream outlets leave behind, told through a Global South diaspora lens.
- **Vibe:** Communal, gritty, real. 1970s Chicago transit, vintage roller discos, classic neon food signage, lo-fi cassettes.
- **Architecture:** "Warm Minimalism." Clean, spacious, robust layouts (inspired by itsmenna.com) skinned with nostalgic retro colors and typography.

## 2. Color Palette (Tailwind Design Tokens)
Do not use default Tailwind white (`#FFFFFF`) or black (`#000000`). Rely strictly on these brand colors:

| Role | Name | Hex Code | Usage |
| :--- | :--- | :--- | :--- |
| **Background** | Seashell | `#FAF1EC` | Main page backgrounds, card backgrounds. |
| **Primary/Text** | Dark Walnut | `#642713` | All body text, headings, primary borders, footer background. |
| **Accent 1** | Cayenne | `#F35A0F` | Primary Call-to-Action (Beehiiv button), urgent states, "terminus" stop on the mobile route map. |
| **Accent 2** | Amber | `#FFBC29` | Secondary highlights, tags, secondary button states, LED marquee text. |
| **Accent 3** | Celadon | `#90D393` | Tertiary accents, success states. |
| **Accent 4** | Maya Blue | `#5BC3FF` | Link underlines, hover accents, brand text-selection background, focus rings. |
| **Accent 5** | Baby Pink | `#F79CD0` | Decorative elements, opening "stop" on the mobile route map. |

Tailwind token names (camelCase, from `tailwind.config.mjs`): `seashell`, `darkWalnut`, `cayenne`, `amber`, `celadon`, `mayaBlue`, `babyPink`. Custom shadow tokens: `shadow-retro` (`4px 4px 0px #642713`), `shadow-retro-amber`, `shadow-retro-cayenne`.

## 3. Typography

Montserrat is the workhorse. JT Modernism is the showpiece. When in doubt, reach for Montserrat. The retro display face is reserved for editorial moments where the brand voice needs to shout.

### JT Modernism (Display only)
Custom local font, served from `public/fonts/JT Modernism - Header/`. Tailwind family: `font-heading`.

Use **only** for:
- The brand wordmark (logo as text).
- H1s on every page.
- Large section H2s (`text-4xl` and above).
- Large display numerals (e.g. the values strip `01 / 02 / 03`).
- Hero eyebrows and accent moments where a short line of display type sets the tone.

Styling: Dark Walnut color, used large, unapologetic, tightly tracked. Avoid JT Modernism at any size below `text-4xl`. It is built for impact, not for sustained reading.

**Sanctioned exception:** the `@thebrownline` handle on `/links` is rendered at `text-3xl` JT Modernism. This is the one acknowledged exception to the `text-4xl`+ floor, justified because a Link-in-Bio handle is a wordmark moment that needs to fit a `max-w-md` mobile column. Do not generalize this exception to other pages.

### Montserrat (Body, UI, and small headings)
Custom local font, served from `public/fonts/Montserrat - Body/`. Tailwind family: `font-body`. Weights: 400 (Regular), 600 (SemiBold), 700 (Bold). Extrabold via numeric `font-extrabold`.

Use for everything else:
- All paragraphs and lead text.
- H3 titles (issue card titles, values labels, sidebar headings).
- Buttons, form inputs, labels, tags, captions, eyebrows.
- Pull quotes (use `italic font-medium` at `text-2xl` or larger for editorial weight).
- Any inline emphasis inside a paragraph (use `font-bold` plus an accent color rather than switching to `font-heading`).

Styling: clean, generous line-height for readability. For small headings that need visual weight, use `font-extrabold` plus `uppercase tracking-widest` instead of switching to JT Modernism.

## 4. UI Component Styling Rules
- **Tactile Borders & Shadows:** Use sharp `2px solid #642713` (Dark Walnut) borders for input fields, cards, and buttons.
- **Retro Hover States:** Instead of soft blurs, use hard block shadows. E.g., `box-shadow: 4px 4px 0px #642713;`. On hover, interactive elements should shift slightly (`-translate-y-1` and `-translate-x-1`) and the shadow should deepen (e.g., from `4px 4px 0` to `6px 6px 0`).
- **Dividers:** Replace standard `<hr>` tags with a custom "Transit Stripe" component, a 5-color linear gradient line (Pink, Maya Blue, Celadon, Amber, Cayenne) to divide major sections.

## 5. Interaction Patterns

Reusable behaviors that show up across multiple components. When adding new UI, reach for one of these before inventing new motion.

### Link Transit Underline (`.link-transit`)
Defined in `src/styles/global.css`. A 5-color gradient bar slides in left-to-right (200ms ease) below the text on `:hover` and `:focus-visible`. Used on Nav text links, the Footer link column, and the homepage "View all" CTA. The colors match the Transit Divider gradient so the underline reads as a tiny slice of the same track. Falls back to no animation under `prefers-reduced-motion`.

### Mobile Drawer Route Map (`Nav.astro`, sub-`md` only)
The mobile menu is themed as a transit route map.
- Hamburger button morphs into an X on open (top bar rotates +45° down, bottom -45° up, middle fades).
- Drawer slides in from the right at `88vw` width, `max-w-sm`.
- A vertical Dark Walnut "track" line scales down from top to bottom after the drawer settles.
- Each link is a "stop" with a 22×22 colored dot, 2px walnut border, and the retro hard shadow.
- Stops slide in from the right with a 200 / 280 / 360 / 440 ms stagger, like train cars arriving.
- Stop colors map in order: Baby Pink → Maya Blue → Celadon → Amber → Cayenne. Subscribe is always the Cayenne terminus (matches the CTA token).
- Closes on link tap, backdrop tap, Escape, or resizing past `md`.

### Desktop Header Route Map (`Nav.astro`, `md+` only)
The desktop primary nav mirrors the mobile transit-stop language as a compact horizontal route.
- A Dark Walnut track runs behind the stop group and ends at the first and last dots.
- Each link has a 20×20 colored dot, 2px walnut border, and the retro hard shadow.
- Labels stay Montserrat, bold, uppercase, and compact so the header reads like signage rather than body copy.
- Stop colors match the mobile drawer order: Baby Pink → Maya Blue → Celadon → Amber → Cayenne.
- Hover/focus lifts the station slightly, scales the dot, and tints the label Cayenne.

### Sticky Header Rule
Header is `sticky top-0 z-30` below `md` and reverts to `static` at `md+`. Rationale: keep the hamburger reachable while scrolling on mobile without claiming desktop vertical space, where the inline nav is always visible.

### LED Marquee (`Marquee.astro`)
Dark Walnut bar with Amber text, top and bottom 2px Amber borders. The marquee now accepts structured `TickerItem[]` data rather than one static phrase. Each item has a Seashell label, Amber body text, and a star separator. Three copies of the item line are rendered into a transform-driven track so the JS can normalize position for an endless loop. Duration is calculated from total character count and clamped between 70 and 180 seconds.

Interaction details:
- The marquee auto-scrolls with `requestAnimationFrame`, not CSS keyframes, so dragging and pause/resume stay in sync.
- The viewport is horizontally draggable with pointer capture. Dragging updates a `translate3d` offset instead of native `scrollLeft` so mobile Safari and Android Chrome stay smooth.
- Horizontal wheel or shift-wheel input also scrubs the ticker. Manual movement pauses motion briefly, then resumes unless the user pressed pause.
- A compact pause/play button sits at the right edge, uses `aria-pressed`, and changes label between "Pause ticker" and "Resume ticker".
- Under `prefers-reduced-motion`, the ticker starts paused and leaves the controls visible.
- The same ticker items render near the top of the site chrome and above the footer. Minimal pages skip ticker data entirely.

Content source: `Layout.astro` calls `getTickerItems()` from `src/lib/ticker.ts`. The ticker combines the latest Beehiiv issue from `src/lib/issues.ts` with Supabase events in the next 7 days.

### Paper-Grain Noise Overlay (`Layout.astro`)
A single fixed div with an inline SVG noise texture (`feTurbulence` `baseFrequency=0.85`, `numOctaves=3`, `stitchTiles=stitch`) at `opacity: 0.04` with `mix-blend-mode: multiply`. `pointer-events-none`, `aria-hidden="true"`, `z-[999]` so it never blocks clicks and applies texture site-wide (including over the splash and mobile drawer). The result reads as recycled newsprint, not visual noise.

### Brand Text Selection
Global rule in `global.css`. `::selection` background is Maya Blue, color is Dark Walnut. No exceptions.

### Platform Map (`/links` page)
The Link-in-Bio page reuses the Mobile Drawer Route Map pattern as its primary affordance: each link is a "stop" on a vertical Dark Walnut track. Stop dots are 22×22 with 2px walnut border and `shadow-retro`, colors rotate through the brand palette in the same order as the divider gradient. Stops stagger-in on page load (220 / 300 / 380 / 460 ms) and the vertical track draws downward (`scaleY 0 → 1`). External destinations show a `↗` glyph; internal show `→`. Hover/focus tints the row Cayenne, scales the dot up, and slides the arrow right. Same `prefers-reduced-motion` fallback as the drawer.

### Social Icons (Nav drawer and Footer)
40×40 touch target, icon stroke is `currentColor` at 2px, default fill `text-darkWalnut` (on Seashell) or `text-seashell` (on Dark Walnut). Hover lifts by 2px and tints to Cayenne (on Seashell) or Amber (on Dark Walnut). Render in a flex row so new socials drop in cleanly.

### Events Route Board (`/events`)
The public events page is a static Supabase-powered route board. It should feel like a transit guide, not a generic card directory.
- Hero: left/right split at `lg+`, H1 with a Cayenne `<em>` accent, supporting copy capped to `max-w-xl`.
- Main controls: bordered Seashell panel with result count, search, date jump, start/end dates, line type segmented radios, "Has link", tag pills, and Reset.
- Event groups: events are grouped by `display_date`; each date block is a "Platform" with a vertical Dark Walnut route line and colored stop dots.
- Stop colors rotate Baby Pink → Maya Blue → Celadon → Amber → Cayenne.
- The default client-side start date is today's America/Chicago date. Past events can still be reached by moving the start date backward, and render dimmed/grayscale.
- The no-results state is a bordered Seashell panel reading "Try a different route."

### Floating Event Controls (`/events`)
When the main route controls scroll out of view, a compact fixed filter panel appears near the bottom edge.
- Uses `IntersectionObserver` with a top root margin so it appears after the full controls have left the viewport.
- Mirrors all real controls through shared `data-*` selectors: search, date jump, date range, line type, link filter, tags, and reset.
- Collapsed by default with a plus button; expanded state uses `aria-expanded`, `aria-controls`, and a hidden panel.
- Search and select fields use 16px mobile text to avoid iOS focus zoom.
- Stays pinned while focused or while filters are active, preserving scroll position when filtering from the floating panel.
- Includes a hide button that slides the panel aside and leaves an Amber restore tab on the edge.
- Uses `inert` and `aria-hidden` while invisible so keyboard focus does not land in offscreen controls.

### Event Card Variants (`EventCard.astro`)
`EventCard` chooses its visual treatment from the Supabase flags:
- Giveaway: ticket-stub card, dashed 3px border, Amber badge, optional "Conductor's Pick" badge, dashed giveaway rules section, and side punch-outs via pseudo-elements.
- Curated: large bordered feature card with Cayenne "Conductor's Pick" badge, optional Celadon cost chip, optional author note with Maya Blue rule.
- Regular: compact transfer row with dashed bottom border, small metadata, and dashed tag chips.
- If `event_url` is a valid `http` or `https` URL, the root becomes an external `<a>` with `target="_blank"` and `rel="noopener noreferrer"`. Invalid or missing URLs render as `<article>`.

### Events Admin Portal (`/admin/events`)
The admin portal is intentionally utilitarian but still brand-native.
- Uses `<Layout minimal noindex>` so there is no global nav/footer/splash and search engines receive `noindex, nofollow, noarchive`.
- Starts with a staff-only password panel. The UI unlocks locally; the real write authorization happens in Supabase RLS when an insert request is made.
- The typed password is attached as the `x-admin-password` header on the Supabase client. It is held in memory only.
- Two work surfaces: "Single stop" for one event and "Spreadsheet transfer" for CSV imports.
- CSV template is generated as a `data:text/csv` download with the canonical column list.
- Required fields are `event_date`, `display_date`, `title`, and `venue`. Optional fields match the `public.events` nullable columns.
- CSV booleans accept `true`, `1`, `yes`, `y`, or `x`.
- Tags accept JSON arrays, comma-separated strings, or pipe-separated strings.
- `event_url` validation requires `http://` or `https://`.

## 6. Layout & Integration
- **Spacing:** Generous padding (e.g., `py-24`). Content should be constrained to readable max-widths (e.g., `max-w-3xl` for text, `max-w-5xl` for grids, `max-w-md` for the Link-in-Bio page).
- **Beehiiv Subscribe Form:** The primary hero section features a custom-styled HTML form that visually matches the design system, posting directly to the Beehiiv subscriber endpoint. Avoid the unstyled default Beehiiv iframe. The form action is read from `PUBLIC_BEEHIIV_URL` at build time. `SubscribeForm.astro` accepts `caption` and `class` props.
- **Beehiiv RSS:** Homepage issue cards now come from the Beehiiv RSS feed through `src/lib/issues.ts`; the static fallback list lives in the same file.
- **Supabase Events:** Public events and ticker events come from Supabase at build time through `src/lib/supabase.ts`. The site is static, so data changes require a rebuild.
- **GitHub Pages Base Path:** `astro.config.mjs` switches `base` to `/Brown-Line-Website/` only when `PUBLIC_SITE_URL` includes `github.io`; otherwise base is `/`.
- **Scheduled Rebuilds:** GitHub Actions rebuilds every 4 hours (`0 */4 * * *`) so new Supabase event imports show up without a code push.
- **Minimal Pages:** `Layout` supports `minimal` to remove global chrome and `noindex` to add robots meta. Use both for internal admin surfaces.

## 7. Writing Style

### No em dashes
Do not use em dashes (`—`, U+2014) anywhere: not in UI copy, not in meta descriptions, not in alt text, not in code comments, not in commit messages or PR descriptions.

Use these instead:
- A comma, for a parenthetical or apposition: `journalist, editor, and founder`.
- A colon, for elaboration: `Reserved for editorial moments: hero H1s, brand wordmark, large numerals.`
- A period, to split into two sentences.
- Parentheses, for an aside.
- Semicolons, when joining related independent clauses.
- The word "and" or "with" or "plus."

Hyphens (`-`) inside compound modifiers (`Chicago-based`, `creator-led`, `small-business`) are fine. En dashes (`–`) are also out unless used for true number ranges.

### Voice
- First-person plural ("we ride," "join us") for the publication's voice.
- Sentences should sound like they could be spoken aloud at a kitchen table in Pilsen or Rogers Park.
- Avoid hype words ("revolutionary," "game-changing"). Specific nouns beat adjectives.

## 8. Brand Assets

- **Primary logo (color, transparent BG):** `public/logos/logo.png`. Used in the nav, as the browser favicon, and as the source for the homepage Open Graph share image. Mobile launcher icons in `public/app-icons/` are generated from this logo with a Seashell background and safe padding for iOS and Android home-screen crops.
- **Logo variants:** Numbered `public/logos/1.png` through `public/logos/11.png` are designer-supplied variations. `4.png` is the circular avatar variant used on the Link-in-Bio page. `5.png` is the dark-background inverse, useful if the footer ever needs a logo on Dark Walnut.
- **Founder portrait:** `public/images/ghazala.jpeg`. Used on the About page and as that page's Open Graph share image.
- **Web app icons:** `src/layouts/Layout.astro` links the favicon, Apple touch icon, and `public/site.webmanifest`. The manifest uses relative icon `src` values so the Android home-screen bookmark icons resolve correctly on both the root domain and the GitHub Pages base path.
- **Fonts:**
  - `public/fonts/JT Modernism - Header/JtModernism-{Regular,Bold,Black}.ttf`
  - `public/fonts/Montserrat - Body/Montserrat-{Regular,SemiBold,Bold}.ttf`
  - Loaded via `@font-face` in `src/styles/global.css` with URL-encoded paths (`%20` for the spaces in the folder names).

## 9. Component & Page Inventory

Components live in `src/components/`:
- `Nav.astro`: header with logo and five primary links. Desktop = horizontal route-map nav. Mobile = hamburger that opens the sliding route-map drawer (see § 5). Sticky on mobile, static on desktop.
- `TransitDivider.astro`: the 5-color stripe used between sections and at the top of the footer.
- `Marquee.astro`: structured LED ticker with pause/play, drag-to-scroll, reduced-motion support, and dynamic data from `src/lib/ticker.ts`.
- `SubscribeForm.astro`: the Beehiiv POST form. Reads `PUBLIC_BEEHIIV_URL` from env, falls back to `#BEEHIIV_EMBED_URL`. Accepts an optional `class` prop for width tuning.
- `IssueCard.astro`: archive card with category, date, title, and read link. Hover translates and casts an Amber or Cayenne hard shadow.
- `EventCard.astro`: Supabase event renderer with giveaway, curated, and regular variants.
- `Footer.astro`: dark walnut footer with the brand wordmark, copy, "Find us" social row (Instagram), and "Follow the line" link column.
- `TrainSplash.jsx`: React splash overlay (auto-dismiss, respects `prefers-reduced-motion`, static LED destination sign with dynamic next-stop copy, including `/events` as `EVENTS`). The audio toggle uses base-aware `/audio/` asset URLs and a 7s sequence watchdog at both the audio-engine and splash-overlay levels so stalled media events cannot strand visitors on the splash.

Pages live in `src/pages/`:
- `index.astro`: hero, RSS-powered recent rides grid, about teaser.
- `about.astro`: founder portrait and bio, affiliations, outlet description, values strip, subscribe CTA.
- `events.astro`: Supabase-powered public events route board with static build data and client-side filtering.
- `admin/events.astro`: internal events admin portal for single-event and CSV inserts. Minimal, noindexed, and protected by Supabase RLS on insert.
- `standards.astro`: editorial Standards & Ethics page. Linked from the footer.
- `links.astro`: Link-in-Bio destination optimized for IG / TikTok in-app browser traffic. Uses `<Layout minimal>` so no site chrome (no Nav, Footer, top TransitDivider, or splash) renders. The noise overlay and ::selection still apply.

Library modules live in `src/lib/`:
- `issues.ts`: fetches and parses Beehiiv RSS, formats dates, alternates issue card accents, and falls back to a static issue list.
- `supabase.ts`: creates the Supabase browser/build client and exports the `TransitEvent` interface.
- `ticker.ts`: composes ticker items from the latest issue and the next 7 days of Supabase events.

The `Layout` component accepts optional `minimal?: boolean` (default `false`) and `noindex?: boolean` (default `false`) props. Set `minimal` when a page should render standalone without the global Nav, top TransitDivider, Footer, Marquee, or TrainSplash. Set `noindex` for internal or utility surfaces.

## 10. Page Templates

Recipes for building new pages. Match the template that matches the intent.

### Home (`/`)
1. Eyebrow (Cayenne, uppercase, tracked-out).
2. JT Modernism H1 with one `<em class="not-italic text-cayenne">` accent phrase.
3. Lead paragraph (Montserrat, `text-darkWalnut/75`, `max-w-2xl`).
4. `<SubscribeForm />`.
5. `<TransitDivider />` constrained to `max-w-5xl`.
6. Recent rides grid: `grid-cols-1 md:grid-cols-2`, top row featured (full width).
7. About teaser section with `border-2 border-darkWalnut` CTA button using the retro hover.

### About (`/about`)
Founder portrait, bio, affiliations strip, values strip (numbered with JT Modernism numerals), repeat of `<SubscribeForm />`.

### Standards (`/standards`)
Long-form editorial. Body text uses Montserrat at `max-w-3xl`. Standards copy keeps em dashes per the founder's voice; this is an existing, documented exception to § 7's no-em-dash rule.

### Links (`/links`)
Mobile-first Link-in-Bio destination served at IG / TikTok in-app browsers, designed to read just as intentionally on desktop. Uses `<Layout minimal>` so no `Nav`, `Footer`, `TrainSplash`, or top divider renders. Container: `max-w-md md:max-w-lg mx-auto min-h-[calc(100vh-6px)] px-6 md:px-10 pt-8 md:pt-16 pb-12 md:pb-16 flex flex-col`. Structure top to bottom:
1. Full-bleed `<TransitDivider />` (matches the drawer's opening stripe).
2. Profile header: circular `logos/4.png` avatar (`w-28 md:w-36`, walnut border) with a Cayenne disc offset 1px behind for a retro hard-shadow nod, pulsing Cayenne "Now boarding" eyebrow, handle H1 (`@thebrownline`, JT Modernism, `text-3xl md:text-5xl`, see § 3 sanctioned exception for the mobile size), bio line (`text-sm md:text-base`).
3. "Get the newsletter" eyebrow + `<SubscribeForm />` (capture the email before they click out).
4. `<TransitDivider />`.
5. "Next stops" eyebrow + the Platform Map link list (see § 5 Platform Map pattern). Instagram is one of the stops, so there is no redundant Follow row at the bottom.
6. Pushed to the bottom with `mt-auto`: the "All stops, all stories." tagline, centered.

Desktop styling:
- The content column widens to `max-w-lg` with more vertical padding so the page reads as a deliberate composition rather than a phone view stretched across a wide canvas.
- Two faint walnut "platform rails" flank the column (`::before` / `::after` on the frame at 10% opacity, `2px` wide, inset `1.5rem`) so the column reads as a platform between tracks. Hidden under `md`.
- Stop labels and arrows scale up to `text-lg` for legibility at viewing distance.

Stop colors on `/links` lead with Cayenne (the latest issue, primary CTA token) then run Maya Blue → Celadon → Baby Pink → Amber. This is intentionally different from the Mobile Drawer Route Map, which terminates at Cayenne for Subscribe. The principle is the same in both: Cayenne marks the priority action on the page.

### Events (`/events`)
Public events page with full site chrome. Structure:
1. Hero with `Now boarding` eyebrow, H1, and Supabase rebuild explanation.
2. `<TransitDivider />`.
3. Route controls panel when events exist.
4. Floating controls panel, hidden until the main controls scroll away.
5. Events board grouped by `display_date`, each group rendered as a platform with route-line stop dots.
6. Empty state if Supabase returns zero events.

Client-side filter behavior:
- Search indexes title, description, venue, organizer, cost, display date, and tags.
- Line type filters: All, Picks, Giveaways, Transfers. Transfers means neither curated nor giveaway.
- Start date defaults to today's America/Chicago date.
- Start and end date filters are select controls populated from event dates plus today's Chicago date, avoiding clipped native date inputs on narrow mobile screens.
- Date jump scrolls to the selected date and expands the start date backward if needed.
- Tags are multi-select. "Any tag" clears tag selection only.
- Result counts update in both the main and floating controls.

### Events Admin (`/admin/events`)
Internal page using `<Layout minimal noindex>`. Structure:
1. Logo, "Internal platform" eyebrow, H1, and lock button.
2. Login panel with password input.
3. Transit divider.
4. Two-column admin workspace at `lg+`: single event form and CSV upload panel.
5. CSV template download, required/optional column reference cards, and importer notes.

The page is not a full auth system. It is a static admin tool backed by RLS. Do not put passwords or hashes in tracked files; use the ignored `PRIVATE_README.md` for recovery details.

## 11. Infrastructure & Data

### Supabase
Production project ref: `xuursvzrlbqiwcevzhao`. Public API URL: `https://xuursvzrlbqiwcevzhao.supabase.co`.

Tables:
- `public.events`: source of public event data. RLS enabled. Public `SELECT` allowed. `INSERT` allowed only when the RLS check confirms the admin password header and required fields.
- `private.events_admin_credentials`: one-row private table containing the admin password salt/hash. RLS enabled. Direct access denied to public client roles.

Important policy shape:
- Public reads are intentional because the events page is public.
- Writes are intentionally narrow: `anon` and `authenticated` may insert only when `private.events_admin_password_matches()` returns true and the required event fields are present.
- The password helper function lives in the private schema to avoid exposing a public RPC endpoint.
- The publishable key is allowed in frontend/build contexts; never use a service-role key in this static site.

### GitHub Pages Build
The site deploys through `.github/workflows/deploy.yml`.
- Pushes to `main` deploy immediately.
- Scheduled rebuilds run every 4 hours so Supabase changes propagate to static pages.
- Manual dispatch is available for urgent event updates.
- Build Node is pinned to 24 because the current Supabase client path initializes Realtime during static rendering and expects native WebSocket support. Node 20 fails during route generation.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` is set at workflow level to opt GitHub Actions into the Node 24 action runtime.
- `PUBLIC_SITE_URL` is hardcoded to the GitHub Pages URL in the workflow.
- `PUBLIC_BEEHIIV_URL` is read from GitHub repository variables.
- Supabase URL and publishable key are supplied at build time.

### Data Freshness
- `/events` is static. New rows do not appear until the next build.
- The homepage issue grid is fetched from Beehiiv RSS at build time and falls back to bundled data.
- The marquee is also static per build, combining latest issue plus next-7-days events.
- Admin inserts write to Supabase immediately, but public visibility waits for rebuild.

### Dependencies Added
- `@supabase/supabase-js`: public Supabase client for build-time reads and admin insert requests.
- `papaparse`: browser CSV parsing in the admin portal.
- `@types/papaparse`: TypeScript support for CSV parsing.

### Documentation Practice
Future project work should keep the docs fresh as part of the work itself.
- Update `design.md` when changing UI, styling, interactions, page structure, component behavior, infrastructure, deployment, data flow, or public conventions.
- Update the ignored `PRIVATE_README.md` when changing sensitive or operational details: passwords, keys, local env values, runbooks, migrations, recovery steps, or deployment gotchas.
- Keep secrets out of tracked files. Put sensitive recovery material only in ignored local docs.
- Skip doc edits only when the action has no meaningful documentation impact.

## 12. Changelog

- **2026-05-31 (mobile app icons):** Added a web app manifest, Apple touch icon metadata, and generated iOS and Android home-screen PNGs from `public/logos/logo.png` with Seashell backing and launcher-safe padding.
- **2026-05-31 (splash audio reliability):** Made `TrainSplash.jsx` resolve audio files through Astro `BASE_URL` for subpath deployments, added guarded audio/splash fallbacks so enabling sound still exits to the page if media playback rejects, stalls, or misses completion events, and fixed route detection so `/events/` displays `EVENTS` instead of `HOME PLATFORM`.
- **2026-05-30 (documentation practice):** Added `AGENTS.md` with a project-wide instruction to update `design.md` and the ignored `PRIVATE_README.md` whenever future changes make those docs relevant. Documented the convention here so it is visible in the design system itself.
- **2026-05-30 (events infrastructure):** Added Supabase-backed public events at `/events`, the noindexed admin portal at `/admin/events`, `EventCard.astro`, `src/lib/supabase.ts`, `src/lib/ticker.ts`, and `src/lib/issues.ts`. Reworked the marquee into a dynamic, draggable, pauseable ticker fed by Beehiiv RSS and next-7-days Supabase events. Updated nav/footer links to include Events. Added GitHub Pages 4-hour scheduled rebuilds. Added Supabase env typing and dependencies. Removed `.env.example` from tracking and moved sensitive operational details into an ignored private runbook.
- **2026-05-15 (links polish):** Removed the redundant "Follow" row from `/links` (Instagram is already a stop on the Platform Map). Made the page read intentionally on desktop: wider `max-w-lg` column, larger handle and avatar at `md+`, extra vertical padding, and two faint walnut "platform rails" flanking the column at desktop widths. Mobile presentation is unchanged.
- **2026-05-15 (links redesign):** Replaced the `/links` brutalist button stack with a Platform Map: vertical Dark Walnut track with colored transit stops, staggered entry animation, and the same hover language as the Mobile Drawer Route Map. Added a `minimal?: boolean` prop to `Layout` so `/links` renders with no Nav, Footer, top divider, or splash chrome (the noise overlay and brand `::selection` still apply).
- **2026-05-15:** Visual "next level" pass. Added a site-wide SVG paper-grain noise overlay in `Layout.astro` at 4% multiply opacity. Built `Marquee.astro` (Amber-on-Walnut LED ticker) and wired it into the slot above the footer divider. Added brand `::selection` (Maya Blue background, Dark Walnut text) to `global.css`. Built the initial `/links` Link-in-Bio page (later redesigned, see above). Documented the new patterns and page templates in this file.
- **2026-05-15 (earlier):** Replaced the link hover underline with the 5-color transit gradient (`.link-transit`). Rebuilt the mobile nav as a sliding route-map drawer with staggered transit-stop entries, a vertical track line, and a hamburger-to-X morph. Made the header sticky on mobile only. Added Instagram social icon to the footer "Find us" row and to a "Follow" row inside the mobile drawer. Replaced the broken scrolling marquee in `TrainSplash.jsx` with a static, centered LED destination sign using native SVG `<text>` so it scales with the viewBox at every screen size. Updated the splash skip button to read "Loading your next stop…" Wired `PUBLIC_SITE_URL` into the GitHub Pages deploy workflow so the build picks the correct `/Brown-Line-Website/` base.
- **2026-05-14 (later):** Added the Standards & Ethics page at `/standards`. Linked it from the footer. Updated the footer contact email to `hi@thebrownlinechi.com` (the publication's address). Note: the no-em-dash rule does not apply inside the Standards copy because that text was provided verbatim by the founder and em dashes there are intentional.
- **2026-05-14:** Initial Astro + Tailwind scaffold. Added About page. Wired Open Graph and Twitter share cards (homepage uses logo, About page uses founder portrait). Renamed display font reference from "Ja Modernism" to "JT Modernism" to match the actual asset names. Rebalanced typography so Montserrat is the default and JT Modernism is reserved for display sizes (`text-4xl` and above). Added a no-em-dash writing rule.
