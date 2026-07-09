// Configuration mapping between application keys and French Google Sheet column headers
export const LeaveBalancesColumns = {
  employee_id: 'ID Employé',
  employee_name: 'Nom',
  employee_email: 'Email',
  initial_balance: 'Solde CP Initial',
  taken_days: 'CP Pris',
  remaining_balance: 'Solde CP Restant',
  initial_perm: 'Solde Permissions Initial',
  taken_perm: 'Permissions Prises',
  remaining_perm: 'Solde Permissions Restant',
  manager_name: 'Manager'
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
