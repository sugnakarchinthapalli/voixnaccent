import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL environment variable is required');
}

// Create service role client or fallback to regular client
let supabaseServiceRole: SupabaseClient;

if (!serviceRoleKey || serviceRoleKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE' || serviceRoleKey.trim() === '') {
  console.warn('⚠️ Service role key not configured, using regular Supabase client as fallback');
  console.warn('⚠️ This may cause RLS issues for candidate operations');
  supabaseServiceRole = supabase;
} else {
  supabaseServiceRole = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-client-info': 'voiceval-service-role'
      }
    }
  });
  console.log('✅ Service role client initialized successfully');
}

export { supabaseServiceRole };
