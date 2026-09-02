# Rapport de Sécurité et de Conformité RGPD

Ce rapport présente l'analyse de sécurité et de conformité aux exigences du **Règlement Général sur la Protection des Données (RGPD)** de l'application ERP-StepUp (Gestion RH, Congés & Production).

---

## 🔒 1. Gestion des Secrets et Isolation des Données (Art. 32 RGPD)

Toutes les clés d'API et identifiants de connexion sont strictement isolés et chargés au moment de l'exécution :

- **Clés Supabase Privées** (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`) : Chargées exclusivement côté serveur via les variables d'environnement (`process.env`).
- **Accès Google Sheets API** (`GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) : Déchiffrés et initialisés au runtime serveur, jamais exposés au frontend.
- **Ségrégation Client/Serveur** : Seules les clés publiques d'authentification (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) sont accessibles par le navigateur, sous contrôle strict des politiques RLS (Row Level Security).
- **Protection Git (`.gitignore`)** : Exclut tous les fichiers d'environnement (`.env*`, `.env*.local`), les certificats (`*.pem`), ainsi que le répertoire de travail local `/scratch/`.

---

## 🛡️ 2. Assainissement des Données Personnelles dans le Code (Art. 5 & Art. 25 RGPD)

Conformément aux principes de **minimisation des données** et de **Protection des données dès la conception (Privacy by Design)** :

- **Suppression des données nominatives réelles** : Tous les scripts de test et de synchronisation ne contiennent plus d'adresses emails réelles de collaborateurs en dur.
- **Éradication des mots de passe par défaut faibles** : Les scripts d'initialisation (`create-users.js`, `sync-users.js`) s'appuient désormais sur la génération cryptographique dynamique de mots de passe ou sur des arguments d'environnement sécurisés.
- **Suppression des scripts de test intrusifs** : Les scripts de type dictionnaire de mots de passe (`try-passwords.js`, `try-logins.js`) ont été supprimés du dépôt.

---

## 👥 3. Authentification, Contrôle d'Accès et Rôles (RBAC)

L'accès aux données personnelles et sensibles des employés est strictement cloisonné :

### A. Authentification Forte
- Gérée par **Supabase Auth** avec des jetons JWT sécurisés transmis via l'en-tête `Authorization: Bearer <token>`.
- Révocation et expiration gérées côté serveur.

### B. Contrôle des Rôles (RBAC)
- **Frontend** : L'interface filtre l'affichage selon le rôle de l'utilisateur (`hr`, `manager`, `director`, `employee`).
- **Backend (API)** : Toutes les routes sensibles font l'objet d'un contrôle d'accès strict basé sur le rôle via le helper `verifyRole` ([supabaseAuth.js](file:///c:/Users/STEPUP%20GRAPHISTE/Documents/DevApp/RH/lib/supabaseAuth.js)).

### C. Règle Hiérarchique N+1 (Manager)
- La route `/api/leaves/validate` vérifie que seul le N+1 désigné de l'employé est autorisé à valider ou refuser une demande. Toute tentative externe est bloquée avec une erreur `403 Forbidden`.

---

## 🌐 4. Verrouillage des Routes d'Arrière-Plan (CRON & Webhooks)

Pour empêcher toute manipulation de données ou exécution arbitraire non autorisée :

- **Route CRON Anniversaires de contrat** (`/api/cron/credit-anniversaries`) : Exige impérativement le jeton secret `CRON_SECRET`. En l'absence ou en cas de non-concordance du jeton, la requête est rejetée avec un code `401 Unauthorized`.
- **Route CRON Export Reporting** (`/api/cron/export-sheets-flat`) : Exige impérativement `CRON_SECRET` via le header `Authorization` ou le paramètre `?secret=`.
- **Route Webhook Synchronisation** (`/api/webhooks/sync-sheets`) : Exige impérativement `WEBHOOK_SECRET` via `x-webhook-secret` ou `?secret=`.

---

## ⚙️ 5. Concurrence, Intégrité et Traçabilité (Art. 32 RGPD)

- **Mutex d'écriture (`runWithMutex`)** : Toutes les écritures et synchronisations vers Google Sheets sont sérialisées pour prévenir les conflits d'accès et garantir la cohérence des soldes de congés.
- **Validation préalable des soldes** : Vérification immédiate avant tout débit de solde pour éviter les incohérences ou les soldes négatifs.
- **Horodatage et audit** : Chaque modification (demande, approbation, pointage) est associée à un horodatage UTC précis (`created_at`, `updated_at`).

---

## 📌 Recommandations Opérationnelles pour la Production

1. **Rotation des Mots de Passe** : Inviter l'ensemble des collaborateurs créés lors de la phase de test initiale à modifier leur mot de passe dès leur première connexion.
2. **Variables d'environnement d'hébergement (Vercel / Serveur)** :
   - Définir une clé aléatoire forte pour `CRON_SECRET` (ex: `openssl rand -hex 32`).
   - Définir une clé aléatoire forte pour `WEBHOOK_SECRET`.

