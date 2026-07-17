# Rapport de Sécurité et de Conformité

Ce rapport présente l'analyse de sécurité et de conformité de l'application de gestion des congés (ERP-StepUp).

## 🔒 Gestion des Secrets et Identifiants

Tous les secrets, clés d'API et identifiants de connexion de l'application sont stockés de manière sécurisée et ne sont pas codés en dur dans le code source :

- **Clés Supabase** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) : Chargées dynamiquement via les variables d'environnement (`process.env`).
- **Accès Google Sheets API** (`GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`) : Chargés dynamiquement à l'initialisation du client Google.
- **Ignorance Git** : Le fichier de configuration local `.env.local` est correctement enregistré dans le fichier [.gitignore](file:///c:/Users/STEPUP%20GRAPHISTE/Documents/DevApp/RH/.gitignore) pour éviter toute fuite accidentelle vers un dépôt Git public ou partagé.

---

## 👥 Authentification et Autorisation

L'authentification et le contrôle d'accès sont gérés à deux niveaux :

### 1. Authentification
- Gérée par **Supabase Auth** avec des tokens JWT.
- Les requêtes vers les routes d'API incluent le token d'authentification dans l'en-tête `Authorization: Bearer <token>`.
- Le serveur valide le token côté backend via le helper `verifyRole` ([supabaseAuth.js](file:///c:/Users/STEPUP%20GRAPHISTE/Documents/DevApp/RH/lib/supabaseAuth.js)) avant de traiter la demande.

### 2. Autorisation et Contrôle des Rôles (RBAC)
- **Frontend** : L'interface masque ou affiche dynamiquement les onglets ("Administration RH") et les actions selon le rôle de l'utilisateur (`hr`, `manager`, `director`, `employee`).
- **Backend (API)** : Toutes les routes sensibles (écriture, modification, suppression ou lecture de données globales) font l'objet d'un contrôle d'accès strict basé sur le rôle du token JWT de l'utilisateur.

---

## 🛡️ Règle de validation N+1 (Manager)

Dans le cadre des modifications récentes :
- **Sécurité Interface (Frontend)** : Les boutons d'acceptation et de refus dans l'interface "Suivi et Validation Finale RH" sont désactivés (`disabled={!isN1}`) et grisés pour tous les utilisateurs autres que le N+1 (Manager) direct de l'employé ayant formulé la demande.
- **Sécurité Backend (API)** : La route `/api/leaves/validate` compare l'email du token JWT avec les données hiérarchiques de la feuille de calcul `Soldes_Conges` (Google Sheets). Si l'utilisateur connecté ne correspond pas au manager désigné de l'employé, l'API renvoie immédiatement une erreur `403 Forbidden` sans modifier le statut de la demande.

---

## ⚙️ Concurrence et Intégrité des Données

- **Mutex d'écriture** : Pour éviter les conflits d'écriture concurrentiels dans les feuilles Google Sheets (comme deux demandes traitées en même temps ou des déductions de solde incorrectes), toutes les opérations d'écriture de l'API sont encapsulées dans un verrou exclusif (`runWithMutex`).
- **Validation des soldes** : La validation d'une demande de congé vérifie toujours le solde restant immédiatement avant d'effectuer le débit, évitant ainsi le risque de solde négatif.
