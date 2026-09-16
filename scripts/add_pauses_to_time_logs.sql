-- ==============================================================================
-- Migration : Ajout de la gestion des pauses (déjeuner / goûter) à time_logs
-- ==============================================================================

-- 1. Ajouter les colonnes de suivi des pauses à la table time_logs
ALTER TABLE public.time_logs 
ADD COLUMN IF NOT EXISTS break_start TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS break_end TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS break_duration TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS breaks JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_on_break BOOLEAN DEFAULT false;

-- 2. Commentaires informatifs sur les colonnes
COMMENT ON COLUMN public.time_logs.break_start IS 'Heure de début de la pause active ou de la dernière pause';
COMMENT ON COLUMN public.time_logs.break_end IS 'Heure de fin de la dernière pause terminée';
COMMENT ON COLUMN public.time_logs.break_duration IS 'Durée totale cumulée des pauses dans la journée (ex: 0h 45m)';
COMMENT ON COLUMN public.time_logs.breaks IS 'Historique détaillé des pauses de la journée: [{"start":"12:00","end":"13:00"}, ...]';
COMMENT ON COLUMN public.time_logs.is_on_break IS 'Indicateur booléen : true si le collaborateur est actuellement en pause';
