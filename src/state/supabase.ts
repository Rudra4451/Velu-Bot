import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// We initialize the Supabase client if URL and KEY are provided.
// Otherwise, we export null to allow graceful fallback to local-only mode.
export const supabase = config.SUPABASE_URL && config.SUPABASE_KEY
  ? createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
      auth: {
        persistSession: false,
      },
    })
  : null;

if (supabase) {
  logger.info('🔌 Supabase client initialized.');
} else {
  logger.warn('⚠️ Supabase credentials not found. Bot database will run in local in-memory mode.');
}
