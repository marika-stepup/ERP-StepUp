import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { generateUUID } from '../../../../lib/utils';
import { LeaveBalancesColumns } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr'
  const auth = await verifyRole(req, ['hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { email, name, role, manager_name, initial_balance, initial_perm } = body;

    // Validation
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name.' },
        { status: 400 }
      );
    }

    const initialCP = parseFloat(initial_balance || 0);
    const initialPermissions = parseFloat(initial_perm || 0);

    // Use mutex to prevent duplicates during creation
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet('Leave_Balances');
      const rows = await balancesSheet.getRows();

      // Check if email already exists
      const exists = rows.some(
        (row) => row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === email.toLowerCase()
      );

      if (exists) {
        return {
          error: `A member with email "${email}" already exists in the system.`,
          status: 400
        };
      }

      // Add new member row using French columns mapping
      const employeeId = generateUUID();
      await balancesSheet.addRow({
        [LeaveBalancesColumns.employee_id]: employeeId,
        [LeaveBalancesColumns.employee_name]: name,
        [LeaveBalancesColumns.employee_email]: email.toLowerCase(),
        [LeaveBalancesColumns.role]: role || 'employee',
        [LeaveBalancesColumns.initial_balance]: initialCP.toString(),
        [LeaveBalancesColumns.taken_days]: '0.0',
        [LeaveBalancesColumns.remaining_balance]: initialCP.toString(),
        [LeaveBalancesColumns.initial_perm]: initialPermissions.toString(),
        [LeaveBalancesColumns.taken_perm]: '0.0',
        [LeaveBalancesColumns.remaining_perm]: initialPermissions.toString(),
        [LeaveBalancesColumns.manager_name]: manager_name || 'Aucun'
      });

      return {
        success: true,
        data: {
          employee_id: employeeId,
          employee_name: name,
          employee_email: email,
          role: role || 'employee',
          manager_name: manager_name || 'Aucun',
          initial_balance: initialCP,
          initial_perm: initialPermissions
        }
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'New member created successfully.',
      member: result.data
    });

  } catch (error) {
    console.error('Error creating new member:', error);
    return NextResponse.json(
      { error: 'Internal server error while creating new member.' },
      { status: 500 }
    );
  }
}
