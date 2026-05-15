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
| **Accent 1** | Cayenne | `#F35A0F` | Primary Call-to-Action (Beehiiv button), urgent states. |
| **Accent 2** | Amber | `#FFBC29` | Secondary highlights, tags, secondary button states. |
| **Accent 3** | Celadon | `#90D393` | Tertiary accents, success states. |
| **Accent 4** | Maya Blue | `#5BC3FF` | Link underlines, hover accents. |
| **Accent 5** | Baby Pink | `#F79CD0` | Decorative elements. |

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
- **Retro Hover States:** Instead of soft blurs, use hard block shadows. E.g., `box-shadow: 4px 4px 0px #642713;`. On hover, interactive elements should shift slightly (`-translate-y-1` and `-translate-x-1`).
- **Dividers:** Replace standard `<hr>` tags with a custom "Transit Stripe" component, a 5-color linear gradient line (Pink, Maya Blue, Celadon, Amber, Cayenne) to divide major sections.

## 5. Layout & Integration
- **Spacing:** Generous padding (e.g., `py-24`). Content should be constrained to readable max-widths (e.g., `max-w-3xl` for text, `max-w-5xl` for grids).
- **Beehiiv Integration:** The primary hero section features a custom-styled HTML form that visually matches our design system, posting directly to the Beehiiv subscriber endpoint. Avoid the unstyled default Beehiiv iframe. The form action is read from `PUBLIC_BEEHIIV_URL` at build time.

## 6. Writing Style

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

## 7. Brand Assets

- **Primary logo (color, transparent BG):** `public/logos/logo.png`. Used in the nav and as the favicon. Source for the homepage Open Graph share image.
- **Logo variants:** Numbered `public/logos/1.png` through `public/logos/11.png` are designer-supplied variations. `5.png` is the dark-background inverse, useful if the footer ever needs a logo on Dark Walnut.
- **Founder portrait:** `public/images/ghazala.jpeg`. Used on the About page and as that page's Open Graph share image.
- **Fonts:**
  - `public/fonts/JT Modernism - Header/JtModernism-{Regular,Bold,Black}.ttf`
  - `public/fonts/Montserrat - Body/Montserrat-{Regular,SemiBold,Bold}.ttf`
  - Loaded via `@font-face` in `src/styles/global.css` with URL-encoded paths (`%20` for the spaces in the folder names).

## 8. Component & Page Inventory

Components live in `src/components/`:
- `Nav.astro`: top bar with the logo and three primary links.
- `TransitDivider.astro`: the 5-color stripe used between sections and at the top of the footer.
- `SubscribeForm.astro`: the Beehiiv POST form. Reads `PUBLIC_BEEHIIV_URL` from env, falls back to `#BEEHIIV_EMBED_URL`.
- `IssueCard.astro`: archive card with category, date, title, and read link. Hover translates and casts an Amber or Cayenne hard shadow.
- `Footer.astro`: dark walnut footer with the brand wordmark and link column.
- `TrainSplash.jsx`: React splash overlay (auto-dismiss, `sessionStorage` gated, respects `prefers-reduced-motion`).

Pages live in `src/pages/`:
- `index.astro`: hero, recent rides grid, about teaser, footer.
- `about.astro`: founder portrait and bio, affiliations, outlet description, values strip, subscribe CTA.
- `standards.astro`: editorial Standards & Ethics page (independence, selection criteria, no pay-to-play, conflicts, corrections, perspective). Linked from the footer.

## 9. Changelog

- **2026-05-14 (later):** Added the Standards & Ethics page at `/standards`. Linked it from the footer. Updated the footer contact email to `hi@thebrownlinechi.com` (the publication's address). Note: the no-em-dash rule does not apply inside the Standards copy because that text was provided verbatim by the founder and em dashes there are intentional.
- **2026-05-14:** Initial Astro + Tailwind scaffold. Added About page. Wired Open Graph and Twitter share cards (homepage uses logo, About page uses founder portrait). Renamed display font reference from "Ja Modernism" to "JT Modernism" to match the actual asset names. Rebalanced typography so Montserrat is the default and JT Modernism is reserved for display sizes (`text-4xl` and above). Added a no-em-dash writing rule.
