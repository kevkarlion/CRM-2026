import type { Metadata } from 'next';
import './globals.css';
import { initAuth } from '@/lib/auth-config';
import { setupEventHandlers } from '@/infrastructure/events/setup';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

initAuth();
setupEventHandlers();

export const metadata: Metadata = {
  title: 'CRM 2026',
  description: 'Plataforma de gestión CRM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
