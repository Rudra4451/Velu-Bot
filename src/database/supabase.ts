import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!url || !key) {
      logger.warn('Supabase credentials missing! Running in degraded local-only mode.');
      // Create a dummy client if no keys provided, so it doesn't crash, 
      // but writes will obviously fail. Real deployment should provide keys.
      supabaseClient = createClient('https://dummy.supabase.co', 'dummy_key');
    } else {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false }
      });
    }
  }
  return supabaseClient;
}

export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const client = getSupabase();
    // Simple health check query - just testing connection
    const { error } = await client.from('guild_configs').select('id').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is empty response, not connection error
      throw error;
    }
    logger.info('Supabase database connection established.');
    return true;
  } catch (error) {
    logger.error('Supabase health check failed. Will use cached memory.', error);
    return false;
  }
}
