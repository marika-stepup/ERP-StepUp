import pkg from '@next/env';
const { loadEnvConfig } = pkg;
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkPolicies() {
  console.log('Querying database policies for leave_balances...');
  
  // Query pg_policies to list all RLS policies on our tables
  const { data, error } = await supabaseAdmin.rpc('get_policies'); // We might not have this RPC, let's write a direct SQL check or list
  
  // If RPC is not available, we can run a direct query using supabase's REST API on pg_catalog if exposed, 
  // but usually it's not exposed. Let's do a direct SQL query by executing a select on pg_policies using an RPC if possible,
  // or we can write a script to inspect policies.
  // Wait, if RPC is not available, let's just query it by running a SQL select via the REST API? No, REST API only exposes public tables.
  // Let's see if we can query pg_policies. Let's try!
  const { data: policies, error: polErr } = await supabaseAdmin
    .from('pg_policies') // this won't work by default unless exposed
    .select('*');
    
  if (polErr) {
    console.log('Direct select on pg_policies failed (normal for Supabase). Let\'s try to read all policies using a custom RPC or check if we can inspect it.');
    console.error('Error details:', polErr);
  } else {
    console.log('Policies found:', policies);
  }
}

checkPolicies().catch(console.error);
