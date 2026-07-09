import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Manually parse .env.local to load keys
const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found.');
  process.exit(1);
}

const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      // Strip wrapping quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      acc[match[1].trim()] = value.trim();
    }
    return acc;
  }, {});

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseAnonKey = envConfig.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env.local.');
  process.exit(1);
}

console.log('Connecting to Supabase at:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function registerUser(email, password, fullName, role) {
  console.log(`\nAttempting to register: ${email} (${fullName}) with role: "${role}"`);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role
      }
    }
  });

  if (error) {
    console.error(`❌ Error during registration for ${email}:`, error.message);
  } else {
    console.log(`✅ Success! User registered.`);
    console.log(`   User ID: ${data.user?.id}`);
    console.log(`   Role assigned in user_metadata: ${data.user?.user_metadata?.role}`);
    if (data.session) {
      console.log(`   Session established immediately (auto-confirm enabled).`);
    } else {
      console.log(`   Email confirmation might be required depending on your Supabase settings.`);
    }
  }
}

async function run() {
  // Create an employee account
  await registerUser(
    'employee@entreprise.com',
    'passEmployee123',
    'Alice Martin',
    'employee'
  );

  // Create an HR account
  await registerUser(
    'hr@entreprise.com',
    'passHR123',
    'Bob Dupont',
    'hr'
  );

  console.log('\n--- Registration completed ---');
}

run();
