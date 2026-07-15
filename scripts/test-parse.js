import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.log('.env.local does not exist at', envPath);
} else {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  console.log(`Read ${lines.length} lines.`);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    console.log(`Line ${idx + 1}: Key = "${key}" (value length = ${parts.slice(1).join('=').trim().length})`);
  });
}
