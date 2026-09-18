-- ==============================================================================
-- Migration : Ajout du suivi multi-entrées/sorties à la table time_logs
-- ==============================================================================

-- 1. Ajouter la colonne entries à la table time_logs si elle n'existe pas
ALTER TABLE public.time_logs 
ADD COLUMN IF NOT EXISTS entries JSONB DEFAULT '[]'::jsonb;

-- 2. Commentaire informatif
COMMENT ON COLUMN public.time_logs.entries IS 'Historique des sessions entrées/sorties de la journée: [{"in":"08:00","out":"12:00"}, {"in":"13:00","out":null}, ...]';
