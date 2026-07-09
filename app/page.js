export default function Page() {
  return (
    <div className="card">
      <div className="logo-container">
        <span className="logo">ERP.Congés</span>
      </div>
      
      <h1>Module API Gestion des Congés</h1>
      <p>
        Bienvenue sur le module de gestion des congés de notre Mini-ERP.
        Les endpoints d'API sont opérationnels et sécurisés via Supabase.
      </p>

      <div className="status-badge">
        <div className="status-dot"></div>
        <span>Production Ready & Online</span>
      </div>

      <div className="routes-list">
        <div className="routes-title">Endpoints Disponibles</div>
        
        <div className="route-item">
          <span className="route-path">/api/leaves/submit</span>
          <span className="route-method method-post">POST</span>
        </div>

        <div className="route-item">
          <span className="route-path">/api/leaves/pending</span>
          <span className="route-method method-get">GET</span>
        </div>

        <div className="route-item">
          <span className="route-path">/api/leaves/validate</span>
          <span className="route-method method-post">POST</span>
        </div>
      </div>

      <div className="footer">
        © {new Date().getFullYear()} - MVP ERP 50 Collaborateurs. Propriété Interne.
      </div>
    </div>
  );
}
