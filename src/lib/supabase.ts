import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabasePublishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

export interface TransitEvent {
  id: string;
  event_date: string;
  display_date: string;
  title: string;
  description: string | null;
  venue: string;
  organizer: string | null;
  cost_info: string | null;
  event_url: string | null;
  is_curated: boolean;
  is_giveaway: boolean;
  emoji: string | null;
  tags: string[] | null;
  author_note: string | null;
}
