import { getTranslations, type Locale } from '~/i18n';

export default function LegalPage({ locale, title, lastUpdated, content }: { locale: Locale; title: string; lastUpdated: string; content: string }) {
  const t = getTranslations(locale);
  const prefix = locale === 'en' ? '/en' : '';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-6 py-4 backdrop-blur-lg" style={{ background: 'oklch(0.14 0.02 260 / 0.8)' }}>
        <a href={prefix || '/'} className="flex items-center gap-[0.1rem] no-underline">
          <img src="/r-logo.png" alt="R" className="w-[34px] h-[34px]" />
          <span className="font-body font-extrabold text-lg text-fg tracking-tight">ondas</span>
        </a>
      </nav>
      <main className="max-w-[680px] mx-auto px-6 pt-28 pb-16 relative z-1">
        <h1 className="font-display text-3xl font-extrabold mb-2">{title}</h1>
        <p className="text-muted text-sm mb-8">Last Updated: {lastUpdated}</p>
        <div
          className="text-sm text-muted leading-relaxed [&_h2]:text-fg [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-fg [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:ml-5 [&_li]:mb-1 [&_table]:w-full [&_table]:text-xs [&_th]:text-left [&_th]:text-fg [&_th]:pb-2 [&_th]:pr-4 [&_td]:pb-2 [&_td]:pr-4 [&_td]:align-top [&_a]:text-accent [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </main>
      <footer className="px-6 py-10 border-t border-white/[0.04] text-center relative z-1">
        <div className="flex justify-center gap-6 flex-wrap">
          <a href={`${prefix}/privacy`} className="text-muted text-xs no-underline hover:text-fg transition-colors">{t.footerPrivacy}</a>
          <a href={`${prefix}/terms`} className="text-muted text-xs no-underline hover:text-fg transition-colors">{t.footerTerms}</a>
          <a href="mailto:legal@rondas.co" className="text-muted text-xs no-underline hover:text-fg transition-colors">legal@rondas.co</a>
        </div>
        <p className="text-xs mt-4" style={{ color: 'oklch(0.40 0.02 260)' }}>{t.footerCopy}</p>
      </footer>
    </>
  );
}
