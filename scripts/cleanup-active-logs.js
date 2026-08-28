import pkg from '@next/env';
const { loadEnvConfig } = pkg;
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log("Recherche des enregistrements de temps actifs non fermés...");
  
  const { data: logs, error: errFetch } = await supabaseAdmin
    .from('production_time_logs')
    .select('id, task_id, created_at, log_type')
    .is('end_time', null);

  if (errFetch) {
    console.error("Erreur lors de la récupération :", errFetch);
    process.exit(1);
  }

  console.log(`${logs.length} log(s) actif(s) trouvé(s).`);

  for (const log of logs) {
    console.log(`Fermeture du log ${log.id} pour la tâche ${log.task_id} (Type: ${log.log_type})...`);
    
    const { error: errUpdate } = await supabaseAdmin
      .from('production_time_logs')
      .update({
        end_time: log.created_at,
        duration_seconds: 0
      })
      .eq('id', log.id);

    if (errUpdate) {
      console.error(`Erreur lors de la mise à jour du log ${log.id} :`, errUpdate);
    } else {
      console.log(`Log ${log.id} fermé avec succès.`);
    }
  }

  console.log("Nettoyage terminé !");
  process.exit(0);
}

main();
