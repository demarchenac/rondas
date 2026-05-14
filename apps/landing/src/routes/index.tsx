import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const APPLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

function HomePage() {
  return (
    <>
      {/* Grain texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[1000] opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient glow */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.25 0.06 55 / 0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 50% at 85% 75%, oklch(0.20 0.05 210 / 0.05) 0%, transparent 70%)',
        }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-6 py-4 backdrop-blur-lg" style={{ background: 'oklch(0.14 0.02 260 / 0.8)' }}>
        <a href="/" className="flex items-center gap-[0.1rem] no-underline">
          <img src="/r-logo.png" alt="R" className="w-[34px] h-[34px]" />
          <span className="font-body font-extrabold text-lg text-fg tracking-tight">ondas</span>
        </a>
        <a href="#" className="bg-fg text-bg px-5 py-2 rounded-lg font-bold text-sm no-underline transition-transform hover:-translate-y-px">
          Dividir mi cuenta
        </a>
      </nav>

      {/* Hero */}
      <section className="min-h-dvh flex flex-col justify-center px-6 pt-28 pb-12 relative z-1 animate-[rise_0.6s_ease-out_both]">
        <h1 className="font-display text-[clamp(2.25rem,7vw,4rem)] font-extrabold leading-[1.1] tracking-tight max-w-[16ch]">
          ¿Cansado de ser el que siempre saca <span className="text-accent">la cuenta?</span>
        </h1>
        <p className="text-muted text-[clamp(0.9375rem,1.2vw,1.0625rem)] max-w-[44ch] mt-5 leading-relaxed">
          Toma una foto del recibo. La IA extrae cada item, divide con impuestos colombianos incluidos, y cada amigo recibe su parte por WhatsApp. En menos de 30 segundos.
        </p>
        <a href="#" className="inline-flex items-center gap-2.5 mt-8 px-7 py-3.5 bg-fg text-bg font-bold text-sm rounded-xl no-underline w-fit transition-all hover:-translate-y-0.5 hover:shadow-lg">
          {APPLE_ICON}
          Dividir mi primera cuenta
        </a>
        <div className="text-xs text-muted mt-4 flex items-center gap-1">
          <img src="/flag-co.png" alt="Colombia" className="w-4 h-4 align-middle" />
          Hecho en Colombia
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden py-10 border-t border-b border-white/[0.04] relative z-1">
        <div className="flex gap-12 animate-[scroll_22s_linear_infinite] w-max">
          {[0, 1].map((i) => (
            <span key={i} className="text-sm text-muted whitespace-nowrap tracking-wide">
              Escaneo con IA <Dot /> IVA e impoconsumo <Dot /> WhatsApp sharing <Dot /> Tags personalizados <Dot /> Propina sobre base <Dot /> Infografía compartible <Dot /> Hecho en Colombia
            </span>
          ))}
        </div>
      </div>

      {/* Features + Phone side by side on desktop */}
      <div className="px-6 py-12 relative z-1 max-w-[1100px] mx-auto md:grid md:grid-cols-[1fr_auto] md:gap-12 md:items-start">
        {/* Features */}
        <section className="max-w-[680px]">
          <div className="text-[0.6875rem] font-bold tracking-widest uppercase text-warm mb-3">Cómo funciona</div>
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold mb-10 leading-tight max-w-[22ch]">
            Del recibo al WhatsApp de tu amigo en 30 segundos
          </h2>
          <div className="flex flex-col">
            <FeatureRow num="01" color="text-accent" title="Foto y listo" desc="Toma una foto del recibo. Gemini 2.5 extrae cada plato, bebida y precio con streaming en tiempo real. Sin escribir nada." first />
            <FeatureRow num="02" color="text-teal" title="Impuestos colombianos incluidos" desc="Divide por ítem o en partes iguales. IVA, impoconsumo y propina se calculan automáticamente sobre la base correcta." />
            <FeatureRow num="03" color="text-violet" title="Directo al WhatsApp" desc="Cada persona recibe su desglose personalizado con un toque. Incluye infografía estilo recibo para compartir en historias." />
            <FeatureRow num="04" color="text-rose" title="Sabé dónde va tu plata" desc="Tags personalizados para categorizar gastos. Restaurantes, viajes, regalos. La IA sugiere tags al escanear." />
          </div>
        </section>

        {/* Phone mockup */}
        <section className="flex justify-center py-8 md:py-0 md:sticky md:top-32">
          <div className="w-[240px] h-[480px] rounded-[36px] p-3 shadow-2xl md:w-[260px] md:h-[520px]" style={{ background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.25 0.02 260)', boxShadow: '0 24px 64px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.04)' }}>
            <div className="w-full h-full rounded-[26px] flex flex-col items-center justify-center gap-2 overflow-hidden relative p-6" style={{ background: 'oklch(0.15 0.02 260)' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-black rounded-b-2xl" />
              <ScreenCard name="El Corral Usaquén" amount="$303.529 COP" meta="Abr 20 · 3 ítems" badge="split" />
              <ScreenCard name="Andrés Carne de Res" amount="$1.801.139 COP" meta="Abr 13 · 24 ítems" badge="pending" />
              <ScreenCard name="Juan Valdez Parque 93" amount="$32.012 COP" meta="Abr 10 · 3 ítems" badge="split" />
            </div>
          </div>
        </section>
      </div>

      {/* Bottom CTA */}
      <section className="text-center px-6 py-16 relative z-1">
        <div className="font-display text-[clamp(1.25rem,3.5vw,1.625rem)] font-extrabold mb-6 leading-tight max-w-[24ch] mx-auto">
          La próxima vez que salgas con amigos, que la cuenta no sea <span className="text-accent">tu problema</span>
        </div>
        <a href="#" className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-fg text-bg font-bold text-base rounded-xl no-underline transition-all hover:-translate-y-0.5 hover:shadow-lg">
          {APPLE_ICON}
          Descargar gratis en App Store
        </a>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-white/[0.04] text-center relative z-1">
        <div className="flex items-center justify-center gap-[0.1rem] mb-4">
          <img src="/r-logo.png" alt="R" className="w-6 h-6" />
          <span className="font-bold text-sm">ondas</span>
        </div>
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

function Dot() {
  return (
    <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent align-middle mx-1" />
  );
}

function FeatureRow({ num, color, title, desc, first }: { num: string; color: string; title: string; desc: string; first?: boolean }) {
  return (
    <div className={`grid grid-cols-[44px_1fr] gap-4 py-7 border-b border-white/[0.04] items-start md:grid-cols-[56px_1fr] md:gap-6 ${first ? 'border-t border-white/[0.04]' : ''}`}>
      <div className={`font-display text-3xl font-extrabold leading-none md:text-4xl ${color}`}>{num}</div>
      <div>
        <h3 className="text-base font-bold mb-1 tracking-tight">{title}</h3>
        <p className="text-muted text-sm leading-relaxed max-w-[48ch]">{desc}</p>
      </div>
    </div>
  );
}

function ScreenCard({ name, amount, meta, badge }: { name: string; amount: string; meta: string; badge: 'split' | 'pending' }) {
  const badgeStyles = badge === 'split'
    ? 'bg-teal/15 text-teal'
    : 'bg-warm/15 text-warm';
  const badgeLabel = badge === 'split' ? 'Dividida' : 'Sin resolver';

  return (
    <div className="w-full px-3 py-2.5 rounded-xl" style={{ background: 'oklch(0.19 0.02 260)', border: '1px solid oklch(0.24 0.02 260)' }}>
      <div className="text-[0.5625rem] font-semibold text-fg">{name}</div>
      <div className="text-sm font-extrabold text-fg mt-0.5">{amount}</div>
      <div className="text-[0.4375rem] text-muted mt-0.5">{meta}</div>
      <div className={`inline-flex items-center text-[0.375rem] font-bold px-1.5 py-0.5 rounded-full mt-1 ${badgeStyles}`}>
        <svg width="4" height="4" viewBox="0 0 4 4" className="shrink-0 mr-1"><circle cx="2" cy="2" r="2" fill="currentColor" /></svg>
        {badgeLabel}
      </div>
    </div>
  );
}
