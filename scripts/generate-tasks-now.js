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

const DEFAULT_CATEGORIES = [
  { name: 'Rédaction', budget_hours: 0 },
  { name: 'Créa graphique', budget_hours: 0 },
  { name: 'Réunion', budget_hours: 0 },
  { name: 'Data', budget_hours: 0 },
  { name: 'Tech', budget_hours: 0 }
];

async function main() {
  const now = new Date();
  const yearVal = now.getFullYear();
  const monthNum = now.getMonth() + 1;
  const lastDay = new Date(yearVal, monthNum, 0);
  const endOfMonthStr = lastDay.toISOString().split('T')[0];
  const currentDateStr = now.toISOString().split('T')[0];

  console.log(`Initialisation des 5 livrables standards pour les clients actifs...`);

  const { data: clients, error: errC } = await supabaseAdmin
    .from('production_clients')
    .select('*');

  if (errC) {
    console.error('Erreur de récupération des clients:', errC);
    return;
  }

  const activeClients = clients.filter(c => {
    const start = c.start_date || '1970-01-01';
    const end = c.end_date || '2099-12-31';
    return currentDateStr >= start && currentDateStr <= end;
  });

  console.log(`Nombre de clients actifs trouvés : ${activeClients.length}`);

  for (const client of activeClients) {
    console.log(`\nTraitement du client : ${client.name} (${client.code})`);

    const { data: existingTasks, error: errT } = await supabaseAdmin
      .from('production_tasks')
      .select('*')
      .eq('client_id', client.id);

    if (errT) {
      console.error(`Erreur pour ${client.name}:`, errT);
      continue;
    }

    const tasksToInsert = [];

    for (const cat of DEFAULT_CATEGORIES) {
      const exists = existingTasks.some(t => t.category === cat.name || t.name === cat.name);
      if (!exists) {
        tasksToInsert.push({
          client_id: client.id,
          category: cat.name,
          name: cat.name,
          budget_hours: cat.budget_hours,
          status: 'Non démarré',
          due_date: endOfMonthStr
        });
      }
    }

    if (tasksToInsert.length > 0) {
      const { data: inserted, error: errI } = await supabaseAdmin
        .from('production_tasks')
        .insert(tasksToInsert)
        .select();

      if (errI) {
        console.error(`  ❌ Erreur lors de l'insertion des tâches :`, errI);
      } else {
        console.log(`  ✔️ ${inserted.length} catégories de livrables créées pour ${client.name}.`);
      }
    } else {
      console.log(`  Toutes les catégories sont déjà en place.`);
    }
  }

  console.log('\nTerminé.');
}

main().catch(console.error);
