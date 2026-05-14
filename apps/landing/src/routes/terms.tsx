import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
  head: () => ({
    meta: [{ title: 'Rondas — Terms of Service' }],
  }),
});

function TermsPage() {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-6 py-4 backdrop-blur-lg" style={{ background: 'oklch(0.14 0.02 260 / 0.8)' }}>
        <a href="/" className="flex items-center gap-[0.1rem] no-underline">
          <img src="/r-logo.png" alt="R" className="w-[34px] h-[34px]" />
          <span className="font-body font-extrabold text-lg text-fg tracking-tight">ondas</span>
        </a>
      </nav>
      <main className="max-w-[680px] mx-auto px-6 pt-28 pb-16 relative z-1">
        <h1 className="font-display text-3xl font-extrabold mb-2">Terms of Service</h1>
        <p className="text-muted text-sm mb-8">Last Updated: May 13, 2026</p>
        <div className="prose prose-invert text-sm text-muted leading-relaxed [&_h2]:text-fg [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-fg [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:ml-5 [&_li]:mb-1 [&_a]:text-accent [&_a]:underline" dangerouslySetInnerHTML={{ __html: TERMS_CONTENT }} />
      </main>
      <footer className="px-6 py-10 border-t border-white/[0.04] text-center relative z-1">
        <div className="flex justify-center gap-6 flex-wrap">
          <a href="/privacy" className="text-muted text-xs no-underline hover:text-fg transition-colors">Privacy Policy</a>
          <a href="/terms" className="text-muted text-xs no-underline hover:text-fg transition-colors">Terms of Service</a>
          <a href="mailto:legal@rondas.co" className="text-muted text-xs no-underline hover:text-fg transition-colors">legal@rondas.co</a>
        </div>
        <p className="text-xs mt-4" style={{ color: 'oklch(0.40 0.02 260)' }}>© 2026 Rondas. Hecho en Colombia.</p>
      </footer>
    </>
  );
}

const TERMS_CONTENT = `
<p>Please read these Terms of Service ("ToS") carefully before using the Rondas mobile application ("App") provided by Cristhian De Marchena ("Developer"). By using the App, you agree to be bound by these ToS.</p>

<h2>Use and Restrictions</h2>
<ul>
<li>The App is intended for personal use only and should not be used for any illegal activities.</li>
<li>Users are responsible for the accuracy and legality of the data entered into the App.</li>
<li>The App is not a financial advisor, accountant, or tax service. Bill calculations are informational and should not be relied upon for tax or legal purposes.</li>
</ul>

<h2>Account</h2>
<p>When you create an account via email, Apple, or Google sign-in, you are responsible for maintaining the confidentiality of your account, all activities under your account, and notifying us of any unauthorized access.</p>

<h2>Data Storage</h2>
<p>Your data (bills, contacts, tags) is stored in Convex, a cloud database service. Data is synced across your devices when you sign in with the same account. Receipt images are processed in memory for AI scanning and are not stored permanently.</p>

<h2>Subscription-Based Services</h2>
<h3>Free Tier</h3>
<p>Up to 3 bill scans per month, 3 custom tags, and access to bills from the last 90 days. The first 2 bills unlock all features as a trial.</p>

<h3>Pro Tier</h3>
<p>Unlimited bill scans, unlimited custom tags, full bill history, payment tracking, and AI auto-tagging.</p>

<h3>Pricing and Renewal</h3>
<ul>
<li>Subscriptions are auto-renewable and billed monthly or yearly through the App Store.</li>
<li>Prices are regionalized: approximately $9,900 COP/month (Colombia) or $4.99 USD/month (United States).</li>
<li>Users can cancel at any time via App Store account settings. Service continues until the end of the billing period.</li>
<li>Refunds are handled by Apple according to their App Store refund policies.</li>
</ul>

<h2>AI Receipt Scanning</h2>
<p>The App uses Google Gemini to extract items from receipt photos. By using this feature, you acknowledge that receipt images are sent to Google's servers, extraction results may not be 100% accurate, and the Developer is not responsible for errors in AI-extracted data.</p>

<h2>WhatsApp Sharing</h2>
<p>The App generates bill summaries shared via WhatsApp's standard sharing mechanism. The Developer does not store or access your WhatsApp messages. Recipients receive a plain text summary, not access to the App or your data.</p>

<h2>Limitation of Liability</h2>
<p>To the maximum extent permitted by law, the Developer shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from the use of the App. The Developer does not guarantee the accuracy of AI-extracted receipt data and tax calculations.</p>

<h2>Intellectual Property</h2>
<p>The App and all its content, features, and functionality are owned by the Developer and protected by intellectual property laws.</p>

<h2>Dispute Resolution</h2>
<p>Any dispute arising from the use of the App shall be resolved through good-faith negotiation first. If no resolution is reached, disputes shall be subject to the jurisdiction of the courts of Colombia.</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:legal@rondas.co">legal@rondas.co</a><br>Developer: Cristhian De Marchena</p>
`;
