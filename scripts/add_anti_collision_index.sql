-- 1. Index Unique Partiel pour empêcher les chronos actifs en doublon sur la même tâche
CREATE UNIQUE INDEX IF NOT EXISTS one_active_timer_per_task 
ON production_time_logs (task_id) 
WHERE (end_time IS NULL);

-- 2. Activation de Supabase Realtime pour diffuser les modifications de la table production_time_logs
ALTER PUBLICATION supabase_realtime ADD TABLE production_time_logs;
