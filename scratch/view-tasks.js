import pkg from '@next/env';
const { loadEnvConfig } = pkg;
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const { data: clients, error: errC } = await supabaseAdmin
    .from('production_clients')
    .select('*');
  if (errC) {
    console.error('Error fetching clients:', errC);
    return;
  }
  console.log('--- CLIENTS ---');
  console.log(JSON.stringify(clients, null, 2));

  const { data: tasks, error: errT } = await supabaseAdmin
    .from('production_tasks')
    .select('*');
  if (errT) {
    console.error('Error fetching tasks:', errT);
    return;
  }
  console.log('--- TASKS ---');
  console.log(JSON.stringify(tasks, null, 2));
}

main().catch(console.error);
