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

const emails = [
  'oli.a@stepupdigital.net',
  'dany.r@stepupdigital.net',
  'tsoavina.a@stepupdigital.net',
  'ingrid.g@stepupdigital.net'
];

const passwords = [
  'passStepUp123',
  'passEmployee123',
  'passHR123',
  'password',
  '123456',
  'stepup123',
  'StepUp123',
  'admin123',
  'azerty'
];

async function run() {
  for (const email of emails) {
    for (const pwd of passwords) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (!error) {
        console.log(`✅ FOUND PASSWORD for ${email}: "${pwd}" (ID: ${data.user.id})`);
        break;
      }
    }
  }
}

run().catch(console.error);
