// Centralized Sheet Names (French)
export const SheetTabs = {
  balances: 'Soldes_Conges',
  requests: 'Demandes_Conges',
  timeLogs: 'Pointages'
};

// Configuration mapping between application keys and French Google Sheet column headers
export const LeaveBalancesColumns = {
  employee_id: 'ID Employé',
  employee_name: 'Nom',
  employee_email: 'Email',
  role: 'Rôle',
  initial_balance: 'Solde CP Initial',
  taken_days: 'CP Pris',
  remaining_balance: 'Solde CP Restant',
  initial_perm: 'Solde Permissions Initial',
  taken_perm: 'Permissions Prises',
  remaining_perm: 'Solde Permissions Restant',
  manager_name: 'Manager',
  service: 'Service',
  hire_date: 'Date d\'embauche',
  last_anniversary_credited: 'Dernier Anniversaire Crédité'
};

export const LeaveRequestsColumns = {
  request_id: 'ID Demande',
  employee_id: 'ID Employé',
  employee_name: 'Nom',
  start_date: 'Date Début',
  end_date: 'Date Fin',
  business_days: 'Jours Ouvrés',
  leave_type: 'Type Congé',
  status: 'Statut',
  created_at: 'Date Création',
  updated_at: 'Date Mise à jour',
  hr_comment: 'Commentaire RH'
};

export const TimeLogsColumns = {
  log_id: 'ID Pointage',
  employee_id: 'ID Employé',
  date: 'Date',
  clock_in: 'Heure Arrivée',
  clock_out: 'Heure Départ',
  break_duration: 'Durée Pause',
  total_hours: 'Heures Totales',
  status: 'Statut',
  created_at: 'Date Création'
};

/**
 * Parses a decimal number from Google Sheets, supporting both French comma (,) and English dot (.) decimal separators.
 */
export function parseSheetFloat(value) {
  if (value === undefined || value === null || value === '') return 0;
  const normalized = value.toString().replace(',', '.');
  return parseFloat(normalized) || 0;
}

/**
 * Formats a JavaScript float into a Google Sheets friendly French string with a comma (,) decimal separator.
 */
export function formatSheetFloat(value) {
  if (value === undefined || value === null) return '0';
  const floatVal = typeof value === 'number' ? value : parseFloat(value.toString().replace(',', '.'));
  return (floatVal || 0).toString().replace('.', ',');
}

/**
 * Formats a float or string to French locale for display in the UI.
 */
export function formatLocaleFloat(value) {
  const parsed = typeof value === 'number' ? value : parseFloat(value?.toString().replace(',', '.') || 0);
  return parsed.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Formats a YYYY-MM-DD date string into French DD/MM/YYYY format for Google Sheets.
 */
export function formatDateToFrench(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Parses a French DD/MM/YYYY date string from Google Sheets back into YYYY-MM-DD format for HTML inputs / JS parsing.
 */
export function parseDateFromFrench(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}
