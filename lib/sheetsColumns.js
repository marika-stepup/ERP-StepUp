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
  employee_first_name: 'Prénom',
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
  last_anniversary_credited: 'Dernier Anniversaire Crédité',
  last_monthly_credit: 'Dernier Crédit Mensuel'
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
  const normalized = value.toString().replace(',', '.').trim();
  return parseFloat(normalized) || 0;
}

/**
 * Formats a JavaScript float into a Google Sheets friendly French string with a comma (,) decimal separator.
 */
export function formatSheetFloat(value, decimals = null) {
  if (value === undefined || value === null || value === '') return '0';
  const floatVal = typeof value === 'number' ? value : parseFloat(value.toString().replace(',', '.'));
  if (isNaN(floatVal)) return '0';
  if (decimals !== null) {
    return Number(floatVal.toFixed(decimals)).toString().replace('.', ',');
  }
  return floatVal.toString().replace('.', ',');
}

/**
 * Parses break duration string (e.g. "0h 19m", "1h 30m", "45m") or float and converts to decimal hours with French comma (e.g. "0,32").
 * Immediately usable for calculations (=SOMME, etc.) in French Google Sheets.
 */
export function formatBreakDurationToDecimalHours(breakDuration) {
  if (!breakDuration || breakDuration === '0h 00m' || breakDuration === '0') return '0';
  
  if (typeof breakDuration === 'number') {
    return Number(breakDuration.toFixed(2)).toString().replace('.', ',');
  }

  const str = breakDuration.toString().trim();
  // Check if string is already a numeric float (like "0,32" or "0.32")
  if (/^-?\d+([.,]\d+)?$/.test(str)) {
    const parsed = parseFloat(str.replace(',', '.'));
    return isNaN(parsed) ? '0' : Number(parsed.toFixed(2)).toString().replace('.', ',');
  }

  // Parse "Xh YYm" or "YYm" or "Xh"
  let totalMinutes = 0;
  const matchHoursMins = str.match(/(\d+)\s*h(?:our|ours)?(?:\s*(\d+)\s*m(?:in|ins)?)?/i);
  if (matchHoursMins) {
    const h = parseInt(matchHoursMins[1], 10) || 0;
    const m = parseInt(matchHoursMins[2], 10) || 0;
    totalMinutes = h * 60 + m;
  } else {
    const matchMinsOnly = str.match(/(\d+)\s*m(?:in|ins)?/i);
    if (matchMinsOnly) {
      totalMinutes = parseInt(matchMinsOnly[1], 10) || 0;
    }
  }

  if (totalMinutes === 0) return '0';
  const decimalHours = Number((totalMinutes / 60).toFixed(2));
  return decimalHours.toString().replace('.', ',');
}

function parseTimeMinutes(timeVal) {
  if (timeVal === undefined || timeVal === null || timeVal === '') return null;
  if (typeof timeVal === 'number') {
    return Math.round(timeVal * 24 * 60);
  }
  const str = String(timeVal).trim();
  if (str.includes(':')) {
    const parts = str.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  }
  const num = parseFloat(str.replace(',', '.'));
  if (!isNaN(num) && num >= 0 && num <= 1) {
    return Math.round(num * 24 * 60);
  }
  return null;
}

/**
 * Calculates total hours worked as a decimal number (e.g. 7.75 -> "7,75") by subtracting break minutes from (clockOut - clockIn).
 */
export function calculateTotalHoursWorkedDecimal(clockIn, clockOut, breakDuration) {
  if (!clockIn || !clockOut) return '';

  const inMins = parseTimeMinutes(clockIn);
  const outMins = parseTimeMinutes(clockOut);

  if (inMins === null || outMins === null) return '';

  let diffMinutes = outMins - inMins;

  // Parse break minutes
  let breakMinutes = 0;
  if (breakDuration) {
    if (typeof breakDuration === 'number') {
      breakMinutes = Math.round(breakDuration * 60);
    } else {
      const str = breakDuration.toString().trim();
      const matchHM = str.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i);
      if (matchHM) {
        breakMinutes = (parseInt(matchHM[1], 10) || 0) * 60 + (parseInt(matchHM[2], 10) || 0);
      } else if (/^-?\d+([.,]\d+)?$/.test(str)) {
        // It's decimal hours
        breakMinutes = Math.round(parseFloat(str.replace(',', '.')) * 60);
      }
    }
  }

  diffMinutes = Math.max(0, diffMinutes - breakMinutes);
  const decimalHours = Number((diffMinutes / 60).toFixed(2));
  return decimalHours.toString().replace('.', ',');
}

/**
 * Formats a float or string to French locale for display in the UI.
 */
export function formatLocaleFloat(value) {
  const parsed = typeof value === 'number' ? value : parseFloat(value?.toString().replace(',', '.') || 0);
  return parsed.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Formats a YYYY-MM-DD or ISO date string into French DD/MM/YYYY format for Google Sheets.
 */
export function formatDateToFrench(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.toString().trim();
  // If ISO string like "2026-08-20T05:04:51.965Z"
  const datePart = clean.includes('T') ? clean.split('T')[0] : clean;
  const parts = datePart.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

/**
 * Formats an ISO datetime string to French DD/MM/YYYY HH:MM for Google Sheets.
 */
export function formatDateTimeToFrench(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return formatDateToFrench(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return formatDateToFrench(isoStr);
  }
}

/**
 * Parses a French DD/MM/YYYY date string from Google Sheets back into YYYY-MM-DD format for HTML inputs / JS parsing.
 */
export function parseDateFromFrench(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.toString().trim();
  const datePart = clean.includes(' ') ? clean.split(' ')[0] : clean;
  const parts = datePart.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return clean;
}
