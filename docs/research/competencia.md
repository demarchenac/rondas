# Competencia & Feature Research

> Fecha: 2026-04-21

## Tabla Comparativa de Competidores

| App | AI Receipt Scan | Auto-Categorize | AI Insights/Chat | Theming | LatAm Payments | Pricing |
|---|---|---|---|---|---|---|
| **Splitwise** | Pro only (OCR) | No | No | No dark mode | No (Venmo/PayPal) | Free (5/day limit) / Pro $4.99/mo |
| **Tricount** | Si (OCR) | No | No | Dark mode | No (bunq card) | Free / Premium $9.99/yr per grupo |
| **Splid** | No | No | No | Minimal | No | Free + ads |
| **Settle Up** | No | Premium only | No | No | No | Free / Premium |
| **Divide** | No | Si (auto) | Si (AI chat) | Gen Z aesthetic | No | Free / Premium |
| **SplitMyExpenses** | Si (AI) | Si (AI) | Si (summaries) | Light/Dark | No (Venmo/Zelle) | Free / $3.99/mo |
| **ReceiptSplit** | Si (AI) | No | No | No | No | Free (10 scans/mo) / Pro |
| **Cino** | N/A | No | No | No | No (Mastercard EU) | Free early access |
| **Splital** | No | Si (auto) | No | No | No | Free / Pro $2.99/mo |
| **Monyo** | Si | No detallado | No detallado | Gen Z | No | No publicado |
| **OneSplit** | Si (OCR) | No | No | No | No | No publicado |
| **Splittier** | Si (AI) | No | No | Redesign v3 | No | Free + ads / Premium (precio no publicado) |
| **Rondas (actual)** | Si (Gemini 2.5 Flash streaming) | Si (auto-tag AI) | No | Light/Dark/System + Liquid Glass | WhatsApp sharing | Free (3 scans/mo) / Pro $9,900 COP/mo |

---

## Ventajas Competitivas Actuales de Rondas

1. **Unica app enfocada en Colombia/LatAm** -- ninguna competencia integra Nequi, Daviplata, PSE
2. **WhatsApp-first sharing** -- ningun competidor integra WhatsApp para compartir desglose
3. **COP-first** -- impuestos colombianos (IVA/impoconsumo), propina sobre base, formato COP
4. **AI streaming** -- Gemini 2.5 Flash con streaming real-time (SSE) vs OCR batch de competencia
5. **Spanish-first UX** con soporte bilingue
6. **Pricing local** -- $9,900 COP/mo vs $5 USD de Splitwise

---

## Debilidades / Gaps vs Competencia

| Gap | Competidores que lo tienen | Prioridad |
|---|---|---|
| Auto-categorization de gastos | Divide, SplitMyExpenses, Splital | Alta |
| AI insights / chat con gastos | Divide, SplitMyExpenses | Media |
| Graficas/estadisticas de gasto | Splitwise Pro, SplitMyExpenses, Splital | Media |
| Recurring expenses | SplitMyExpenses, Settle Up, Splittier | Baja |
| Voice-based expense entry | Splittier | Media |
| Monthly spending wrap-ups | Splittier | Media |
| Loans tracking (prestamos) | Splittier | Baja |
| Bank/card linking auto-import | SplitMyExpenses | Baja |
| Payment integrations directas | Splitwise (Venmo), Tricount (bunq), ReceiptSplit (8 metodos) | Media |
| Offline support | Splid, Settle Up, Splital | Baja |
| Shareable links (sin app) | Settle Up, OneSplit | Media |

---

## Propuesta de Nuevas Features

### AI-First Features

#### 1. Auto-Tagging / Auto-Categorization
**Que:** Categorizar automaticamente cada bill y cada item usando AI al momento del scan.
- Categorias de bill: Restaurante, Supermercado, Bar/Fiesta, Transporte, Servicios, Salud, Entretenimiento
- Tags de items: Bebida, Entrada, Plato fuerte, Postre, Alcohol, Ingrediente, Aseo, etc.

**Competencia:** Divide y Splital lo hacen a nivel de gasto. SplitMyExpenses predice categorias. Ninguno lo hace a nivel de item individual.

**Diferenciador:** Ya tenemos Gemini extrayendo items -- agregar tags al prompt de extraccion tiene costo marginal ~0. Categorizar items individuales es algo que **ninguna** app de la competencia hace.

**Impacto:** Habilita estadisticas, filtrado por tag, y patrones de gasto.

#### 2. AI Spending Insights
**Que:** Dashboard con insights generados por AI sobre patrones de gasto:
- "Gastaste 40% mas en restaurantes este mes vs el anterior"
- "Tu item mas frecuente es cerveza (23 veces en 3 meses)"
- "En promedio gastas $85,000 COP los sabados"
- Tendencias semanales/mensuales con graficos simples

**Competencia:** Solo Divide (AI chat) y SplitMyExpenses (summaries) ofrecen algo similar.

**Diferenciador:** Insights en espanol, contextualizados al mercado colombiano (comparar con promedios locales).

#### 3. Smart Bill Naming
**Que:** AI genera nombre descriptivo del bill basado en items + ubicacion:
- Items: "Hamburguesa, papas, cerveza" + Location: "El Corral Usaquen" --> "Almuerzo en El Corral Usaquen"
- Actualmente el nombre viene de reverse geocoding (solo ubicacion)

**Competencia:** Ninguno lo hace.

**Diferenciador:** Nombre con contexto semantico, no solo geografico.

#### 4. AI Chat / Natural Language Expense Entry
**Que:** "Anoche gastamos 180k en Andres entre 4" --> crea bill con split equal x4, $180,000 COP
- Natural language en espanol
- Crear bills sin foto, solo hablando

**Competencia:** Solo Divide tiene AI chat. Settle Up tiene voice commands basicos.

**Diferenciador:** Espanol colombiano nativo, jerga local ("lucas", "pale", "vaca").

#### 5. Smart Split Suggestions
**Que:** AI sugiere como dividir basado en contexto:
- Detecta items de alcohol y sugiere excluir a quien no tomo
- Sugiere splits basados en historial ("Siempre divides 60/40 con Juan")
- "Este item cuesta 3x el promedio, seguro es para compartir?"

**Competencia:** Ninguno.

#### 6. Receipt Quality Coach
**Que:** Antes de enviar foto a Gemini, AI evalua calidad de la imagen:
- Blur detection, iluminacion, angulo
- Sugerencias: "Acerca mas la camara", "Hay mucho reflejo"
- Reduce scans fallidos (mejor UX + menos gasto de API)

**Competencia:** Ninguno lo hace client-side.

---

### Theming & Styling Features

#### 7. Custom Themes
**Que:** Mas alla de light/dark -- temas con personalidad:
- "Neon" (colores vibrantes, fondo oscuro)
- "Cafe Colombiano" (tonos tierra, cafe, dorado)
- "Minimalista" (blanco/negro puro)
- "Retro Receipt" (monocromo, font de impresora)
- Posibilidad de Pro-only themes

**Competencia:** Solo Tricount y SplitMyExpenses tienen dark mode. Ninguno tiene temas custom.

**Diferenciador:** Personalizacion visual como diferenciador emocional. Temas colombianos como identidad.

#### 8. App Icon Customization
**Que:** Elegir entre variantes del icono de Rondas:
- Default, Dark, Gold/Pro, Neon, Seasonal (Navidad, Halloween)
- Feature comun en apps iOS premium (Apollo, Ivory, Fantastical)

**Competencia:** Ninguna app de splitting lo ofrece.

#### 9. Receipt Infographic Themes
**Que:** Diferentes estilos para el infografico compartido:
- "Recibo clasico" (actual)
- "Moderno" (glassmorphism, gradients)
- "Fun" (stickers, emojis, colores bold)
- "Profesional" (limpio, corporativo)

**Competencia:** Ninguno genera infograficos compartibles (ya es un diferenciador).

---

### Tagging & Tag Management Features

#### 10. Tag Manager
**Que:** Sistema completo de tags para bills e items:
- Tags predefinidos: Restaurante, Bar, Mercado, Transporte, Fiesta, Viaje, etc.
- Tags custom del usuario
- Colores y iconos por tag
- Filtrar bills por tags en home screen
- Tags multiples por bill (e.g., "Viaje" + "Restaurante")

**Competencia:** La mayoria solo tiene categorias fijas (1 por gasto). Ninguno tiene tagging flexible.

**Diferenciador:** Tags multiples + custom + filtrado = mucho mas versatil que categorias fijas.

#### 11. Auto-Tagging con AI
**Que:** Al escanear un bill, AI asigna tags automaticamente:
- Basado en items: cerveza/cocktail --> "Bar", "Alcohol"
- Basado en ubicacion: restaurante conocido --> tag del restaurante
- Basado en hora: 11pm sabado --> "Fiesta", "Noche"
- El usuario puede corregir y el modelo aprende (feedback loop)

**Competencia:** Divide y Splital auto-categorizan, pero con categorias fijas y sin contexto temporal/geografico.

**Diferenciador:** Multi-signal tagging (items + location + time + history) es unico.

#### 12. Contact Tags / Groups
**Que:** Agrupar contactos por contexto:
- "Roommates", "Oficina", "Parceros", "Familia"
- Al crear bill, seleccionar grupo en vez de contactos individuales
- Ver gastos por grupo en estadisticas

**Competencia:** Splitwise tiene grupos persistentes. Otros tienen grupos por viaje/evento.

**Diferenciador:** Tags en contactos (no solo grupos fijos) permite que un contacto este en multiples contextos.

---

## Matriz de Priorizacion

| Feature | Esfuerzo | Impacto | AI-First | Pro Gate | Prioridad |
|---|---|---|---|---|---|
| Auto-Tagging (items + bills) | Bajo | Alto | Si | No (basico) / Si (custom) | P0 |
| Tag Manager | Medio | Alto | No | Custom tags = Pro | P0 |
| AI Spending Insights | Alto | Alto | Si | Si | P1 |
| Custom Themes | Medio | Medio | No | Si (extra themes) | P1 |
| Smart Bill Naming | Bajo | Medio | Si | No | P1 |
| Contact Groups/Tags | Medio | Alto | No | No | P1 |
| Receipt Infographic Themes | Bajo | Medio | No | Si | P2 |
| AI Chat / NL Entry | Alto | Medio | Si | Si | P2 |
| Smart Split Suggestions | Alto | Medio | Si | Si | P2 |
| App Icon Customization | Bajo | Bajo | No | Si | P2 |
| Receipt Quality Coach | Medio | Bajo | Si | No | P3 |

---

## Tendencias del Mercado

1. **Usuarios huyendo de Splitwise** por monetizacion agresiva (ads, limite 5/dia, features core detras de paywall). Oportunidad para capturar usuarios frustrados con free tier generoso.
2. **AI como expectativa, no diferenciador** -- OCR ya es table stakes. El diferenciador es *que haces* con los datos despues del scan (insights, auto-tag, suggestions).
3. **Gen Z quiere personalizacion** -- Divide y Monyo apuntan a estetica juvenil. Theming es engagement driver.
4. **One-time purchase gaining traction** -- Splital ofrece $17.99-$34.99 lifetime como alternativa a suscripcion.
5. **WhatsApp como canal critico en LatAm** -- ninguna app lo aprovecha. Rondas ya tiene ventaja aqui.
6. **Competencia en LATAM emergente** -- Splittier (SoadTech) apunta al mercado hispano con voice entry y personal finance. Traccion minima (50+ descargas) pero valida la demanda.
