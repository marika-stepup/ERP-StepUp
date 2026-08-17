import pkg from '@next/env';
const { loadEnvConfig } = pkg;

loadEnvConfig(process.cwd());

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
console.log('GOOGLE_PRIVATE_KEY length:', process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.length : 0);
