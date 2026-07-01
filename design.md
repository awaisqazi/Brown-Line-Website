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

Montserrat is the brand typeface for everything readable: body, UI, and all headings. JT Modernism (the retro display face) is reserved **exclusively for the brand logo wordmark** ("the Brown Line"). It is never used for headings, body, numerals, or any other text, because it reads poorly at a glance. The rule moving forward: **if it isn't the logo, it's Montserrat.**

### Logo wordmark (JT Modernism): the only use of the display face
Web: the `font-wordmark` Tailwind family (`'JT Modernism', Georgia, serif`), defined in `global.css` via `@font-face`. App: `Font.Brand.wordmark(_:)`.

Use **only** for the "the Brown Line" logo lockups:
- The nav and footer wordmark on the website.
- The home-feed masthead in the app.

Do **not** use `font-wordmark` for page headings, section titles, display numerals, eyebrows, or the `@thebrownline` handle; those are all Montserrat. If you reach for the display face anywhere but the logo, stop and use `font-heading`.

### Headings (Montserrat ExtraBold)
Tailwind family: `font-heading` (resolves to Montserrat). The `.font-heading` rule carries `font-weight: 800` and lives in `@layer base` (`global.css`), so it provides a heavy default **but** Tailwind weight utilities (`font-semibold`, `font-extrabold`) reliably override it. (Before it was unlayered, which beat the utility classes and flattened every heading to 800.)

**Weight contrast (the hierarchy rule).** Keep the eye able to rank importance:
- Heavy (800, the `font-heading` default): hero H1s and the closing brand statement.
- Semibold (`font-heading font-semibold`, ~600): section heads ("Upcoming Stops", "Recent dispatches", events day headings) and event-card titles.
- Section heads sit at ~40px desktop (`md:text-[2.5rem]`), not hero scale; card titles at ~26-28px (`text-2xl md:text-[1.75rem]`).

Use `font-heading` for:
- H1s on every page.
- Large section H2s (with `font-semibold` for section-head scale).
- Large display numerals (e.g. the values strip `01 / 02 / 03`).
- Hero eyebrows and accent moments where a short line of display type sets the tone.
- The `@thebrownline` handle on `/links` (`font-heading`, `text-3xl md:text-5xl`): a page header sized to fit a `max-w-md` mobile column.

Styling: Dark Walnut color, used large, unapologetic, tightly tracked.

### Montserrat (Body, UI, and headings)
Custom local font, served from `public/fonts/Montserrat - Body/`. Tailwind family: `font-body`. Weights: 400 (Regular), 600 (SemiBold), 700 (Bold), 800 (ExtraBold).

Use for everything except the logo wordmark:
- All paragraphs and lead text.
- H3 titles (issue card titles, values labels, sidebar headings).
- Buttons, form inputs, labels, tags, captions, eyebrows.
- Pull quotes (use `italic font-medium` at `text-2xl` or larger for editorial weight).
- Any inline emphasis inside a paragraph (use `font-bold` plus an accent color).

Styling: clean, generous line-height for readability. Small headings that need visual weight use `font-extrabold` plus `uppercase tracking-widest`.

## 4. UI Component Styling Rules
- **Tactile Borders & Shadows:** Use sharp `2px solid #642713` (Dark Walnut) borders for input fields, cards, and buttons.
- **Retro Hover States:** Instead of soft blurs, use hard block shadows. E.g., `box-shadow: 4px 4px 0px #642713;`. On hover, interactive elements should shift slightly (`-translate-y-1` and `-translate-x-1`) and the shadow should deepen (e.g., from `4px 4px 0` to `6px 6px 0`).
- **Dividers:** Replace standard `<hr>` tags with a custom "Transit Stripe" component, a 5-color linear gradient line (Pink, Maya Blue, Celadon, Amber, Cayenne) to divide major sections.

## 5. Interaction Patterns

Reusable behaviors that show up across multiple components. When adding new UI, reach for one of these before inventing new motion.

### Link Transit Underline (`.link-transit`)
Defined in `src/styles/global.css`. A 5-color gradient bar slides in left-to-right (200ms ease) below the text on `:hover` and `:focus-visible`. Used on Nav text links, the Footer link column, and the homepage "View all" CTA. The colors match the Transit Divider gradient so the underline reads as a tiny slice of the same track. Falls back to no animation under `prefers-reduced-motion`.

### Mobile Drawer Route Map (`Nav.astro`, below `lg` only)
The mobile menu is themed as a transit route map.
- Hamburger button morphs into an X on open (top bar rotates +45° down, bottom -45° up, middle fades).
- Drawer slides in from the right at `88vw` width, `max-w-sm`.
- A vertical Dark Walnut "track" line scales down from top to bottom after the drawer settles.
- Each link is a "stop" with a 22×22 colored dot, 2px walnut border, and the retro hard shadow.
- Stops slide in from the right with a 200 / 280 / 360 / 440 ms stagger, like train cars arriving.
- Stop colors map in order: Baby Pink → Maya Blue → Celadon → Amber → Cayenne. Subscribe is always the Cayenne terminus (matches the CTA token).
- Closes on link tap, backdrop tap, Escape, or resizing past `md`.

### Desktop Header Route Map (`Nav.astro`, `lg+` only)
The desktop primary nav mirrors the mobile transit-stop language as a compact horizontal route, followed by the distinct Support / Subscribe / Submit an Event buttons (`.nav-cta`). It renders at `lg+` only; tablets and phones get the hamburger drawer instead, because the route plus the CTA buttons and the logo gets crammed below ~1024px.
- A Dark Walnut track runs behind the stop group and ends at the first and last dots.
- Each link has a 20×20 colored dot, 2px walnut border, and the retro hard shadow.
- Labels stay Montserrat, bold, uppercase, and compact so the header reads like signage rather than body copy.
- **Label overflow:** station labels are absolutely positioned and centered under their dots, so they overflow the 20px dot width. `.desktop-route` carries horizontal padding (`--route-pad`) so the first/last labels stay inside the route box instead of colliding with the logo or the Support button; the track `::before` is inset by the same padding so it still starts/ends on the end dots. Gaps (`--route-gap`) are tuned so adjacent labels keep clearance (4.25rem at `lg`).
- Stop colors: Maya Blue → Celadon → Amber → Cayenne (Events, Archive, About, Ethics). With Submit an Event promoted to a button, the route holds only short labels, so `--route-gap` is 4.25rem.
- `.nav-cta` variants: `.nav-cta-amber` (Submit an Event), `.nav-cta-outline` (Support), `.nav-cta-filled` (Subscribe, Cayenne). Amber is the site's established "submit" color (events hero, homepage "Hosting?" band).
- Hover/focus lifts the station slightly, scales the dot, and tints the label Cayenne.

### Sticky Header Rule
Header is `sticky top-0 z-30` below `lg` and reverts to `static` at `lg+`. Rationale: keep the hamburger reachable while scrolling on phones and tablets without claiming desktop vertical space, where the inline nav is always visible.

### LED Marquee (`Marquee.astro`)
Dark Walnut bar with Amber text, top and bottom 2px Amber borders. The marquee now accepts structured `TickerItem[]` data rather than one static phrase. Each item has a Seashell label, Amber body text, and a star separator. Three copies of the item line are rendered into a transform-driven track so the JS can normalize position for an endless loop. The track scrolls at a constant speed in pixels per second (default 90) rather than a fixed loop duration, so the pace stays even no matter how long the current copy is; callers can override with `pixelsPerSecond`. Callers can pass `visualRepeat` to duplicate short visual item sets without duplicating the screen-reader text.

Interaction details:
- The marquee auto-scrolls with `requestAnimationFrame`, not CSS keyframes, so dragging and pause/resume stay in sync.
- The viewport is horizontally draggable with pointer capture. Dragging updates a `translate3d` offset instead of native `scrollLeft` so mobile Safari and Android Chrome stay smooth.
- Horizontal wheel or shift-wheel input also scrubs the ticker. Manual movement pauses motion briefly, then resumes unless the user pressed pause.
- A compact pause/play button sits at the right edge, uses `aria-pressed`, and changes label between "Pause ticker" and "Resume ticker".
- Under `prefers-reduced-motion`, the ticker starts paused and leaves the controls visible.
- The same ticker items render near the top of the site chrome and above the footer. Minimal pages skip ticker data entirely.

Content source: `Layout.astro` calls `getTickerItems()` from `src/lib/ticker.ts`. The ticker combines the latest Beehiiv issue from `src/lib/issues.ts` with a curated set of up to 5 hand-picked event highlights (Conductor's Picks first, then soonest, deduped by title) drawn from the next 21 days, so it no longer dumps the full multi-week list.

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
- Hero: left/right split at `lg+`, H1 with a Cayenne `<em>` accent, supporting copy capped to `max-w-xl`, plus an Amber "Submit an event" button linking to `/submit-event`.
- Main controls: bordered Seashell panel with result count, a row of quick-filter chips, a search box, a single-date calendar, a themed Category dropdown, a Neighborhood dropdown, and Reset. The older line-type radios, "Has link" toggle, and start/end date selects were removed in favor of this simpler bar.
- **Quick-filter chips:** `This week` (default), `This weekend`, `All upcoming` (mutually exclusive date windows), plus a `Free` toggle (matches `cost_info` containing "free"). `This week` = today through +6 days; `This weekend` = the upcoming Sat/Sun; `All upcoming` = today onward, unbounded. A search query widens the window to all upcoming (search is global). Chips appear in both the main panel and the floating panel and stay synced. Loading `/events#all` (the homepage "See all stops" link) starts on `All upcoming` instead of the default `This week`.
- **Recurring/multi-day collapse:** identical events (same `title` + `venue`) are collapsed into one card with a date-range label, so a 25-day camp shows once. The card is placed on its first still-relevant date, and filtering uses each card's `[start, end]` range overlapping the active window (so an ongoing series surfaces even if it began before today).
- Event groups: collapsed events are grouped by their representative date and the day heading is derived via `formatStopDate` (`src/lib/dates.ts`, e.g. "Sun. Jun 28"). The "Platform" eyebrow renders once (above the first day group only). Day headings are `font-semibold` at ~40px (section-head scale, not hero scale).
- Stop colors rotate Baby Pink → Maya Blue → Celadon → Amber → Cayenne.
- **Upcoming only (server-side):** the build-time Supabase query filters `.gte('event_date', today)` (America/Chicago), mirroring the homepage/ticker queries, so the static HTML never ships past stops and no-JS visitors and the initial result count are correct. The client quick filters (`This week` default, etc.) narrow within that upcoming set. The legacy `.is-past-event` dimming styles remain as a harmless backstop.
- Picking a date in the calendar is a jump: it switches to `All upcoming`, scrolls to that day, and keeps surrounding events visible. Days with events are marked with a dot in the calendar; today is ringed.
- **One filter block per breakpoint:** the inline "Route controls" serve desktop; the floating "Filter the route" panel is hidden at `lg+` (`min-width: 1024px`) so the two never appear at once. (Renamed from "Line signal" per master doc §2a so the label says what the box does.)
- **Neighborhood data:** the `neighborhood` column is backfilled from the trailing `, Neighborhood` segment of each venue (see § 11), so the Neighborhood filter is populated.
- The Category dropdown is themed on desktop (a custom listbox built in the page script) and falls back to the native OS `<select>` on mobile; both drive the same hidden native select.
- The no-results state is a bordered Seashell panel reading "Try a different route."

### Homepage Upcoming Stops (`index.astro`)
The homepage includes an `Upcoming Stops` section between the credibility strip and the two-sided Browse/Submit band. It adapts the events route-map language into a compact Transit Route Timeline:
- The homepage queries Supabase `public.events` at build time for the next three upcoming rows, **ordered Conductor's Picks first** (then soonest date), so the section leads with a strong example rather than the bare next chronological event. No local placeholder events are rendered.
- A local `Marquee` sits directly above the timeline and leads with the next Conductor's Pick: `NEXT STOP: [pick] · DOORS OPEN ON THE RIGHT` (a `·` separator, not the old `--`). It passes `visualRepeat={4}` so the short inside-train LED line visibly repeats and scrolls on wide viewports (default constant scroll speed).
- The section-specific marquee wrapper overrides `Marquee.astro` to an accessible inside-train LED style: Dark Walnut background, Amber body text, Seashell label text, monospace type, and tighter tracking than the global ticker.
- The "Upcoming Stops" heading is `font-heading font-semibold` at section-head scale (~40px, `md:text-[2.5rem]`), per the weight-contrast rule in § 3.
- The timeline track is a thick vertical `bg-[#62361B]` line, matching CTA Brown. It sits close to the left edge on mobile and gains more left padding at `md+`.
- Each stop marker is a white circular node with a thick `border-[#62361B]`, centered over the track.
- Event content is rendered by the shared `EventCard.astro` component, with a small monospace date label above each card. The terminus link reads "See all stops" and deep-links to `/events#all`, which opens the board on All upcoming instead of the default This week.
- If Supabase returns zero upcoming events, the section shows a "Route status" empty state instead of dummy content.
- A `TransitDivider` closes the section.

### Floating Event Controls (`/events`)
When the main route controls scroll out of view, a compact fixed filter panel appears near the bottom edge.
- Uses `IntersectionObserver` with a top root margin so it appears after the full controls have left the viewport.
- Mirrors the controls through shared `data-*` selectors: search, the date calendar (rendered inline here so its popover cannot be clipped by the panel), the Category dropdown, the Neighborhood dropdown, and reset.
- Collapsed by default with a plus button; expanded state uses `aria-expanded`, `aria-controls`, and a hidden panel.
- Search and select fields use 16px mobile text to avoid iOS focus zoom.
- Stays pinned while focused or while filters are active, preserving scroll position when filtering from the floating panel.
- Includes a hide button that slides the panel aside and leaves an Amber restore tab on the edge.
- Uses `inert` and `aria-hidden` while invisible so keyboard focus does not land in offscreen controls.

### Event Card (`EventCard.astro`)
Every event uses **one** bordered card template (the former "Conductor's Pick" feature card), so the board reads as finished and consistent. There is no longer a separate bare/transfer-row treatment.
- Standard card: `#FDFBF7` fill, 3px Dark Walnut border, hover lift + hard shadow. Tag row holds (in order) an optional Cayenne `★ Conductor's Pick` badge (driven by `is_curated`, now a badge, not a separate card), the Celadon community tag(s), and an Amber price/status chip (`cost_info` when present). Title is `font-heading font-semibold` at ~26-28px. Then one venue line, an optional mono date-range/time line, the description blurb, an optional Maya Blue author-note pull-quote **labeled with a Cayenne "Conductor's note" eyebrow** (so it reads as an intentional editorial device, not a duplicate summary; master doc §2a), and a footer with the organizer plus the `Details / RSVP ↗` link and a `Share` button.
- **Defensive text normalization:** `fixSpelling()` restores the umlaut on any "Turkiye" in the title/description at render, and the description/blurb paragraphs carry `break-words` so a long unbroken token cannot overflow the card on mobile.
- Giveaway: keeps the dashed ticket-stub treatment with side punch-outs, the same tag row, meta, and action footer.
- **Venue once:** when an event has a `neighborhood`, the trailing `, Neighborhood` segment is stripped from the displayed venue and shown as `Venue · Neighborhood`. The organizer is hidden when it equals the venue (fixes the "prints the venue twice" bug).
- **No whole-card link.** The card is always an `<article>`; `event_url` drives the `Details / RSVP ↗` link in the footer instead of wrapping the whole card (so the `Share` button is valid). `Share` uses the Web Share API, falling back to copy-to-clipboard. One delegated listener handles every card (`window.__brownLineShareWired` guard).
- Optional `recurrenceLabel` prop renders a mono date-range line (e.g. `Jun 22 – Jul 24`) for collapsed multi-day/recurring events. The en dash here is a true date range, which the no-em-dash rule (§7) permits.

### Events Admin Portal (`/admin/events`)
The admin portal is intentionally utilitarian but still brand-native.
- Uses `<Layout minimal noindex>` so there is no global nav/footer/splash and search engines receive `noindex, nofollow, noarchive`.
- Starts with a staff-only password panel. The UI unlocks locally; the real write authorization happens in Supabase RLS when an insert request is made.
- The typed password is attached as the `x-admin-password` header on the Supabase client. It is held in memory only.
- Three work surfaces: "Single stop" for one event, "Spreadsheet transfer" for CSV imports, and "Review submissions" for public requests.
- CSV template is generated as a `data:text/csv` download with the canonical column list.
- Required fields are `event_date`, `title`, and `venue`. Optional fields match the `public.events` nullable columns.
- CSV booleans accept `true`, `1`, `yes`, `y`, or `x`.
- Tags accept JSON arrays, comma-separated strings, or pipe-separated strings.
- `event_url` validation requires `http://` or `https://`.
- Review submissions: on unlock the portal loads pending rows from `public.event_submissions` (gated by the admin password header) and renders each as an editable card with the event fields plus the editorial flags (emoji, author note, Conductor's pick, Giveaway). "Approve & publish" inserts the edited record into `public.events` and marks the submission `approved` (linking `approved_event_id`); "Reject" marks it `rejected`. Submission text is filled into the card via DOM properties, never `innerHTML`, so untrusted input cannot inject markup.

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
- **Partner logos (homepage credibility strip):** transparent PNGs in `public/logos/`, shown in bordered `#FDFBF7` tiles (height-normalized to ~32px, `object-contain`):
  - **Supported by:** `medill.png` (Northwestern Medill), `projectc.png` (Project C), `neighbor.png` (Meet Your Neighbor).
  - **Featured in:** `creader.png` (Chicago Reader).
  - Use these exact four only. Do not add other orgs or imply partnership beyond these (per the master doc). Alt text is just the org name. The list is data-driven in `index.astro` (`supportedBy` / `featuredIn` arrays) with per-logo width/height to avoid layout shift. Each tile links to the org's site in a new tab (`target="_blank" rel="noopener noreferrer"`, "opens in a new tab" aria-label, GA `partner_click` event): Medill `medill.northwestern.edu`, Project C `projectc.biz`, Meet Your Neighbor `meetyourneighborchi.com`, Chicago Reader `chicagoreader.com`.
- **Founder portrait:** `public/images/ghazala.jpeg`. Used on the About page and as that page's Open Graph share image.
- **Web app icons:** `src/layouts/Layout.astro` links the favicon, Apple touch icon, and `public/site.webmanifest`. The manifest uses relative icon `src` values so the Android home-screen bookmark icons resolve correctly on both the root domain and the GitHub Pages base path.
- **Fonts:**
  - `public/fonts/Montserrat - Body/Montserrat-{Regular,SemiBold,Bold,ExtraBold}.ttf`: the brand typeface for body **and** headings.
  - `public/fonts/JT Modernism - Header/JtModernism-{Regular,Bold,Black}.ttf`: display face used **only** for the logo wordmark (`font-wordmark`); see § 3.
  - Loaded via `@font-face` in `src/styles/global.css` with URL-encoded paths (`%20` for the spaces in the folder names).

## 9. Component & Page Inventory

Components live in `src/components/`:
- `Nav.astro`: header with logo, four route links (Events, Archive, About, Ethics), and three distinct CTA buttons in order Support (outline), Subscribe (filled), Submit an Event (amber) via `.nav-cta`. Submit an Event is intentionally a button, not a route stop, so the organizer pathway reads as an engaging call to action. At `lg+` = horizontal route-map nav + buttons; below `lg` (phones and tablets) = hamburger that opens the sliding route-map drawer with the same buttons (see § 5). Sticky below `lg`, static at `lg+`. (World Cup nav link intentionally omitted until `/events/world-cup` exists, to avoid a dead link.)
- `CredibilityStrip.astro`: shared "Supported by" (Medill, Project C, Meet Your Neighbor) / "Featured in" (Chicago Reader) logo strip, data-driven and used on both the homepage and the About page so the two never drift. Real orgs only (see § 8).
- `TransitDivider.astro`: the 5-color stripe used between sections and at the top of the footer.
- `Marquee.astro`: structured LED ticker with pause/play, drag-to-scroll, reduced-motion support, constant pixels-per-second scroll, and dynamic data from `src/lib/ticker.ts`.
- `SubscribeForm.astro`: the Beehiiv POST form. Reads `PUBLIC_BEEHIIV_URL` from env, falls back to `#BEEHIIV_EMBED_URL`. Accepts optional `caption` and `class` props.
- `IssueCard.astro`: archive card with category, date, title, and read link. Hover translates and casts an Amber or Cayenne hard shadow.
- `EventCard.astro`: Supabase event renderer. One unified bordered card for all events (Conductor's Pick is a badge, not a separate layout) plus a dashed giveaway ticket-stub. Venue-once, organizer dedupe, a labeled "Conductor's note" author-note pull-quote, `break-words` blurbs, `fixSpelling()` Türkiye normalization, `Details / RSVP` link + `Share` button, optional `recurrenceLabel` for collapsed series.
- `EventDatePicker.astro`: brand-styled single-date calendar used by the events filter. Renders as a popover by default (main controls) or open-in-place with the `inline` prop (floating panel); the events page script drives both instances.
- `EventSelect.astro`: themed filter dropdown. Renders a native `<select>` on mobile and a custom listbox on desktop (`md+`), both backed by the same hidden native select. Used for the Category and Neighborhood filters. Props: `field`, `label`, `placeholder`, `options`, `inline`.
- `Footer.astro`: dark walnut footer with the brand wordmark, copy, "Find us" social row (Instagram), and "Follow the line" link column.
- `TrainSplash.jsx`: React splash overlay (auto-dismiss, respects `prefers-reduced-motion`, static LED destination sign with dynamic next-stop copy, including `/events` as `EVENTS`). The audio toggle uses base-aware `/audio/` asset URLs and a 7s sequence watchdog at both the audio-engine and splash-overlay levels so stalled media events cannot strand visitors on the splash. **No-JS fail-safe:** a pure-CSS `splash-failsafe-hide` animation on `.train-splash-root` (present in the server-rendered HTML) fades the overlay out and drops `pointer-events` at 9s, so a visitor is never trapped if the script fails to hydrate. JS normally unmounts the splash (~2.5s) long before this fires.

Pages live in `src/pages/`:
- `index.astro`: hero, shared `CredibilityStrip`, Supabase-powered Upcoming Stops (leads with a Conductor's Pick), two-sided Browse/Submit band, optional Testimonials section (renders only when real quotes exist), RSS-powered recent dispatches grid, Support band, closing brand statement.
- `about.astro`: project-first (what we're building) then the shared `CredibilityStrip` (for the investor-facing view), the founder section (portrait, bio, affiliations), values strip, business-model pull-quote kept lower, subscribe + support CTA.
- `events.astro`: Supabase-powered public events route board with static build data and client-side filtering by quick-filter chips (This week / This weekend / All upcoming / Free), search, a single-date calendar (jump), Category (diaspora tag), and Neighborhood. Recurring/multi-day events are collapsed into one card with a date range.
- `support.astro`: reader-support page framed as a solidarity-fare model (everything stays free; monthly riders subsidize free access for everyone else). Three one-time "Give once" tiers ($20/$50/$100) wired to Stripe payment links, plus a "Ride monthly" section (free Street Level → Subscribe, and a $7/mo "Solidarity Fare" card). See `PRIVATE_README.md` for the confirmed Stripe link mapping. Note: the $7/mo Stripe checkout link still points at the retired $9 product and must be repointed in the Stripe dashboard.
- `privacy.astro`: plain-language privacy page (newsletter, submissions, analytics, payments). Fixes the former dead `#privacy` footer anchor.
- `submit-event.astro`: public "submit an event" request form. Locked master-doc §7 copy: "Put your event on the map." headline, the two-line curated-by-a-human intro, "Who should submit" / "What we look for" blocks, a "7-10 days ahead" timing helper by the date field, and the "your stop is in the queue" confirmation. Conditional location fields (Chicago neighborhood / suburb), Cloudflare Turnstile captcha, and a honeypot. Posts to the `submit-event` edge function, which queues the request in `public.event_submissions` for review.
- `admin/events.astro`: internal events admin portal for single-event inserts, CSV imports, and a review queue for public submissions (edit, approve into `public.events`, or reject). Minimal, noindexed, and protected by Supabase RLS.
- `standards.astro`: editorial Standards & Ethics page. Linked from the footer. Event Submissions section links `/submit-event` (email as fallback).
- `links.astro`: Link-in-Bio destination optimized for IG / TikTok in-app browser traffic. Uses `<Layout minimal>` so no site chrome (no Nav, Footer, top TransitDivider, or splash) renders. The noise overlay and ::selection still apply.

Library modules live in `src/lib/`:
- `issues.ts`: fetches and parses Beehiiv RSS, formats dates, alternates issue card accents, and falls back to a static issue list.
- `supabase.ts`: creates the Supabase browser/build client and exports the `TransitEvent` interface (which includes `neighborhood` and `start_time`; the free-text `display_date` column was removed).
- `ticker.ts`: composes ticker items from the latest issue plus up to 5 hand-picked event highlights (Conductor's Picks first, then soonest, deduped by title so a recurring series shows once) drawn from the next 21 days; derives its date labels from `event_date` via `dates.ts`.
- `dates.ts`: `formatStopDate(event_date)` returns the standardized day label ("Sun. Jun 28"), parsed in UTC so the day never shifts. The single source of truth for descriptive dates after the `display_date` column was dropped.
- `locations.ts`: dropdown data for the submit form (the diaspora `DIASPORA_TAGS`, the four `LOCATION_TYPES`, the 77 Chicago `NEIGHBORHOOD_GROUPS` by side, and `SUBURBS`).

The `Layout` component accepts optional `minimal?: boolean` (default `false`) and `noindex?: boolean` (default `false`) props. Set `minimal` when a page should render standalone without the global Nav, top TransitDivider, Footer, Marquee, or TrainSplash. Set `noindex` for internal or utility surfaces.

## 10. Page Templates

Recipes for building new pages. Match the template that matches the intent.

### Home (`/`)
Current top-to-bottom structure:
1. Hero: Cayenne uppercase eyebrow, `font-heading` H1 (heavy) with one `<em class="not-italic text-cayenne">` accent, centered `<SubscribeForm />`, and a scroll cue.
2. Credibility strip: "Supported by" partner-logo tiles + a "Featured in" tile (see § 8 Brand Assets). Real orgs only.
3. Upcoming Stops: inside-train LED `Marquee` leading with the next Conductor's Pick, then the route timeline of `EventCard`s (curated-first), terminus link "See all stops" (deep-links to `/events#all` = All upcoming), closing `<TransitDivider />`.
4. Two-sided band: "Feeling social? -> Browse events" (Maya Blue) and "Hosting? -> Submit an event" (Amber), the platform/network story.
5. Testimonials: renders only when `testimonials` has real entries (empty by default; no fabricated quotes).
6. Recent dispatches grid: `grid-cols-1 md:grid-cols-2`, top row featured (full width), from Beehiiv RSS.
7. Support band (Dark Walnut): "Fund the line" with a Support CTA to `/support`.
8. Closing brand statement: heavy `font-heading` headline, supporting paragraph, "What we're building" CTA to `/about`.

Section heads (Upcoming Stops, Recent dispatches) are `font-semibold` at ~40px; the hero H1 and the closing statement stay heavy (see § 3).

### About (`/about`)
Project first: open with what The Brown Line is and what it covers, then a "Meet the founder" section (portrait, bio, affiliations strip), values strip (numbered with `font-heading` numerals), the creator-economy pull-quote with the heavier business-model language kept lower, then `<SubscribeForm />` plus a Support link. The top should read public, not pitch-deck.

### Standards (`/standards`)
Long-form editorial. Body text uses Montserrat at `max-w-3xl`. Standards copy follows the same no-em-dash rule as the rest of the site (§ 7); the earlier founder-voice exception was removed on 2026-06-21.

### Links (`/links`)
Mobile-first Link-in-Bio destination served at IG / TikTok in-app browsers, designed to read just as intentionally on desktop. Uses `<Layout minimal>` so no `Nav`, `Footer`, `TrainSplash`, or top divider renders. Container: `max-w-md md:max-w-lg mx-auto min-h-[calc(100vh-6px)] px-6 md:px-10 pt-8 md:pt-16 pb-12 md:pb-16 flex flex-col`. Structure top to bottom:
1. Full-bleed `<TransitDivider />` (matches the drawer's opening stripe).
2. Profile header: circular `logos/4.png` avatar (`w-28 md:w-36`, walnut border) with a Cayenne disc offset 1px behind for a retro hard-shadow nod, pulsing Cayenne "Now boarding" eyebrow, handle H1 (`@thebrownline`, `font-heading`, `text-3xl md:text-5xl`, see § 3), bio line (`text-sm md:text-base`).
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
3. Route controls panel when events exist (search, date calendar, Category, Neighborhood, Reset).
4. Floating controls panel, hidden until the main controls scroll away.
5. Events board grouped by `event_date`, each group rendered as a platform with route-line stop dots and a `formatStopDate` heading.
6. Empty state if Supabase returns zero events.

Client-side filter behavior:
- Search indexes title, description, venue, organizer, cost, neighborhood, and tags.
- Date is a single-date calendar. By default the board shows events from today (America/Chicago) onward. Picking a date scrolls to that day and keeps the surrounding events visible (it does not collapse to a single day); a past pick lowers the floor so those events appear.
- Category filters by a single diaspora tag, chosen from a themed dropdown (custom listbox on desktop, native select on mobile). Options are derived from the tags present in the data and ordered by the canonical diaspora taxonomy.
- Neighborhood filters by exact match; the control only appears once some events have a neighborhood.
- Result counts update in both the main and floating controls, and the main and floating instances of each control stay in sync.

### Events Admin (`/admin/events`)
Internal page using `<Layout minimal noindex>`. Structure:
1. Logo, "Internal platform" eyebrow, H1, and lock button.
2. Login panel with password input.
3. Transit divider.
4. Two-column admin workspace at `lg+`: single event form and CSV upload panel.
5. CSV template download, required/optional column reference cards, and importer notes.
6. "Review submissions" section below the workspace: editable cards for each pending `public.event_submissions` row, with Approve and Reject actions.

The page is not a full auth system. It is a static admin tool backed by RLS. Do not put passwords or hashes in tracked files; use the ignored `PRIVATE_README.md` for recovery details.

## 11. Infrastructure & Data

### Supabase
Production project ref: `xuursvzrlbqiwcevzhao`. Public API URL: `https://xuursvzrlbqiwcevzhao.supabase.co`.

Tables:
- `public.events`: source of public event data. RLS enabled. Public `SELECT` allowed. `INSERT` allowed only when the RLS check confirms the admin password header and required fields.
- `public.event_submissions`: queue of public "submit an event" requests. Mirrors the `events` columns plus submitter contact (`submitter_name`, `submitter_email`), raw spec location fields (`location_type`, `chicago_neighborhood`, `suburb`, `address`), and review metadata (`status` pending/approved/rejected, `reviewed_at`, `approved_event_id`). RLS enabled with NO public insert; the public can only write through the `submit-event` edge function (service role). Admin SELECT/UPDATE/DELETE are gated by the same `private.events_admin_password_matches()` helper used for events inserts.
- `private.events_admin_credentials`: one-row private table containing the admin password salt/hash. RLS enabled. Direct access denied to public client roles. The password is checked by `private.events_admin_password_matches()`, which SHA-256 hashes the `x-admin-password` request header plus the stored salt and compares to the stored hash.

Tag taxonomy: `public.events.tags` uses a fixed set of nine diaspora community tags: South Asian, SWANA, East Asian, Southeast Asian, Black Diaspora, Latine, Afro-Latine, Indigenous, Cross-cultural. These power the events Category filter and are the only values the submit form and admin should use ("Cross-cultural" is labelled "Multi-diaspora / Cross-cultural" in the submit dropdown).

Neighborhood: `public.events.neighborhood` powers the events Neighborhood filter. Existing rows were backfilled (2026-06-25) from the trailing `, Neighborhood` segment of `venue` (normalized: parentheticals and " branch" stripped, "A / B" reduced to the first, "The Loop" → "Loop"). The card strips that trailing segment for display so the venue shows once. New events should set `neighborhood` directly (the submit form already does). Note: there is **no format-tag taxonomy** (Music/Film/Food/etc.) yet, so those filters are not built.

Display copy hygiene: event `cost_info` must never expose the research process (no "reviewed listing", "not inspected", "reviewed snippet", etc.). The rule (per the master doc §2b): show the price or "Free" if known, else "See organizer for details" or omit the line. The legacy backstage strings were cleaned on 2026-06-25.

Edge Functions:
- `submit-event` (`verify_jwt: false`): the only writer to `public.event_submissions`. Verifies a Cloudflare Turnstile token server-side, drops honeypot hits, validates required/conditional fields, then inserts with the service role. Public form posts JSON here instead of touching the database directly.
- Turnstile is configured for production: a Cloudflare Turnstile widget ("The Brown Line", Managed mode, hostnames `thebrownlinechi.com` and `www.thebrownlinechi.com`) provides the keys. The secret key is set as the `TURNSTILE_SECRET` Edge Function secret in Supabase, and the public site key is set as the `PUBLIC_TURNSTILE_SITE_KEY` GitHub repo variable (consumed in `deploy.yml`). For local development, when those are unset the function and form both fall back to Cloudflare's public TEST keys, so the flow works locally but accepts any token. Real keys live in Cloudflare; rotate there if needed.

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
- `PUBLIC_SITE_URL` is hardcoded to the custom domain (`https://thebrownlinechi.com`) in the workflow.
- A `CNAME` file in `public/CNAME` configures the custom domain for the GitHub Pages deployment.
- `PUBLIC_BEEHIIV_URL` and `PUBLIC_TURNSTILE_SITE_KEY` are read from GitHub repository variables.
- Supabase URL and publishable key are supplied at build time.
- `PUBLIC_GA_MEASUREMENT_ID` (optional) is read from a GitHub repo variable and passed through; when set, the GA4 script loads.

### Analytics (GA4)
`Layout.astro` loads Google Analytics 4 only when `PUBLIC_GA_MEASUREMENT_ID` (a `G-XXXXXXXXXX` id) is set, so the site ships no tracker by default.
- **Consent:** Consent Mode v2 sets `analytics_storage: 'denied'` (and ad storage denied) by default. A minimal bottom consent banner (`#bl-consent`) offers Accept / Decline, stores the choice in `localStorage` (`blAnalyticsConsent`), and on Accept calls `gtag('consent','update',{analytics_storage:'granted'})`. The banner only appears until a choice is made. Links to `/privacy`.
- **Custom events:** add `data-ga-event="<name>"` (and optional `data-ga-label`) to any element; a delegated click listener in `Layout.astro` fires `gtag('event', name, {label})`. A `change` listener does the same for `select[data-ga-event]` (events Category/Neighborhood filters, via `EventSelect.astro`). Scroll depth fires `scroll_depth` at 25/50/75/90%. Tagged so far: nav Support/Subscribe/Submit, homepage Browse/Submit/Support bands, events Submit + quick-filter chips + Category/Neighborhood, and each event card's Details/RSVP (`rsvp_click`, label = title) and Share (`share_click`). The submit form fires `submit_event_success` on a successful submission.
- **Note:** the hero email capture is a Beehiiv iframe (cross-origin), so its submit can't be tracked directly; the nav **Subscribe** button click is tracked, and true subscribe conversions live in Beehiiv's own stats. "Most-viewed cards" is approximated by `rsvp_click` counts per event title.
- To preview locally, set `PUBLIC_GA_MEASUREMENT_ID` in `.env` (commented example included); unset, no analytics or banner render.

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

- **2026-06-30 (master-doc reconciliation pass):** Audited the whole site against the Website Master Change Doc and closed the genuinely-open items (most of the doc was already shipped in the 2026-06-25 rework, so its "still broken" claims were stale).
  - **Submit page:** applied the locked §7 copy: "Put your event on the map." headline, the two-line "curated by a human, not scraped by an algorithm" intro, "Who should submit" / "What we look for" blocks, a timing helper (7-10 days / Thursday-for-Sunday) by the date field, and the "Thanks, your stop is in the queue" confirmation. Em dashes in the doc's source copy were rendered as commas/colons per § 7.
  - **Event card:** the author-note pull-quote is now labeled "Conductor's note"; added `break-words` to blurbs and a `fixSpelling()` Türkiye normalizer.
  - **Events board:** filter to upcoming server-side (`.gte('event_date', today)`) so no-JS visitors and the initial count are correct; renamed the floating panel label "Line signal" → "Filter the route"; added a "How we curate ->" link in the hero.
  - **Chrome / shared:** extracted the credibility strip into a shared `CredibilityStrip.astro` used by both the homepage and the About page (the latter closes the doc's one About gap); replaced the leftover "All stops, all stories." tagline in the mobile nav drawer with "Chicago's Global South culture, in motion."; tied "for" to the following phrase in the homepage H1 so it can't strand.
  - **Support:** removed em dashes a draft had introduced (kept the $7 Solidarity Fare model and $20/$50/$100 one-time tiers by owner decision). The $7/mo Stripe checkout link still points at the retired $9 product and needs repointing in Stripe.
  - **Recent dispatches:** normalize Beehiiv issue links to the `.co` domain in `issues.ts`.
  - **Owner tweaks (same pass):** homepage terminus now reads "See all stops" and deep-links to `/events#all` (opens on All upcoming); nav labels changed "Submit" → "Submit an Event" and "Standards" → "Ethics" (route still points at `/standards`).
  - **Nav Submit as a button:** pulled "Submit an Event" off the route map and promoted it to a standalone amber `.nav-cta-amber` CTA button, placed after Support and Subscribe (rightmost on desktop, bottom of the mobile drawer). The route is back to four short stops (Events, Archive, About, Ethics) with the default 4.25rem gap.
  - **Deferred (owner decisions / data / assets):** Testimonials left dormant (no real quotes yet); World Cup hub skipped; Events H1 kept as "Find your next stop."; em dashes remaining in some event titles and the latest issue title are DB/feed content, not authored UI copy; optional submit fields (multi-tag, organizer IG, flyer upload, age, accessibility, price type) need a `public.event_submissions` schema change plus edge-function work.
- **2026-06-25 (splash no-JS fail-safe):** The intro splash dismissed only via JS, so if the React island failed to hydrate (blocked/slow/errored script) a visitor was trapped on it forever with no way in. Added a pure-CSS `splash-failsafe-hide` animation on `.train-splash-root` (in the SSR HTML) that fades the overlay out and drops `pointer-events` at 9s as a backstop. Normal JS dismissal (~2.5s) is unchanged and unmounts the splash before the fail-safe fires.
- **2026-06-25 (credibility logos + nav fixes):** Added the four partner logos to the homepage credibility strip (Northwestern Medill, Project C, Meet Your Neighbor; Featured in Chicago Reader) in bordered tiles, each hyperlinked to the org in a new tab and GA-tracked (`partner_click`). Fixed the desktop nav: the last route label ("Standards") was overflowing into the Support button, so `.desktop-route` now reserves horizontal padding (with the track inset to match) and tighter gaps; the inline route also moved to `lg+` (tablets/phones use the hamburger drawer) so the 5 stops plus two buttons never cram below ~1024px.
- **2026-06-25 (DC pitch pass, from the Website Master Change Doc):** Large consistency + hierarchy pass ahead of the July investor pitch.
  - **Event card:** unified all events onto the one bordered card (filled tags, venue-once, Conductor's Pick demoted to a badge, `Details / RSVP` + `Share` buttons). The card is now always an `<article>` (no whole-card link), and `Share` uses the Web Share API with clipboard fallback via one delegated listener.
  - **Events board:** collapse identical recurring/multi-day events into one card with a date range (Imaginarte 25 → 1, etc.); added quick-filter chips (This week default / This weekend / All upcoming / Free); default to This Week with range-overlap filtering; Neighborhood filter now populated (backfill below); "Platform" eyebrow shown once; floating "Line signal" panel hidden at `lg+` so there's one filter block per breakpoint.
  - **Homepage:** all §2a copy swaps; Upcoming Stops now leads with a Conductor's Pick (query reordered curated-first) and the NEXT STOP banner pulls the next Pick with a `·` separator; added a two-sided Browse/Submit band, a Support band, a credibility strip with partner logos (Supported by Northwestern Medill, Project C, Meet Your Neighbor; Featured in Chicago Reader, in bordered tiles), and a Testimonials section that renders only when real quotes are added.
  - **Chrome:** Nav gained a Submit link and distinct Support/Subscribe buttons (`.nav-cta`); Footer gained Support, fixed the dead `#privacy` anchor (now `/privacy`), and swapped tagline + copyright; intro gate now remembers dismissal in `localStorage` (`brownLineIntroSeen`) and auto-skips for reduced-motion via an inline `<head>` check that sets `splash-done` before paint; ticker curated to <=5 deduped highlights (Conductor's Picks first) and the marquee given end padding + a solid toggle so text no longer collides with the controls.
  - **Pages:** About reordered project-first then founder ("amplifying" → "covering"); Standards links the submission form (email as fallback) and bumped to June 2026; new `/support` (confirmed Stripe links: $20/$50/$100 one-time + a $9/mo "Ride monthly" tier, alongside a free Street Level) and `/privacy` pages.
  - **Type/color:** moved `.font-heading` weight into `@layer base` so weight utilities win; section heads/card titles to semibold; darkened the named secondary-text offenders (venue subtitle, closing paragraph, footer tagline) for WCAG AA.
  - **Analytics (GA4):** added Google Analytics 4 via `gtag.js`, loaded only when `PUBLIC_GA_MEASUREMENT_ID` is set (no tracker ships otherwise). Consent Mode v2 defaults `analytics_storage` to denied; a minimal on-brand consent banner upgrades to granted and remembers the choice in `localStorage`. Custom events are wired via `data-ga-event` / `data-ga-label` attributes on CTAs (subscribe/support/submit/browse, event RSVP + share, events filters) plus scroll-depth, read by one delegated listener in `Layout.astro`. (Initially scoped as Plausible; switched to GA4 per the owner.)
  - Em dashes were kept out of all newly authored copy (commas/colons/`·`); date-range labels use an en dash, which §7 permits for true ranges.
- **2026-06-22 (Turnstile configured + admin access):** Created the Cloudflare Turnstile widget ("The Brown Line", Managed) and wired its keys: the public site key as the `PUBLIC_TURNSTILE_SITE_KEY` GitHub repo variable and the secret as the `TURNSTILE_SECRET` Supabase Edge Function secret, so the public submit form is bot-protected in production. Reset the admin portal credential after confirming the stored hash no longer matched the expected password (the value is recorded in the ignored `PRIVATE_README.md`, not here).
- **2026-06-21 (events filter and data model):** Rebuilt the `/events` filter as a streamlined bar: a single-date calendar that jumps to a day (keeping surrounding events visible), a themed Category dropdown (custom listbox on desktop, native select on mobile), and a Neighborhood filter; removed the line-type radios, "Has link" toggle, and the jump/from/to selects. Added a `neighborhood` column to `public.events`. Dropped the free-text `display_date` column and now derive every day label from `event_date` via `formatStopDate` (`src/lib/dates.ts`), grouping by `event_date` so a day is always one segment. Narrowed event tags to the nine-tag diaspora taxonomy and migrated all rows (prior tags backed up in `public.events_taxonomy_backup`). Switched the marquee to constant pixels-per-second scrolling. Removed em dashes across the site, code comments, and this doc, and retired the Standards founder-voice exception.
- **2026-06-21 (public event submissions):** Added a public `/submit-event` request form (per the Events DB Spec: required title, date, venue, community tag, location type, and description; conditional Chicago neighborhood and suburb fields; optional time, address, organizer, cost, and URL; plus a required submitter name and optional email). Submissions are guarded by a Cloudflare Turnstile captcha and a honeypot, verified server-side by the new `submit-event` edge function, and queued in `public.event_submissions` (RLS: no public insert; admin-only review). The admin portal gained a review queue to edit, approve into `public.events`, or reject each submission. Set `TURNSTILE_SECRET` (edge function secret) and `PUBLIC_TURNSTILE_SITE_KEY` (repo variable) for production; the build falls back to Cloudflare TEST keys until then.
- **2026-06-21 (JT Modernism → logo wordmark only):** Brought JT Modernism back for the brand logo wordmark exclusively. Added a `font-wordmark` Tailwind family (`'JT Modernism', Georgia, serif`) and the app's `Font.Brand.wordmark(_:)`; pointed the nav/footer "the Brown Line" lockups and the app home masthead at it. Everything else (headings, the `@thebrownline` handle, numerals) stays Montserrat. Codified the "if it isn't the logo, it's Montserrat" rule in § 3.
- **2026-06-21 (headings → Montserrat):** Retired JT Modernism from headings because it read poorly at a glance. `font-heading` now resolves to Montserrat, and the `.font-heading` utility carries `font-weight: 800` (ExtraBold) so display type keeps its presence. Added a Montserrat ExtraBold `@font-face` (800). Repointed the `h1–h6`/`.font-heading` rule and the `TrainSplash.jsx` inline label font stacks. JT Modernism `.ttf` files and `@font-face` blocks are retained but unreferenced. Rewrote § 3 Typography to match.
- **2026-06-21 (custom domain configuration):** Configured custom domain deployment to GitHub Pages by creating a `CNAME` file in the `public/` directory and updating `PUBLIC_SITE_URL` to `https://thebrownlinechi.com` in the deploy workflow.
- **2026-06-01 (homepage upcoming stops):** Added an `Upcoming Stops` Transit Route Timeline to the homepage using Supabase `public.events` data, a section-specific high-contrast monospace `Marquee` with a faster 18s repeated loop, CTA Brown `#62361B` track and stop nodes, shared `EventCard` rendering, a real empty state, and a closing `TransitDivider`.
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
