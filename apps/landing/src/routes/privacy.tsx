import { createFileRoute } from '@tanstack/react-router';
import LegalPage from '~/components/LegalPage';
import { privacyEs } from '~/i18n/legal/privacy-es';

export const Route = createFileRoute('/privacy')({
  component: () => <LegalPage locale="es" title="Politica de Privacidad" lastUpdated="13 de mayo de 2026" content={privacyEs} />,
  head: () => ({ meta: [{ title: 'Rondas — Politica de Privacidad' }] }),
});
