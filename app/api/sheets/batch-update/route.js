import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getDoc, getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs, parseSheetFloat, formatSheetFloat } from '../../../../lib/sheetsColumns';

// Helper to convert column index (0-based) to Excel-like column letter (A, B, C...)
function getColumnLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { mutations } = body;

    if (!mutations || !Array.isArray(mutations) || mutations.length === 0) {
      return NextResponse.json(
        { error: 'Aucune mutation fournie.' },
        { status: 400 }
      );
    }

    // Process mutations inside mutex lock to prevent concurrent write race conditions
    const result = await runWithMutex(async () => {
      // Load Google Spreadsheet document
      const doc = await getDoc();
      const balancesSheet = doc.sheetsByTitle[SheetTabs.balances];
      if (!balancesSheet) {
        return { error: `La feuille "${SheetTabs.balances}" est introuvable.`, status: 404 };
      }

      // Load header values and rows to locate coordinates
      await balancesSheet.loadHeaderRow();
      const headers = balancesSheet.headerValues || [];
      const rows = await balancesSheet.getRows();

      // Find column indices
      const colIndices = {
        employeeId: headers.indexOf(LeaveBalancesColumns.employee_id),
        employeeEmail: headers.indexOf(LeaveBalancesColumns.employee_email),
        initialCP: headers.indexOf(LeaveBalancesColumns.initial_balance),
        takenCP: headers.indexOf(LeaveBalancesColumns.taken_days),
        remainingCP: headers.indexOf(LeaveBalancesColumns.remaining_balance),
        initialPerm: headers.indexOf(LeaveBalancesColumns.initial_perm),
        takenPerm: headers.indexOf(LeaveBalancesColumns.taken_perm),
        remainingPerm: headers.indexOf(LeaveBalancesColumns.remaining_perm),
      };

      // Check if critical columns exist
      if (colIndices.employeeId === -1 || colIndices.employeeEmail === -1) {
        return { error: 'Colonnes critiques manquantes dans la feuille de calcul.', status: 500 };
      }

      const valueRanges = [];
      const updatedMembers = [];

      for (const mutation of mutations) {
        const { type, employeeId, field, value } = mutation;

        if (type !== 'adjust-balance') {
          continue; // Currently, we only support adjust-balance in batch
        }

        const normalizedField = field.toLowerCase();
        if (normalizedField !== 'cp' && normalizedField !== 'perm') {
          continue;
        }

        const numericValue = parseFloat(value);
        if (isNaN(numericValue) || numericValue < 0) {
          continue;
        }

        // Find the employee row
        const balanceRow = rows.find(
          (row) => row.get(LeaveBalancesColumns.employee_id) === employeeId || 
                   row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === employeeId.toLowerCase()
        );

        if (!balanceRow) {
          console.warn(`[BatchUpdate] Employé ${employeeId} introuvable dans le tableau.`);
          continue;
        }

        const rowNumber = balanceRow.rowNumber; // 1-based row index in Sheet

        if (normalizedField === 'cp') {
          if (colIndices.initialCP === -1 || colIndices.remainingCP === -1 || colIndices.takenCP === -1) {
            continue;
          }

          const currentTaken = parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_days));
          const newRemaining = numericValue - currentTaken;

          // Push cell updates to the batch payload
          const initialColLetter = getColumnLetter(colIndices.initialCP);
          const remainingColLetter = getColumnLetter(colIndices.remainingCP);

          valueRanges.push({
            range: `'${SheetTabs.balances}'!${initialColLetter}${rowNumber}`,
            values: [[formatSheetFloat(numericValue)]]
          });
          valueRanges.push({
            range: `'${SheetTabs.balances}'!${remainingColLetter}${rowNumber}`,
            values: [[formatSheetFloat(newRemaining)]]
          });

          updatedMembers.push({
            employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
            employee_name: balanceRow.get(LeaveBalancesColumns.employee_name) || '',
            employee_first_name: balanceRow.get(LeaveBalancesColumns.employee_first_name) || '',
            type: 'cp',
            initial_balance: numericValue,
            remaining_balance: newRemaining
          });
        } else if (normalizedField === 'perm') {
          if (colIndices.initialPerm === -1 || colIndices.remainingPerm === -1 || colIndices.takenPerm === -1) {
            continue;
          }

          const currentTaken = parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_perm));
          const newRemaining = numericValue - currentTaken;

          // Push cell updates to the batch payload
          const initialColLetter = getColumnLetter(colIndices.initialPerm);
          const remainingColLetter = getColumnLetter(colIndices.remainingPerm);

          valueRanges.push({
            range: `'${SheetTabs.balances}'!${initialColLetter}${rowNumber}`,
            values: [[formatSheetFloat(numericValue)]]
          });
          valueRanges.push({
            range: `'${SheetTabs.balances}'!${remainingColLetter}${rowNumber}`,
            values: [[formatSheetFloat(newRemaining)]]
          });

          updatedMembers.push({
            employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
            employee_name: balanceRow.get(LeaveBalancesColumns.employee_name) || '',
            employee_first_name: balanceRow.get(LeaveBalancesColumns.employee_first_name) || '',
            type: 'perm',
            initial_perm: numericValue,
            remaining_perm: newRemaining
          });
        }
      }

      if (valueRanges.length === 0) {
        return { message: 'Aucune mutation valide à appliquer.' };
      }

      // Execute exactly one HTTP POST request to Google Sheets batchUpdate values API
      const authClient = doc.authClient;
      const credentials = await authClient.authorize();
      const accessToken = credentials.access_token;
      const spreadsheetId = doc.spreadsheetId;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: valueRanges
          })
        }
      );

      if (!response.ok) {
        const errDetails = await response.text();
        throw new Error(`Google Sheets API batchUpdate failed: ${response.status} - ${errDetails}`);
      }

      return { success: true, updatedMembers };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Mises à jour appliquées en lot avec succès.',
      updatedMembers: result.updatedMembers
    });

  } catch (error) {
    console.error('Error in batch-update route:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la mise à jour en lot.' },
      { status: 500 }
    );
  }
}
