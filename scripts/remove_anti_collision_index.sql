-- Suppression de l'index unique anti-collision pour permettre à plusieurs collaborateurs
-- de travailler simultanément sur la même tâche / même carte de livrable
DROP INDEX IF EXISTS one_active_timer_per_task;
