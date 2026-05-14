import { createFileRoute } from '@tanstack/react-router';
import LegalPage from '~/components/LegalPage';
import { termsEn } from '~/i18n/legal/terms-en';

export const Route = createFileRoute('/en/terms')({
  component: () => <LegalPage locale="en" title="Terms of Service" lastUpdated="May 13, 2026" content={termsEn} />,
  head: () => ({ meta: [{ title: 'Rondas — Terms of Service' }] }),
});
