import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase'; // Fallback to regular client

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

let serviceRoleClient: any = null;

if (!supabaseUrl || !supabaseServiceRoleKey || supabaseServiceRoleKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE') {
  console.warn('⚠️ Missing or placeholder Supabase service role key. Using fallback authentication.');
  console.warn('Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file for full functionality.');
  
  // Use regular client as fallback
  serviceRoleClient = supabase;
} else {
  // Service role client - bypasses RLS
  serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export const supabaseServiceRole = serviceRoleClient;
