-- 1. Activer l'extension pg_cron si ce n'est pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Fonction pour générer les tâches de production mensuelles basées sur les contrats des clients
CREATE OR REPLACE FUNCTION public.generate_monthly_production_tasks()
RETURNS void AS $$
DECLARE
    client_rec RECORD;
    month_num INTEGER;
    year_val INTEGER;
    month_lower TEXT;
    month_upper TEXT;
    end_of_month DATE;
    existing_count INTEGER;
    task_name TEXT;
    i INTEGER;
BEGIN
    -- Obtenir le mois et l'année courants
    month_num := EXTRACT(month FROM current_date);
    year_val := EXTRACT(year FROM current_date);
    end_of_month := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;

    -- Traduction des mois en français (minuscule et MAJUSCULE)
    CASE month_num
        WHEN 1 THEN month_lower := 'janvier'; month_upper := 'JANVIER';
        WHEN 2 THEN month_lower := 'février'; month_upper := 'FÉVRIER';
        WHEN 3 THEN month_lower := 'mars'; month_upper := 'MARS';
        WHEN 4 THEN month_lower := 'avril'; month_upper := 'AVRIL';
        WHEN 5 THEN month_lower := 'mai'; month_upper := 'MAI';
        WHEN 6 THEN month_lower := 'juin'; month_upper := 'JUIN';
        WHEN 7 THEN month_lower := 'juillet'; month_upper := 'JUILLET';
        WHEN 8 THEN month_lower := 'août'; month_upper := 'AOÛT';
        WHEN 9 THEN month_lower := 'septembre'; month_upper := 'SEPTEMBRE';
        WHEN 10 THEN month_lower := 'octobre'; month_upper := 'OCTOBRE';
        WHEN 11 THEN month_lower := 'novembre'; month_upper := 'NOVEMBRE';
        WHEN 12 THEN month_lower := 'décembre'; month_upper := 'DÉCEMBRE';
    END CASE;

    -- Parcourir tous les clients actifs
    FOR client_rec IN 
        SELECT * FROM public.production_clients
        WHERE current_date >= COALESCE(start_date, '1970-01-01'::date)
          AND current_date <= COALESCE(end_date, '2099-12-31'::date)
    LOOP
        RAISE NOTICE 'Génération des tâches pour le client % (%)', client_rec.name, client_rec.code;

        -- A. FACEBOOK POSTS (Budget: 0.5h par post)
        IF client_rec.posts_facebook > 0 THEN
            SELECT count(*) INTO existing_count FROM public.production_tasks
            WHERE client_id = client_rec.id AND category = 'Facebook ' || month_upper;

            IF existing_count < client_rec.posts_facebook THEN
                FOR i IN (existing_count + 1) .. client_rec.posts_facebook LOOP
                    INSERT INTO public.production_tasks (client_id, category, name, budget_hours, status, due_date)
                    VALUES (
                        client_rec.id, 
                        'Facebook ' || month_upper, 
                        'Post Facebook #' || i || ' - ' || month_lower || ' ' || year_val, 
                        0.5, 
                        'Non démarré', 
                        end_of_month
                    );
                END LOOP;
            END IF;
        END IF;

        -- B. INSTAGRAM POSTS (Budget: 0.5h par post)
        IF client_rec.posts_instagram > 0 THEN
            SELECT count(*) INTO existing_count FROM public.production_tasks
            WHERE client_id = client_rec.id AND category = 'Instagram ' || month_upper;

            IF existing_count < client_rec.posts_instagram THEN
                FOR i IN (existing_count + 1) .. client_rec.posts_instagram LOOP
                    INSERT INTO public.production_tasks (client_id, category, name, budget_hours, status, due_date)
                    VALUES (
                        client_rec.id, 
                        'Instagram ' || month_upper, 
                        'Post Instagram #' || i || ' - ' || month_lower || ' ' || year_val, 
                        0.5, 
                        'Non démarré', 
                        end_of_month
                    );
                END LOOP;
            END IF;
        END IF;

        -- C. LINKEDIN POSTS (Budget: 0.5h par post)
        IF client_rec.posts_linkedin > 0 THEN
            SELECT count(*) INTO existing_count FROM public.production_tasks
            WHERE client_id = client_rec.id AND category = 'LinkedIn ' || month_upper;

            IF existing_count < client_rec.posts_linkedin THEN
                FOR i IN (existing_count + 1) .. client_rec.posts_linkedin LOOP
                    INSERT INTO public.production_tasks (client_id, category, name, budget_hours, status, due_date)
                    VALUES (
                        client_rec.id, 
                        'LinkedIn ' || month_upper, 
                        'Post LinkedIn #' || i || ' - ' || month_lower || ' ' || year_val, 
                        0.5, 
                        'Non démarré', 
                        end_of_month
                    );
                END LOOP;
            END IF;
        END IF;

        -- D. GOOGLE POSTS (Budget: 0.5h par post)
        IF client_rec.posts_google > 0 THEN
            SELECT count(*) INTO existing_count FROM public.production_tasks
            WHERE client_id = client_rec.id AND category = 'Google ' || month_upper;

            IF existing_count < client_rec.posts_google THEN
                FOR i IN (existing_count + 1) .. client_rec.posts_google LOOP
                    INSERT INTO public.production_tasks (client_id, category, name, budget_hours, status, due_date)
                    VALUES (
                        client_rec.id, 
                        'Google ' || month_upper, 
                        'Post Google #' || i || ' - ' || month_lower || ' ' || year_val, 
                        0.5, 
                        'Non démarré', 
                        end_of_month
                    );
                END LOOP;
            END IF;
        END IF;

        -- E. NEWSLETTERS (Budget: 2.0h par newsletter)
        IF client_rec.newsletter_count > 0 THEN
            SELECT count(*) INTO existing_count FROM public.production_tasks
            WHERE client_id = client_rec.id AND category = 'Newsletter ' || month_upper;

            IF existing_count < client_rec.newsletter_count THEN
                FOR i IN (existing_count + 1) .. client_rec.newsletter_count LOOP
                    INSERT INTO public.production_tasks (client_id, category, name, budget_hours, status, due_date)
                    VALUES (
                        client_rec.id, 
                        'Newsletter ' || month_upper, 
                        'Newsletter #' || i || ' - ' || month_lower || ' ' || year_val, 
                        2.0, 
                        'Non démarré', 
                        end_of_month
                    );
                END LOOP;
            END IF;
        END IF;

        -- F. BILLETS DE BLOG (Budget: 4.0h par article)
        IF client_rec.blog_count > 0 THEN
            SELECT count(*) INTO existing_count FROM public.production_tasks
            WHERE client_id = client_rec.id AND category = 'BB ' || month_upper;

            IF existing_count < client_rec.blog_count THEN
                FOR i IN (existing_count + 1) .. client_rec.blog_count LOOP
                    -- Choix du nom (ex: 'Article août' pour 1 seul, ou 'Article août #1' pour plusieurs)
                    task_name := 'Article ' || month_lower;
                    IF client_rec.blog_count > 1 THEN
                        task_name := task_name || ' #' || i;
                    END IF;

                    INSERT INTO public.production_tasks (client_id, category, name, budget_hours, status, due_date)
                    VALUES (
                        client_rec.id, 
                        'BB ' || month_upper, 
                        task_name, 
                        4.0, 
                        'Non démarré', 
                        (date_trunc('month', current_date) + interval '1 month - 1 day')::date -- sensible default
                    );
                END LOOP;
            END IF;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Programmation de la tâche récurrente avec pg_cron (le 1er de chaque mois à 00:05 UTC)
SELECT cron.schedule(
    'generate-monthly-production-tasks',
    '5 0 1 * *',
    'SELECT public.generate_monthly_production_tasks();'
);
