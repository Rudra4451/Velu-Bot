import { config } from 'dotenv';
config();

import { checkSupabaseHealth, getSupabase } from '../src/database/supabase.js';

async function testConnection() {
  console.log('Testing Supabase Connection...');
  console.log(`URL Configured: ${process.env.SUPABASE_URL ? 'YES' : 'NO'}`);
  console.log(`Key Configured: ${process.env.SUPABASE_ANON_KEY ? 'YES' : 'NO'}`);
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing credentials in .env file!');
    process.exit(1);
  }

  const isHealthy = await checkSupabaseHealth();
  if (isHealthy) {
    console.log('✅ Supabase connection is healthy!');
    const client = getSupabase();
    const { data, error } = await client.from('guild_configs').select('*').limit(1);
    if (error) {
      console.error('❌ Could connect, but failed to read `guild_configs` table. Did you create it? Error:', error.message);
    } else {
      console.log('✅ Successfully accessed `guild_configs` table!');
      console.log('Supabase is fully working and ready.');
    }
  } else {
    console.log('❌ Supabase health check failed.');
  }
}

testConnection();
