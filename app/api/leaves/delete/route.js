import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveRequestsColumns, SheetTabs } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const employee = auth.user;

  try {
    const body = await req.json();
    const { request_id } = body;

    if (!request_id) {
      return NextResponse.json({ error: 'Identifiant de demande manquant.' }, { status: 400 });
    }

    const result = await runWithMutex(async () => {
      const requestsSheet = await getSheet(SheetTabs.requests);
      const rows = await requestsSheet.getRows();
      const targetRow = rows.find(row => row.get(LeaveRequestsColumns.request_id) === request_id);

      if (!targetRow) {
        return { error: 'Demande introuvable.', status: 404 };
      }

      // Check ownership
      if (targetRow.get(LeaveRequestsColumns.employee_id) !== employee.id) {
        return { error: 'Non autorisé à supprimer cette demande.', status: 403 };
      }

      // Check status
      if (targetRow.get(LeaveRequestsColumns.status) !== 'En attente') {
        return { error: 'Seules les demandes en attente peuvent être supprimées.', status: 400 };
      }

      // Delete row
      await targetRow.delete();
      return { success: true };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ message: 'Demande supprimée avec succès.' });

  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression.' },
      { status: 500 }
    );
  }
}
