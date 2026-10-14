/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_PUBLISHABLE_KEY: string;
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  /** First day of the public newsletter archive, YYYY-MM-DD. See src/lib/archive.ts. */
  readonly NEWSLETTER_PUBLIC_FROM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
