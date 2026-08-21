import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env file manually
const envText = fs.readFileSync('c:/Users/STEPUP GRAPHISTE/Documents/DevApp/RH/.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log('Sample row columns:', Object.keys(data[0] || {}));
  }
}

main();
