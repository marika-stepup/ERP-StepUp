-- ==============================================================================
-- MIGRATION : ASSIGNATION DE COLLABORATEUR & TÂCHES RÉCURRENTES
-- ==============================================================================

-- 1. Ajout des colonnes d'assignation et de récurrence sur production_tasks
ALTER TABLE public.production_tasks 
ADD COLUMN IF NOT EXISTS assigned_to UUID,
ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_frequency TEXT DEFAULT 'monthly';

-- 2. Index pour accélérer les requêtes filtrées par collaborateur
CREATE INDEX IF NOT EXISTS idx_production_tasks_assigned_to ON public.production_tasks(assigned_to);
