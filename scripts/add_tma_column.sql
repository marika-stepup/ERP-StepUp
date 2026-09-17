-- ==============================================================================
-- MIGRATION : AJOUT DE LA COLONNE TMA (Tierce Maintenance Applicative)
-- ==============================================================================

-- Ajoute les colonnes de TMA sur production_clients si elles n'existent pas
ALTER TABLE public.production_clients 
ADD COLUMN IF NOT EXISTS tma TEXT,
ADD COLUMN IF NOT EXISTS tma_hours NUMERIC DEFAULT 0;
