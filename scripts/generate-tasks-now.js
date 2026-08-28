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
  const now = new Date();
  const monthNum = now.getMonth() + 1;
  const yearVal = now.getFullYear();
  
  // Calculate end of month date in YYYY-MM-DD format
  const lastDay = new Date(yearVal, monthNum, 0);
  const endOfMonthStr = lastDay.toISOString().split('T')[0];

  // Traduction des mois en français
  let monthLower = '';
  let monthUpper = '';
  switch (monthNum) {
    case 1: monthLower = 'janvier'; monthUpper = 'JANVIER'; break;
    case 2: monthLower = 'février'; monthUpper = 'FÉVRIER'; break;
    case 3: monthLower = 'mars'; monthUpper = 'MARS'; break;
    case 4: monthLower = 'avril'; monthUpper = 'AVRIL'; break;
    case 5: monthLower = 'mai'; monthUpper = 'MAI'; break;
    case 6: monthLower = 'juin'; monthUpper = 'JUIN'; break;
    case 7: monthLower = 'juillet'; monthUpper = 'JUILLET'; break;
    case 8: monthLower = 'août'; monthUpper = 'AOÛT'; break;
    case 9: monthLower = 'septembre'; monthUpper = 'SEPTEMBRE'; break;
    case 10: monthLower = 'octobre'; monthUpper = 'OCTOBRE'; break;
    case 11: monthLower = 'novembre'; monthUpper = 'NOVEMBRE'; break;
    case 12: monthLower = 'décembre'; monthUpper = 'DÉCEMBRE'; break;
  }

  const currentDateStr = now.toISOString().split('T')[0];

  console.log(`Période ciblée : ${monthUpper} ${yearVal}`);

  // Fetch active clients
  const { data: clients, error: errC } = await supabaseAdmin
    .from('production_clients')
    .select('*');

  if (errC) {
    console.error('Erreur de récupération des clients:', errC);
    return;
  }

  // Filter active clients (checking current date is within start_date/end_date)
  const activeClients = clients.filter(c => {
    const start = c.start_date || '1970-01-01';
    const end = c.end_date || '2099-12-31';
    return currentDateStr >= start && currentDateStr <= end;
  });

  console.log(`Nombre de clients actifs trouvés : ${activeClients.length}`);

  for (const client of activeClients) {
    console.log(`\nTraitement du client : ${client.name} (${client.code})`);

    // Fetch existing tasks for this client and month
    const { data: existingTasks, error: errT } = await supabaseAdmin
      .from('production_tasks')
      .select('*')
      .eq('client_id', client.id);

    if (errT) {
      console.error(`Erreur de récupération des tâches pour ${client.name}:`, errT);
      continue;
    }

    const tasksToInsert = [];

    // Helper to generate missing tasks for a deliverable type
    const generateDeliverable = (count, categoryName, namePattern, budget, existingCategoryPattern) => {
      if (count <= 0) return;

      const existingInCat = existingTasks.filter(t => t.category === categoryName);
      const existingCount = existingInCat.length;

      if (existingCount < count) {
        console.log(`  - ${categoryName} : ${existingCount} existants, contrat exige ${count}. Génération de ${count - existingCount} tâches...`);
        for (let i = existingCount + 1; i <= count; i++) {
          let taskName = '';
          if (namePattern.includes('#i')) {
            taskName = namePattern.replace('#i', i);
          } else {
            taskName = count > 1 ? `${namePattern} #${i}` : namePattern;
          }

          tasksToInsert.push({
            client_id: client.id,
            category: categoryName,
            name: taskName,
            budget_hours: budget,
            status: 'Non démarré',
            due_date: endOfMonthStr
          });
        }
      } else {
        console.log(`  - ${categoryName} : Déjà à jour (${existingCount}/${count})`);
      }
    };

    // A. Facebook
    generateDeliverable(
      client.posts_facebook || 0,
      `Facebook ${monthUpper}`,
      `Post Facebook #i - ${monthLower} ${yearVal}`,
      0.5
    );

    // B. Instagram
    generateDeliverable(
      client.posts_instagram || 0,
      `Instagram ${monthUpper}`,
      `Post Instagram #i - ${monthLower} ${yearVal}`,
      0.5
    );

    // C. LinkedIn
    generateDeliverable(
      client.posts_linkedin || 0,
      `LinkedIn ${monthUpper}`,
      `Post LinkedIn #i - ${monthLower} ${yearVal}`,
      0.5
    );

    // D. Google Posts
    generateDeliverable(
      client.posts_google || 0,
      `Google ${monthUpper}`,
      `Post Google #i - ${monthLower} ${yearVal}`,
      0.5
    );

    // E. Newsletter
    generateDeliverable(
      client.newsletter_count || 0,
      `Newsletter ${monthUpper}`,
      `Newsletter #i - ${monthLower} ${yearVal}`,
      2.0
    );

    // F. Blogs
    generateDeliverable(
      client.blog_count || 0,
      `BB ${monthUpper}`,
      `Article ${monthLower}`,
      4.0
    );

    // Insert tasks if any
    if (tasksToInsert.length > 0) {
      const { data: inserted, error: errI } = await supabaseAdmin
        .from('production_tasks')
        .insert(tasksToInsert)
        .select();

      if (errI) {
        console.error(`  ❌ Erreur lors de l'insertion des tâches :`, errI);
      } else {
        console.log(`  ✔️ ${inserted.length} tâches insérées avec succès !`);
      }
    } else {
      console.log('  Toutes les tâches sont déjà à jour pour ce client.');
    }
  }

  console.log('\nGénération terminée.');
}

main().catch(console.error);
