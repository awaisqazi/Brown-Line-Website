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
Dark Walnut bar with Amber text, top and bottom 2px Amber borders. Two copies of the phrase concatenated and translated `0 → -50%` over 30s linear infinite so the loop is seamless. Reserved for the slot directly above the footer's `TransitDivider`; do not duplicate elsewhere. Static under `prefers-reduced-motion`.

### Paper-Grain Noise Overlay (`Layout.astro`)
A single fixed div with an inline SVG noise texture (`feTurbulence` `baseFrequency=0.85`, `numOctaves=3`, `stitchTiles=stitch`) at `opacity: 0.04` with `mix-blend-mode: multiply`. `pointer-events-none`, `aria-hidden="true"`, `z-[999]` so it never blocks clicks and applies texture site-wide (including over the splash and mobile drawer). The result reads as recycled newsprint, not visual noise.

### Brand Text Selection
Global rule in `global.css`. `::selection` background is Maya Blue, color is Dark Walnut. No exceptions.

### Platform Map (`/links` page)
The Link-in-Bio page reuses the Mobile Drawer Route Map pattern as its primary affordance: each link is a "stop" on a vertical Dark Walnut track. Stop dots are 22×22 with 2px walnut border and `shadow-retro`, colors rotate through the brand palette in the same order as the divider gradient. Stops stagger-in on page load (220 / 300 / 380 / 460 ms) and the vertical track draws downward (`scaleY 0 → 1`). External destinations show a `↗` glyph; internal show `→`. Hover/focus tints the row Cayenne, scales the dot up, and slides the arrow right. Same `prefers-reduced-motion` fallback as the drawer.

### Social Icons (Nav drawer and Footer)
40×40 touch target, icon stroke is `currentColor` at 2px, default fill `text-darkWalnut` (on Seashell) or `text-seashell` (on Dark Walnut). Hover lifts by 2px and tints to Cayenne (on Seashell) or Amber (on Dark Walnut). Render in a flex row so new socials drop in cleanly.

## 6. Layout & Integration
- **Spacing:** Generous padding (e.g., `py-24`). Content should be constrained to readable max-widths (e.g., `max-w-3xl` for text, `max-w-5xl` for grids, `max-w-md` for the Link-in-Bio page).
- **Beehiiv Integration:** The primary hero section features a custom-styled HTML form that visually matches our design system, posting directly to the Beehiiv subscriber endpoint. Avoid the unstyled default Beehiiv iframe. The form action is read from `PUBLIC_BEEHIIV_URL` at build time.

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

- **Primary logo (color, transparent BG):** `public/logos/logo.png`. Used in the nav and as the favicon. Source for the homepage Open Graph share image.
- **Logo variants:** Numbered `public/logos/1.png` through `public/logos/11.png` are designer-supplied variations. `4.png` is the circular avatar variant used on the Link-in-Bio page. `5.png` is the dark-background inverse, useful if the footer ever needs a logo on Dark Walnut.
- **Founder portrait:** `public/images/ghazala.jpeg`. Used on the About page and as that page's Open Graph share image.
- **Fonts:**
  - `public/fonts/JT Modernism - Header/JtModernism-{Regular,Bold,Black}.ttf`
  - `public/fonts/Montserrat - Body/Montserrat-{Regular,SemiBold,Bold}.ttf`
  - Loaded via `@font-face` in `src/styles/global.css` with URL-encoded paths (`%20` for the spaces in the folder names).

## 9. Component & Page Inventory

Components live in `src/components/`:
- `Nav.astro`: header with logo and five primary links. Desktop = horizontal route-map nav. Mobile = hamburger that opens the sliding route-map drawer (see § 5). Sticky on mobile, static on desktop.
- `TransitDivider.astro`: the 5-color stripe used between sections and at the top of the footer.
- `Marquee.astro`: LED ticker with Amber-on-Walnut scrolling phrases. Reserved for the slot directly above the footer divider. Site-wide.
- `SubscribeForm.astro`: the Beehiiv POST form. Reads `PUBLIC_BEEHIIV_URL` from env, falls back to `#BEEHIIV_EMBED_URL`. Accepts an optional `class` prop for width tuning.
- `IssueCard.astro`: archive card with category, date, title, and read link. Hover translates and casts an Amber or Cayenne hard shadow.
- `Footer.astro`: dark walnut footer with the brand wordmark, copy, "Find us" social row (Instagram), and "Follow the line" link column.
- `TrainSplash.jsx`: React splash overlay (auto-dismiss, respects `prefers-reduced-motion`, static LED destination sign reads `NEXT STOP: THE BROWN LINE`).

Pages live in `src/pages/`:
- `index.astro`: hero, recent rides grid, about teaser.
- `about.astro`: founder portrait and bio, affiliations, outlet description, values strip, subscribe CTA.
- `standards.astro`: editorial Standards & Ethics page. Linked from the footer.
- `links.astro`: Link-in-Bio destination optimized for IG / TikTok in-app browser traffic. Uses `<Layout minimal>` so no site chrome (no Nav, Footer, top TransitDivider, or splash) renders. The noise overlay and ::selection still apply.

The `Layout` component accepts an optional `minimal?: boolean` prop (default `false`). Set `minimal` when a page should render standalone without the global Nav, top TransitDivider, Footer, or TrainSplash. Reach for it for deep-link entry points like Link-in-Bio pages or future campaign landings.

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

## 11. Changelog

- **2026-05-15 (links polish):** Removed the redundant "Follow" row from `/links` (Instagram is already a stop on the Platform Map). Made the page read intentionally on desktop: wider `max-w-lg` column, larger handle and avatar at `md+`, extra vertical padding, and two faint walnut "platform rails" flanking the column at desktop widths. Mobile presentation is unchanged.
- **2026-05-15 (links redesign):** Replaced the `/links` brutalist button stack with a Platform Map: vertical Dark Walnut track with colored transit stops, staggered entry animation, and the same hover language as the Mobile Drawer Route Map. Added a `minimal?: boolean` prop to `Layout` so `/links` renders with no Nav, Footer, top divider, or splash chrome (the noise overlay and brand `::selection` still apply).
- **2026-05-15:** Visual "next level" pass. Added a site-wide SVG paper-grain noise overlay in `Layout.astro` at 4% multiply opacity. Built `Marquee.astro` (Amber-on-Walnut LED ticker) and wired it into the slot above the footer divider. Added brand `::selection` (Maya Blue background, Dark Walnut text) to `global.css`. Built the initial `/links` Link-in-Bio page (later redesigned, see above). Documented the new patterns and page templates in this file.
- **2026-05-15 (earlier):** Replaced the link hover underline with the 5-color transit gradient (`.link-transit`). Rebuilt the mobile nav as a sliding route-map drawer with staggered transit-stop entries, a vertical track line, and a hamburger-to-X morph. Made the header sticky on mobile only. Added Instagram social icon to the footer "Find us" row and to a "Follow" row inside the mobile drawer. Replaced the broken scrolling marquee in `TrainSplash.jsx` with a static, centered LED destination sign using native SVG `<text>` so it scales with the viewBox at every screen size. Updated the splash skip button to read "Loading your next stop…" Wired `PUBLIC_SITE_URL` into the GitHub Pages deploy workflow so the build picks the correct `/Brown-Line-Website/` base.
- **2026-05-14 (later):** Added the Standards & Ethics page at `/standards`. Linked it from the footer. Updated the footer contact email to `hi@thebrownlinechi.com` (the publication's address). Note: the no-em-dash rule does not apply inside the Standards copy because that text was provided verbatim by the founder and em dashes there are intentional.
- **2026-05-14:** Initial Astro + Tailwind scaffold. Added About page. Wired Open Graph and Twitter share cards (homepage uses logo, About page uses founder portrait). Renamed display font reference from "Ja Modernism" to "JT Modernism" to match the actual asset names. Rebalanced typography so Montserrat is the default and JT Modernism is reserved for display sizes (`text-4xl` and above). Added a no-em-dash writing rule.
