import pkg from '@next/env';
const { loadEnvConfig } = pkg;
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', supabaseUrl);
console.log('SUPABASE_SERVICE_ROLE_KEY exists?', !!supabaseServiceKey);
console.log('SUPABASE_SERVICE_ROLE_KEY starts with:', supabaseServiceKey ? supabaseServiceKey.substring(0, 20) : 'none');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testInsert() {
  const testId = '00000000-0000-0000-0000-000000000000'; // Placeholder UUID
  
  console.log('\nAttempting to insert test balance row into leave_balances...');
  const { data, error } = await supabaseAdmin
    .from('leave_balances')
    .insert({
      employee_id: testId,
      employee_name: 'Test',
      employee_first_name: 'User',
      employee_email: 'test-admin-script@entreprise.com',
      role: 'employee',
      initial_balance: 25,
      remaining_balance: 25
    });

  if (error) {
    console.error('❌ Insert failed:', error);
  } else {
    console.log('✔️ Insert succeeded:', data);
    
    // Clean up
    console.log('Cleaning up test row...');
    const { error: deleteErr } = await supabaseAdmin
      .from('leave_balances')
      .delete()
      .eq('employee_id', testId);
      
    if (deleteErr) console.error('Delete cleanup failed:', deleteErr);
    else console.log('Cleanup succeeded.');
  }
}

testInsert().catch(console.error);
