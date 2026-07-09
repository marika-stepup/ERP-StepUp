import './globals.css';

export const metadata = {
  title: 'Step Hub - Gestion des Congés',
  description: "Portail interne de gestion des congés et absences de l'agence Step Up.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
