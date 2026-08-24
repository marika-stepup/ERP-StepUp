import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../../lib/supabaseAuth';
import { deleteProductionTimeLogFromSheets } from '../../../../../lib/productionSheetsSync';

async function checkDirectionService(authResult) {
  if (authResult.error) return { error: authResult.error };
  
  const supabase = getSupabaseAdmin();
  const { data: memberProfile, error } = await supabase
    .from('leave_balances')
    .select('service')
    .eq('employee_id', authResult.user.id)
    .maybeSingle();

  if (error || !memberProfile || (memberProfile.service !== 'Direction' && memberProfile.service !== 'Directeur')) {
    return { error: { status: 403, message: 'Accès interdit. Réservé au service Direction.' } };
  }
  
  return { user: authResult.user, profile: memberProfile };
}

export async function DELETE(req, { params }) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  const serviceCheck = await checkDirectionService(auth);
  if (serviceCheck.error) {
    return NextResponse.json({ error: serviceCheck.error.message }, { status: serviceCheck.error.status });
  }

  const { id } = params;

  try {
    const supabase = getSupabaseAdmin();

    // Fetch log details before deleting to get task_id
    const { data: log } = await supabase
      .from('production_time_logs')
      .select('task_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('production_time_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Async delete from Google Sheets
    if (log) {
      deleteProductionTimeLogFromSheets(id, log.task_id);
    } else {
      deleteProductionTimeLogFromSheets(id);
    }

    return NextResponse.json({ message: 'Log de temps supprimé avec succès.' });
  } catch (error) {
    console.error('Error deleting production time log:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression du log de temps.' },
      { status: 500 }
    );
  }
}
