import fs from 'fs';
import path from 'path';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

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

const spreadsheetId = envConfig.GOOGLE_SHEET_ID;
const email = envConfig.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = envConfig.GOOGLE_PRIVATE_KEY;
if (privateKey) {
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
}

const serviceAccountAuth = new JWT({
  email,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);

async function run() {
  await doc.loadInfo();
  console.log('Document Title:', doc.title);
  for (const sheet of doc.sheetsByIndex) {
    console.log(`\nSheet: "${sheet.title}"`);
    await sheet.loadHeaderRow();
    console.log('Headers:', sheet.headerValues);
    const rows = await sheet.getRows();
    console.log(`Row count: ${rows.length}`);
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      console.log(`Row ${i}:`, rows[i].toObject());
    }
  }
}

run().catch(console.error);
