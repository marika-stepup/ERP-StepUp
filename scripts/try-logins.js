import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local
const envPath = path.resolve('.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      acc[match[1].trim()] = value.trim();
    }
    return acc;
  }, {});

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseAnonKey = envConfig.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin(email, password) {
  console.log(`Testing login for ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`❌ Login failed for ${email}:`, error.message);
  } else {
    console.log(`✅ Login SUCCESS for ${email}!`);
    console.log(`   User ID: ${data.user.id}`);
    console.log(`   Role (app_metadata):`, data.user.app_metadata?.role);
    console.log(`   Role (user_metadata):`, data.user.user_metadata?.role);
    console.log(`   Full Name:`, data.user.user_metadata?.full_name || data.user.user_metadata?.name);
  }
}

async function run() {
  await testLogin('employee@entreprise.com', 'passEmployee123');
  await testLogin('hr@entreprise.com', 'passHR123');
  await testLogin('ingrid.g@stepupdigital.net', 'passHR123');
  await testLogin('dany.r@stepupdigital.net', 'passHR123');
}

run().catch(console.error);
