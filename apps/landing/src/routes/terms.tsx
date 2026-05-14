import { createFileRoute } from '@tanstack/react-router';
import LegalPage from '~/components/LegalPage';
import { termsEs } from '~/i18n/legal/terms-es';

export const Route = createFileRoute('/terms')({
  component: () => <LegalPage locale="es" title="Terminos de Servicio" lastUpdated="13 de mayo de 2026" content={termsEs} />,
  head: () => ({ meta: [{ title: 'Rondas — Terminos de Servicio' }] }),
});
