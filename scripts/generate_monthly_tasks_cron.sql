-- =========================================================================
-- OBSOLÈTE : La création automatique par cron a été supprimée.
-- Les tâches sont désormais gérées manuellement ou directement via les
-- 5 catégories de livrables unifiées (Rédaction, Créa graphique, Réunion, Data, Tech).
-- =========================================================================

-- Pour désactiver toute programmation cron existante, exécutez scripts/remove_production_cron.sql :
-- SELECT cron.unschedule('generate-monthly-production-tasks');
-- DROP FUNCTION IF EXISTS public.generate_monthly_production_tasks();
