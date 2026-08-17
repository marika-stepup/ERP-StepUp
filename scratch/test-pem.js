import pkg from '@next/env';
const { loadEnvConfig } = pkg;

loadEnvConfig(process.cwd());

let key = process.env.GOOGLE_PRIVATE_KEY;
console.log('Original private key raw length:', key ? key.length : 0);

if (key) {
  console.log('Starts with quote?', key.startsWith('"') || key.startsWith("'"));
  console.log('Ends with quote?', key.endsWith('"') || key.endsWith("'"));

  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  else if (key.startsWith("'") && key.endsWith("'")) key = key.slice(1, -1);

  console.log('Cleaned key length:', key.length);
  console.log('Contains literal \\n?', key.includes('\\n'));
  console.log('Contains actual newlines?', key.includes('\n'));
  
  const parsedKey = key.replace(/\\n/g, '\n');
  console.log('Parsed key length:', parsedKey.length);
  console.log('Parsed key actual newlines count:', (parsedKey.match(/\n/g) || []).length);
  console.log('First 50 chars:', parsedKey.substring(0, 50));
  console.log('Last 50 chars:', parsedKey.substring(parsedKey.length - 50));
}
