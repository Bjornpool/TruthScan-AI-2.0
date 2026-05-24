/**
 * Główny layout aplikacji frontendowej (Next.js App Router).
 */

import "../styles/globals.css";
import NavBar from "../components/NavBar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <div className="content-overlay min-h-screen flex flex-col">
          <NavBar />

          <main className="flex-1">{children}</main>

          <footer className="text-center p-4 text-sm bg-white/80 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} TruthScan AI
          </footer>
        </div>
      </body>
    </html>
  );
}
