# Pricing Schema — Rondas Pro

## Precios regionalizados

| Region | Precio/mes | USD equiv. | Precio anual sugerido | Descuento anual |
|---|---|---|---|---|
| Colombia | $9.900 COP | ~$2.30 | $89.900 COP/año | ~25% |
| USA | $4.99 USD | $4.99 | $44.99 USD/año | ~25% |
| Latam (MX, AR, CL, PE, BR) | ~$3.49 USD equiv. | $3.49 | $31.49 USD/año | ~25% |
| Europa / otros | $4.49 USD | $4.49 | $40.49 USD/año | ~25% |

## Margen neto por region (mensual, con 15% store fee)

| Region | Precio | Store fee (15%) | Costo infra avg | Neto/usuario | Margen |
|---|---|---|---|---|---|
| Colombia | $2.30 | -$0.35 | -$0.15 | $1.80 | ~78% |
| USA | $4.99 | -$0.75 | -$0.15 | $4.09 | ~82% |
| Latam | $3.49 | -$0.52 | -$0.15 | $2.82 | ~81% |
| Europa | $4.49 | -$0.67 | -$0.15 | $3.67 | ~82% |

## Costos variables por usuario Pro activo/mes

| Servicio | Costo estimado | Notas |
|---|---|---|
| Gemini 2.5 Flash (thinking_budget: 512) | ~$0.03-0.05 | ~10 scans/mes, reducido 40% vs budget 1024 |
| Convex | ~$0.02-0.05 | ~50-100 ops/bill, ~10 bills/mes |
| Google Places | ~$0.00-0.01 | Solo fallback, nativo resuelve ~90% |
| WorkOS, Sentry, Resend, WhatsApp | $0.00 | Free tiers cubren early stage |

## Costos fijos (al superar free tiers)

| Servicio | Costo mensual | Se activa al superar... | Usuarios Pro para cubrir |
|---|---|---|---|
| Convex Pro | ~$25 USD | 1M calls/mes (~2K usuarios totales) | ~14 |
| Sentry Team | ~$29 USD | 5K events/mes (~5K usuarios totales) | ~16 |
| Resend Pro | ~$20 USD | 100 emails/dia | ~11 |
| RevenueCat | 1% del MRR | $2.5K MRR (~1.087 Pro users) | N/A (porcentual) |

## Escalamiento

| Escala | Pro users | Revenue/mes (USD) | Neto/mes (USD) | Neto/año (USD) | Margen |
|---|---|---|---|---|---|
| Arranque | 20 | $46 | $37 | $449 | 81% |
| Traccion | 100 | $230 | $188 | $2.251 | 82% |
| Estable | 500 | $1.151 | $913 | $10.960 | 79% |
| Crecimiento | 2.000 | $4.605 | $3.634 | $43.605 | 79% |
| Escala alta | 10.000 | $23.023 | $14.936 | $179.228 | 65% |

Nota: Escala alta asume 30% store fee (revenue anual > $1M USD).

## Punto critico: store fee 30%

Cuando el revenue anual supera $1M USD (~36.200 Pro users), Apple/Google suben la comision de 15% a 30%. El margen baja de ~79% a ~65%.

## Implementacion

Los precios regionalizados se configuran via:
- **RevenueCat**: Offerings por pais (resuelve el precio correcto segun storefront)
- **App Store Connect**: Price tiers localizados por pais
- **Google Play Console**: Precios por pais

No requiere logica de codigo diferente — el SDK de RevenueCat maneja la regionalizacion automaticamente.
