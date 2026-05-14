import { createFileRoute } from '@tanstack/react-router';
import LegalPage from '~/components/LegalPage';
import { privacyEn } from '~/i18n/legal/privacy-en';

export const Route = createFileRoute('/en/privacy')({
  component: () => <LegalPage locale="en" title="Privacy Policy" lastUpdated="May 13, 2026" content={privacyEn} />,
  head: () => ({ meta: [{ title: 'Rondas — Privacy Policy' }] }),
});
