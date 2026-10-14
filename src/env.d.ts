/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_PUBLISHABLE_KEY: string;
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  /** Newsletter issue gate switch: "off" shows every issue whole. See src/lib/gate.ts. */
  readonly PUBLIC_NEWSLETTER_GATE?: string;
  /** Optional date floor for on-site newsletter pages, YYYY-MM-DD. See src/lib/archive.ts. */
  readonly NEWSLETTER_PUBLIC_FROM?: string;
  /** Beehiiv v2 API key (posts read). Set with BEEHIIV_PUBLICATION_ID to prefer the API over RSS. */
  readonly BEEHIIV_API_KEY?: string;
  /** Beehiiv publication id (pub_...). */
  readonly BEEHIIV_PUBLICATION_ID?: string;
  /** Test hook: base URL of a stand-in for api.beehiiv.com. Leave unset. */
  readonly BEEHIIV_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
