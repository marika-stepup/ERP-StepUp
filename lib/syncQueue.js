/**
 * Gestionnaire de file d'attente pour la synchronisation résiliente avec l'API Google Sheets.
 * Gère le stockage LocalStorage, le regroupement (batching), la déduplication des écritures,
 * les tentatives de reconnexion (retry avec backoff exponentiel) et le vidage lors de la fermeture de page.
 */
export class SyncQueueManager {
  constructor({
    getToken,
    debounceMs = 3000,
    maxBatchSize = 10,
    onSyncStart = () => {},
    onSyncSuccess = () => {},
    onSyncError = () => {},
    onRollback = () => {}
  }) {
    this.getToken = getToken; // Fonction de rappel pour obtenir le token d'authentification courant
    this.debounceMs = debounceMs;
    this.maxBatchSize = maxBatchSize;
    this.onSyncStart = onSyncStart;
    this.onSyncSuccess = onSyncSuccess;
    this.onSyncError = onSyncError;
    this.onRollback = onRollback; // Appelé en cas d'échec définitif pour annuler l'Optimistic UI

    this.queue = [];
    this.debounceTimer = null;
    this.isProcessing = false;
    this.storageKey = 'sheets_sync_queue';

    // Charger les modifications en attente sauvegardées lors d'une session précédente
    this.loadFromStorage();
    
    // Initialiser les écouteurs d'événements du navigateur
    this.setupEventListeners();
  }

  /**
   * Ajoute une mutation à la file d'attente et planifie la synchronisation.
   * @param {Object} mutation
   * @param {string} mutation.type - Type d'action (ex: 'adjust-balance', 'update-member')
   * @param {string} mutation.employeeId - ID de l'employé concerné
   * @param {string} mutation.field - Le champ modifié (ex: 'initial_balance', 'initial_perm')
   * @param {any} mutation.value - La nouvelle valeur
   * @param {any} mutation.oldValue - L'ancienne valeur (pour rollback)
   * @param {string} mutation.range - Plage A1 à mettre à jour (facultatif si le backend la résout, mais recommandé pour le batching brut)
   */
  enqueue(mutation) {
    const item = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      attempts: 0,
      ...mutation
    };

    this.queue.push(item);
    this.saveToStorage();

    // Si on atteint le seuil maximal, on force l'envoi immédiat
    if (this.queue.length >= this.maxBatchSize) {
      this.flushImmediate();
    } else {
      this.resetDebounce();
    }
  }

  resetDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flushImmediate();
    }, this.debounceMs);
  }

  async flushImmediate() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    const token = this.getToken();
    if (!token) {
      console.warn('[SyncQueue] Envoi différé : Token JWT non disponible.');
      return;
    }

    // Isoler les éléments à traiter
    const batchToProcess = [...this.queue];
    this.isProcessing = true;
    this.onSyncStart();

    try {
      // Optimiser et dédupliquer les écritures (par ex: si on modifie deux fois la même cellule, on ne garde que la dernière)
      const optimizedBatch = this.optimizeBatch(batchToProcess);

      const response = await fetch('/api/sheets/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mutations: optimizedBatch
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Erreur serveur : ${response.status}`);
      }

      // Succès ! Retirer ces éléments de la file d'attente
      const processedIds = new Set(batchToProcess.map(m => m.id));
      this.queue = this.queue.filter(m => !processedIds.has(m.id));
      this.saveToStorage();

      this.onSyncSuccess(result);
    } catch (err) {
      console.error('[SyncQueue] Échec de la synchronisation du batch :', err.message);
      this.onSyncError(err);
      this.handleFailure(batchToProcess);
    } finally {
      this.isProcessing = false;
      // Si de nouveaux éléments ont été ajoutés pendant l'envoi, relancer un debounce
      if (this.queue.length > 0) {
        this.resetDebounce();
      }
    }
  }

  /**
   * Fusionne les écritures redondantes sur un même couple (employeeId, field)
   * afin de minimiser le trafic réseau et la charge Google Sheets.
   */
  optimizeBatch(mutations) {
    const uniqueKeys = {};
    for (const m of mutations) {
      const key = `${m.employeeId}-${m.field}`;
      // On garde toujours la mutation la plus récente
      uniqueKeys[key] = m;
    }
    return Object.values(uniqueKeys).map(m => ({
      type: m.type,
      employeeId: m.employeeId,
      field: m.field,
      value: m.value
    }));
  }

  handleFailure(failedMutations) {
    // Incrémenter le nombre d'essais
    failedMutations.forEach(m => m.attempts++);

    // Séparer les mutations en échec définitif de celles à retenter
    const maxAttempts = 5;
    const deadMutations = failedMutations.filter(m => m.attempts >= maxAttempts);
    const retryMutations = failedMutations.filter(m => m.attempts < maxAttempts);

    if (deadMutations.length > 0) {
      console.error('[SyncQueue] Certaines modifications ont échoué définitivement (Rollback) :', deadMutations);
      // Notifier le composant pour effectuer un rollback UI des valeurs concernées
      this.onRollback(deadMutations);

      // Enlever les mutations mortes de la file d'attente principale
      const deadIds = new Set(deadMutations.map(m => m.id));
      this.queue = this.queue.filter(m => !deadIds.has(m.id));
    }

    this.saveToStorage();

    // Si on est en ligne et qu'il y a des éléments à retenter, programmer un retry exponentiel
    if (typeof window !== 'undefined' && navigator.onLine && retryMutations.length > 0) {
      const minAttempt = Math.min(...retryMutations.map(m => m.attempts));
      // Backoff exponentiel : 2^attemp * 1000ms + Jitter
      const delay = Math.pow(2, minAttempt) * 1000 + Math.random() * 1000;
      console.log(`[SyncQueue] Nouvelle tentative de synchronisation planifiée dans ${Math.round(delay)}ms...`);
      setTimeout(() => this.flushImmediate(), delay);
    }
  }

  saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[SyncQueue] Impossible de sauvegarder dans LocalStorage', e);
    }
  }

  loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.queue = JSON.parse(data);
      }
    } catch (e) {
      this.queue = [];
    }
  }

  setupEventListeners() {
    if (typeof window === 'undefined') return;

    // Détecter le retour à un état en ligne
    window.addEventListener('online', () => {
      console.log('[SyncQueue] Navigateur de nouveau en ligne, tentative de vidage de la file...');
      this.flushImmediate();
    });

    // Événement avant de quitter ou recharger la page
    window.addEventListener('beforeunload', () => {
      this.flushOnUnload();
    });

    // Événement plus robuste sur mobile (passage en arrière-plan)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushImmediate();
      }
    });
  }

  /**
   * Envoi de sauvegarde synchrone en cas de fermeture de l'onglet.
   * Utilise sendBeacon ou fetch avec keepalive.
   */
  flushOnUnload() {
    if (this.queue.length === 0) return;

    const token = this.getToken();
    if (!token) return;

    const optimizedBatch = this.optimizeBatch(this.queue);
    const payload = JSON.stringify({
      mutations: optimizedBatch
    });

    const url = '/api/sheets/batch-update';

    // navigator.sendBeacon est la méthode standard et recommandée pour le unload
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      // Fallback avec fetch keepalive
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: payload,
        keepalive: true
      });
    }

    // Vider la file locale pour éviter le renvoi en doublon au rechargement
    this.queue = [];
    localStorage.removeItem(this.storageKey);
  }
}
