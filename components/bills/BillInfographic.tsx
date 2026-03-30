import React from 'react';
import { View, Text, Image } from 'react-native';
import { formatCurrency } from '@/lib/format';
import { computeBase, computeTax, type TaxConfig } from '@/constants/taxes';
import type { Translations } from '@/lib/i18n';

const RECEIPT_WIDTH = 460;
const RECEIPT_PADDING = 20;
const PAPER_WIDTH = RECEIPT_WIDTH - RECEIPT_PADDING * 2;
const BG_COLOR = '#e8e4df';

const PERF_SIZE = 11;
const PERF_HEIGHT = PERF_SIZE / 2;

const TAX_LABEL_MAP: Record<string, keyof Translations> = {
  'Impoconsumo (included)': 'tax_impoconsumo',
  'IVA (included)': 'tax_iva',
  'Sales Tax': 'tax_salesTax',
};

function getTaxLabel(taxConfig: TaxConfig, t: Translations): string {
  const key = TAX_LABEL_MAP[taxConfig.taxLabel];
  return key ? (t[key] as string) : taxConfig.taxLabel;
}

function ReceiptPerforations({ position }: { position: 'top' | 'bottom' }) {
  const gap = 3;
  const count = Math.floor(PAPER_WIDTH / (PERF_SIZE + gap));
  const totalWidth = count * (PERF_SIZE + gap) - gap;
  const offset = (PAPER_WIDTH - totalWidth) / 2;
  return (
    <View style={{
      width: PAPER_WIDTH,
      height: PERF_HEIGHT,
      backgroundColor: '#fafaf8',
      overflow: 'hidden',
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: PERF_SIZE,
            height: PERF_SIZE,
            borderRadius: PERF_SIZE / 2,
            backgroundColor: BG_COLOR,
            position: 'absolute',
            left: offset + i * (PERF_SIZE + gap),
            top: position === 'top' ? -(PERF_SIZE / 2) : 0,
          }}
        />
      ))}
    </View>
  );
}

function ReceiptDotLine() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 14 }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} style={{ height: 1, borderRadius: 0.5, flex: 1, marginHorizontal: 1.5, backgroundColor: '#e2e8f0' }} />
      ))}
    </View>
  );
}

function BillInfographic({
  billName,
  contactName,
  contactImageUri,
  items,
  taxConfig: infTaxConfig,
  tipPercent,
  location,
  date,
  country,
  t,
}: {
  billName: string;
  contactName: string;
  contactImageUri?: string;
  items: { name: string; amount: number }[];
  taxConfig: TaxConfig;
  tipPercent: number;
  location?: string;
  date: string;
  country: 'CO' | 'US';
  t: Translations;
}) {
  const d = new Date(date);
  const isValidDate = !isNaN(d.getTime());
  const locale = country === 'US' ? 'en-US' : 'es-CO';
  const dateStr = isValidDate
    ? d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const contactItemsTotal = items.reduce((sum, i) => sum + i.amount, 0);
  const contactBase = computeBase(contactItemsTotal, infTaxConfig);
  const contactTax = computeTax(contactItemsTotal, infTaxConfig);
  const contactTip = Math.round(contactBase * (tipPercent / 100));
  const contactTotal = contactBase + contactTax + contactTip;

  const translatedTaxLabel = getTaxLabel(infTaxConfig, t);
  const flag = country === 'CO' ? '\u{1F1E8}\u{1F1F4}' : '\u{1F1FA}\u{1F1F8}';

  return (
    <View style={{ width: RECEIPT_WIDTH, backgroundColor: BG_COLOR, paddingVertical: RECEIPT_PADDING }}>
      <View style={{ position: 'relative', alignSelf: 'center', width: PAPER_WIDTH }}>
        {/* Perforated top edge — absolute, behind paper */}
        <View style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
          <ReceiptPerforations position="top" />
        </View>

        {/* Perforated bottom edge — absolute, behind paper */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 0 }}>
          <ReceiptPerforations position="bottom" />
        </View>

        {/* Receipt paper — on top, overlapping perforations by 1px */}
        <View style={{ backgroundColor: '#fafaf8', zIndex: 1, marginVertical: PERF_HEIGHT - 1 }}>
          <View style={{ paddingHorizontal: 28, paddingTop: 22, paddingBottom: 20 }}>

          {/* Header: Brand + Country badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0a7ea4', letterSpacing: 4, textTransform: 'uppercase' }}>
              Rondas
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 12 }}>{flag}</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#64748b', letterSpacing: 0.5 }}>
                {country === 'CO' ? 'COP' : 'USD'}
              </Text>
            </View>
          </View>

          {/* Venue */}
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>
              {billName}
            </Text>
            {location && !location.startsWith(billName) && (
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }} numberOfLines={2}>
                {location}
              </Text>
            )}
            {dateStr && (
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                {dateStr}
              </Text>
            )}
          </View>

          <ReceiptDotLine />

          {/* Bill for contact */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {contactImageUri ? (
              <Image source={{ uri: contactImageUri }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0a7ea4' }}>
                  {contactName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.infographic_billFor}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>{contactName}</Text>
            </View>
          </View>

          {/* Column headers */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0' }}>
            <Text style={{ fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.infographic_item}</Text>
            <Text style={{ fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t.infographic_amount}</Text>
          </View>

          {/* Items */}
          {items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 9,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}
            >
              <Text style={{ fontSize: 13, color: '#334155', flex: 1, marginRight: 12 }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', fontVariant: ['tabular-nums'] }}>
                {formatCurrency(item.amount, country)}
              </Text>
            </View>
          ))}

          {/* Breakdown */}
          <View style={{ marginTop: 8, gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>{t.bill_subtotal}</Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(contactBase, country)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>{translatedTaxLabel}</Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(contactTax, country)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', marginTop: 2 }}>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{t.bill_beforeTip}</Text>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(contactBase + contactTax, country)}</Text>
            </View>
            {tipPercent > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>{t.bill_tip(tipPercent)}</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatCurrency(contactTip, country)}</Text>
              </View>
            )}
          </View>

          <ReceiptDotLine />

          {/* Total */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', letterSpacing: 1, textTransform: 'uppercase' }}>{t.infographic_total}</Text>
            <Text
              style={{ fontSize: 22, fontWeight: '800', color: '#0a7ea4', fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' }}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.7}
            >
              {formatCurrency(contactTotal, country)}
            </Text>
          </View>

          <ReceiptDotLine />

          {/* Footer */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>{t.infographic_tagline}</Text>
            <Text style={{ fontSize: 8, color: '#cbd5e1' }}>rondas.app</Text>
          </View>
        </View>
      </View>
      </View>
    </View>
  );
}

export default BillInfographic;
