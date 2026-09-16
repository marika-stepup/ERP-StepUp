import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { 
  SheetTabs, 
  LeaveBalancesColumns, 
  LeaveRequestsColumns, 
  TimeLogsColumns,
  formatSheetFloat, 
  formatDateToFrench, 
  formatBreakDurationToDecimalHours,
  calculateTotalHoursWorkedDecimal
} from '../lib/sheetsColumns.js';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

loadEnvConfig(process.cwd());

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;

if (googlePrivateKey) {
  if (googlePrivateKey.startsWith('"') && googlePrivateKey.endsWith('"')) {
    googlePrivateKey = googlePrivateKey.slice(1, -1);
  } else if (googlePrivateKey.startsWith("'") && googlePrivateKey.endsWith("'")) {
    googlePrivateKey = googlePrivateKey.slice(1, -1);
  }
  googlePrivateKey = googlePrivateKey.replace(/\\n/g, '\n');
}

if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !googlePrivateKey) {
  console.error('Error: Missing Google Sheets configuration.');
  process.exit(1);
}

const serviceAccountAuth = new JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: googlePrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);

async function cleanAndFormatAllSheets() {
  console.log('--- Démarrage du nettoyage et reformatage FR en Batch (1 seule requête par feuille) ---');
  await doc.loadInfo();
  console.log(`Document chargé: "${doc.title}"`);

  // ==========================================
  // 1. Feuille "Pointages"
  // ==========================================
  const timeLogsSheet = doc.sheetsByTitle[SheetTabs.timeLogs];
  if (timeLogsSheet) {
    console.log(`\nTraitement de la feuille "${SheetTabs.timeLogs}"...`);
    await timeLogsSheet.loadCells();
    const rowCount = timeLogsSheet.rowCount;
    console.log(`Nombre total de lignes dans la grille: ${rowCount}`);

    let updatedCellsCount = 0;
    // Row 0 is header
    for (let r = 1; r < rowCount; r++) {
      const idCell = timeLogsSheet.getCell(r, 0);
      if (!idCell.value) continue; // Empty row

      const dateCell = timeLogsSheet.getCell(r, 2);
      const inCell = timeLogsSheet.getCell(r, 3);
      const outCell = timeLogsSheet.getCell(r, 4);
      const breakCell = timeLogsSheet.getCell(r, 5);
      const totalCell = timeLogsSheet.getCell(r, 6);
      const createdCell = timeLogsSheet.getCell(r, 8);

      const rawBreak = breakCell.formattedValue || (breakCell.value != null ? String(breakCell.value) : '');
      const rawTotal = totalCell.formattedValue || (totalCell.value != null ? String(totalCell.value) : '');
      const rawDate = dateCell.formattedValue || (dateCell.value != null ? String(dateCell.value) : '');
      const rawCreated = createdCell.formattedValue || (createdCell.value != null ? String(createdCell.value) : '');
      const clockIn = inCell.formattedValue || inCell.value || '';
      const clockOut = outCell.formattedValue || outCell.value || '';

      const newBreak = formatBreakDurationToDecimalHours(rawBreak);
      let newTotal = rawTotal;
      if (clockIn && clockOut) {
        newTotal = calculateTotalHoursWorkedDecimal(clockIn, clockOut, rawBreak);
      } else if (!clockOut) {
        newTotal = '';
      } else {
        newTotal = formatBreakDurationToDecimalHours(rawTotal);
      }

      const newDate = formatDateToFrench(rawDate);
      const newCreated = formatDateToFrench(rawCreated);

      if (rawBreak !== newBreak) {
        breakCell.value = newBreak;
        updatedCellsCount++;
      }
      if (rawTotal !== newTotal) {
        totalCell.value = newTotal;
        updatedCellsCount++;
      }
      if (rawDate !== newDate) {
        dateCell.value = newDate;
        updatedCellsCount++;
      }
      if (rawCreated !== newCreated) {
        createdCell.value = newCreated;
        updatedCellsCount++;
      }
    }

    if (updatedCellsCount > 0) {
      await timeLogsSheet.saveUpdatedCells();
      console.log(`✔ Feuilles Pointages sauvegardée en batch : ${updatedCellsCount} cellules mises à jour.`);
    } else {
      console.log(`✔ Feuilles Pointages : toutes les données sont déjà conformes.`);
    }
  }

  // ==========================================
  // 2. Feuille "Demandes_Conges"
  // ==========================================
  const requestsSheet = doc.sheetsByTitle[SheetTabs.requests];
  if (requestsSheet) {
    console.log(`\nTraitement de la feuille "${SheetTabs.requests}"...`);
    await requestsSheet.loadCells();
    const rowCount = requestsSheet.rowCount;

    let updatedCellsCount = 0;
    for (let r = 1; r < rowCount; r++) {
      const idCell = requestsSheet.getCell(r, 0);
      if (!idCell.value) continue;

      const startCell = requestsSheet.getCell(r, 3);
      const endCell = requestsSheet.getCell(r, 4);
      const daysCell = requestsSheet.getCell(r, 5);
      const createdCell = requestsSheet.getCell(r, 8);
      const updatedCell = requestsSheet.getCell(r, 9);

      const rawStart = startCell.value != null ? String(startCell.value) : '';
      const rawEnd = endCell.value != null ? String(endCell.value) : '';
      const rawDays = daysCell.value != null ? String(daysCell.value) : '';
      const rawCreated = createdCell.value != null ? String(createdCell.value) : '';
      const rawUpdated = updatedCell.value != null ? String(updatedCell.value) : '';

      const newStart = formatDateToFrench(rawStart);
      const newEnd = formatDateToFrench(rawEnd);
      const newDays = formatSheetFloat(rawDays);
      const newCreated = formatDateToFrench(rawCreated);
      const newUpdated = formatDateToFrench(rawUpdated);

      if (rawStart !== newStart) { startCell.value = newStart; updatedCellsCount++; }
      if (rawEnd !== newEnd) { endCell.value = newEnd; updatedCellsCount++; }
      if (rawDays !== newDays) { daysCell.value = newDays; updatedCellsCount++; }
      if (rawCreated !== newCreated) { createdCell.value = newCreated; updatedCellsCount++; }
      if (rawUpdated !== newUpdated) { updatedCell.value = newUpdated; updatedCellsCount++; }
    }

    if (updatedCellsCount > 0) {
      await requestsSheet.saveUpdatedCells();
      console.log(`✔ Feuilles Demandes_Conges sauvegardée en batch : ${updatedCellsCount} cellules mises à jour.`);
    } else {
      console.log(`✔ Feuilles Demandes_Conges : toutes les données sont déjà conformes.`);
    }
  }

  // ==========================================
  // 3. Feuille "Soldes_Conges"
  // ==========================================
  const balancesSheet = doc.sheetsByTitle[SheetTabs.balances];
  if (balancesSheet) {
    console.log(`\nTraitement de la feuille "${SheetTabs.balances}"...`);
    await balancesSheet.loadCells();
    const rowCount = balancesSheet.rowCount;

    let updatedCellsCount = 0;
    for (let r = 1; r < rowCount; r++) {
      const idCell = balancesSheet.getCell(r, 0);
      if (!idCell.value) continue;

      const hireCell = balancesSheet.getCell(r, 13);
      const annivCell = balancesSheet.getCell(r, 14);
      const monthlyCell = balancesSheet.getCell(r, 15);

      const rawHire = hireCell.value != null ? String(hireCell.value) : '';
      const rawAnniv = annivCell.value != null ? String(annivCell.value) : '';
      const rawMonthly = monthlyCell.value != null ? String(monthlyCell.value) : '';

      const newHire = formatDateToFrench(rawHire);
      const newAnniv = formatDateToFrench(rawAnniv);
      let newMonthly = rawMonthly;
      if (rawMonthly && rawMonthly.includes('-') && rawMonthly.split('-').length === 2) {
        newMonthly = `${rawMonthly.split('-')[1]}/${rawMonthly.split('-')[0]}`;
      }

      if (rawHire !== newHire) { hireCell.value = newHire; updatedCellsCount++; }
      if (rawAnniv !== newAnniv) { annivCell.value = newAnniv; updatedCellsCount++; }
      if (rawMonthly !== newMonthly) { monthlyCell.value = newMonthly; updatedCellsCount++; }
    }

    if (updatedCellsCount > 0) {
      await balancesSheet.saveUpdatedCells();
      console.log(`✔ Feuilles Soldes_Conges sauvegardée en batch : ${updatedCellsCount} cellules mises à jour.`);
    } else {
      console.log(`✔ Feuilles Soldes_Conges : toutes les données sont déjà conformes.`);
    }
  }

  console.log('\n--- Nettoyage et reformatage terminé avec succès pour toutes les feuilles ! ---');
}

cleanAndFormatAllSheets().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
