-- 1. Ajouter la colonne work_schedule à la table leave_balances si elle n'existe pas
ALTER TABLE public.leave_balances 
ADD COLUMN IF NOT EXISTS work_schedule JSONB DEFAULT NULL;

-- 2. Créer la table des pointages (time_logs)
CREATE TABLE IF NOT EXISTS public.time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.leave_balances(employee_id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    date DATE NOT NULL,
    clock_in TIME,
    clock_out TIME,
    scheduled_clock_in TIME,
    scheduled_clock_out TIME,
    status TEXT, -- 'Présent', 'En retard', 'Départ anticipé', 'Absent'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(employee_id, date)
);

-- Active RLS sur la table des pointages
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- Politiques RLS de base
CREATE POLICY "Allow read access to authenticated users on time_logs" 
ON public.time_logs FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow all actions for service role on time_logs" 
ON public.time_logs FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Trigger pour updated_at de la table time_logs
CREATE OR REPLACE TRIGGER update_time_logs_updated_at
BEFORE UPDATE ON public.time_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
