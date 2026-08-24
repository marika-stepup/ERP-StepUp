-- 1. Table des Clients de Production (production_clients)
CREATE TABLE IF NOT EXISTS public.production_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- ex: 'SD-000'
    name TEXT NOT NULL, -- ex: 'STEP UP'
    contract_period TEXT NOT NULL, -- ex: 'Août 2026'
    total_budget_hours NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Active RLS sur la table des clients
ALTER TABLE public.production_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on clients" 
ON public.production_clients FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow all actions for service role on clients" 
ON public.production_clients FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);


-- 2. Table des Livrables/Tâches de Production (production_tasks)
CREATE TABLE IF NOT EXISTS public.production_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.production_clients(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- ex: 'Social Media (12 Posts)', 'Rédaction Web'
    name TEXT NOT NULL, -- ex: 'Post #1 (FB/IG/LI) - Créa Visuel'
    budget_hours NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Non démarré', -- 'Non démarré', 'En cours', 'Fait'
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Active RLS sur la table des tâches
ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on tasks" 
ON public.production_tasks FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow all actions for service role on tasks" 
ON public.production_tasks FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);


-- 3. Table des Temps Passés (production_time_logs)
CREATE TABLE IF NOT EXISTS public.production_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.production_tasks(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.leave_balances(employee_id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    log_type TEXT NOT NULL DEFAULT 'production', -- 'production', 'interruption:slack', 'interruption:meeting', 'interruption:pause', 'interruption:call'
    logged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Active RLS sur la table des logs de temps
ALTER TABLE public.production_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on production_time_logs" 
ON public.production_time_logs FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow all actions for service role on production_time_logs" 
ON public.production_time_logs FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Triggers pour updated_at des clients et tâches
CREATE OR REPLACE TRIGGER update_production_clients_updated_at
BEFORE UPDATE ON public.production_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_production_tasks_updated_at
BEFORE UPDATE ON public.production_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
