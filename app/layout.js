import './globals.css';

export const metadata = {
  title: 'Mini-ERP Congés API',
  description: 'API du module de gestion des congés.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
