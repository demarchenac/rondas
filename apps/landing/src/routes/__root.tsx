/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import appCss from '~/styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'Rondas — Divide cuentas con IA' },
      { name: 'description', content: 'Escanea el recibo con IA, divide entre amigos con impuestos colombianos, y comparte por WhatsApp.' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,400;0,700;0,800;1,700&family=Manrope:wght@400;500;600;700;800&display=swap' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg font-body antialiased overflow-x-hidden">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
