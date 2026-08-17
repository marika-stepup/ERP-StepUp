-- Script SQL d'initialisation des tables pour l'ERP RH
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.

-- 1. Table des Soldes de Congés (leave_balances)
CREATE TABLE IF NOT EXISTS public.leave_balances (
    employee_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    employee_first_name TEXT NOT NULL,
    employee_email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'employee',
    initial_balance NUMERIC NOT NULL DEFAULT 0,
    taken_days NUMERIC NOT NULL DEFAULT 0,
    remaining_balance NUMERIC NOT NULL DEFAULT 0,
    initial_perm NUMERIC NOT NULL DEFAULT 0,
    taken_perm NUMERIC NOT NULL DEFAULT 0,
    remaining_perm NUMERIC NOT NULL DEFAULT 0,
    manager_name TEXT,
    service TEXT,
    hire_date DATE,
    last_anniversary_credited DATE,
    last_monthly_credit TEXT, -- format 'YYYY-MM'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Active RLS sur la table des soldes
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- Création des politiques RLS de base
-- Lecture autorisée pour tout utilisateur authentifié (requis pour le calendrier/dashboard)
CREATE POLICY "Allow read access to authenticated users" 
ON public.leave_balances FOR SELECT 
TO authenticated 
USING (true);

-- Écritures réservées aux comptes administrateurs/RH et au serveur Next.js via le Service Role
CREATE POLICY "Allow all actions for service role" 
ON public.leave_balances FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);


-- 2. Table des Demandes de Congés (leave_requests)
CREATE TABLE IF NOT EXISTS public.leave_requests (
    request_id UUID PRIMARY KEY,
    employee_id UUID REFERENCES public.leave_balances(employee_id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    business_days NUMERIC NOT NULL,
    leave_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'En attente',
    hr_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Active RLS sur la table des demandes
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée pour tout utilisateur authentifié
CREATE POLICY "Allow read access to authenticated users on requests" 
ON public.leave_requests FOR SELECT 
TO authenticated 
USING (true);

-- Les employés peuvent insérer leurs propres demandes
CREATE POLICY "Allow employees to insert their own requests" 
ON public.leave_requests FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = employee_id);

-- Politiques globales pour le service role du serveur Next.js
CREATE POLICY "Allow all actions for service role on requests" 
ON public.leave_requests FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);


-- 3. Déclencheurs pour la mise à jour automatique du champ updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER update_leave_balances_updated_at
BEFORE UPDATE ON public.leave_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
