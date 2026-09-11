-- =========================================================================
-- Script SQL : Suppression de la génération automatique par CRON
-- pour l'espace production et l'espace manager
-- =========================================================================

-- 1. Désactiver et désinscrire la tâche pg_cron si elle existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('generate-monthly-production-tasks');
        RAISE NOTICE 'Job cron "generate-monthly-production-tasks" désactivé avec succès.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unschedule ignoré ou non présent : %', SQLERRM;
END $$;

-- 2. Supprimer la fonction SQL associée
DROP FUNCTION IF EXISTS public.generate_monthly_production_tasks();

-- 3. Nettoyer les éventuelles entrées cron restantes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'cron' AND table_name = 'job') THEN
        DELETE FROM cron.job WHERE jobname = 'generate-monthly-production-tasks';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Nettoyage de cron.job ignoré : %', SQLERRM;
END $$;
