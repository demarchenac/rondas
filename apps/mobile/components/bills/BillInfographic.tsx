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
    <View className="bg-[#fafaf8] overflow-hidden" style={{
      width: PAPER_WIDTH,
      height: PERF_HEIGHT,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className="absolute rounded-full"
          style={{
            width: PERF_SIZE,
            height: PERF_SIZE,
            backgroundColor: BG_COLOR,
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
    <View className="flex-row items-center my-[14px]">
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} className="h-px rounded-[0.5px] flex-1 mx-[1.5px] bg-[#e2e8f0]" />
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
      <View className="relative self-center" style={{ width: PAPER_WIDTH }}>
        {/* Perforated top edge — absolute, behind paper */}
        <View className="absolute top-0 left-0 z-0">
          <ReceiptPerforations position="top" />
        </View>

        {/* Perforated bottom edge — absolute, behind paper */}
        <View className="absolute bottom-0 left-0 z-0">
          <ReceiptPerforations position="bottom" />
        </View>

        {/* Receipt paper — on top, overlapping perforations by 1px */}
        <View className="bg-[#fafaf8] z-[1]" style={{ marginVertical: PERF_HEIGHT - 1 }}>
          <View className="px-7 pt-[22px] pb-5">

          {/* Header: Brand + Country badge */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-[13px] font-extrabold text-[#0a7ea4] tracking-[4px] uppercase">
              Rondas
            </Text>
            <View className="flex-row items-center gap-1 bg-[#f1f5f9] px-2 py-[3px] rounded-[6px]">
              <Text className="text-xs">{flag}</Text>
              <Text className="text-[9px] font-bold text-[#64748b] tracking-[0.5px]">
                {country === 'CO' ? 'COP' : 'USD'}
              </Text>
            </View>
          </View>

          {/* Venue */}
          <View className="mb-1">
            <Text className="text-xl font-extrabold text-[#0f172a]">
              {billName}
            </Text>
            {location && !location.startsWith(billName) && (
              <Text className="text-[10px] text-[#94a3b8] mt-[3px]" numberOfLines={2}>
                {location}
              </Text>
            )}
            {dateStr && (
              <Text className="text-[10px] text-[#94a3b8] mt-[2px]">
                {dateStr}
              </Text>
            )}
          </View>

          <ReceiptDotLine />

          {/* Bill for contact */}
          <View className="flex-row items-center gap-[10px] mb-4">
            {contactImageUri ? (
              <Image source={{ uri: contactImageUri }} className="w-8 h-8 rounded-full" />
            ) : (
              <View className="w-8 h-8 rounded-full bg-[#e0f2fe] items-center justify-center">
                <Text className="text-[13px] font-bold text-[#0a7ea4]">
                  {contactName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View>
              <Text className="text-[8px] text-[#94a3b8] font-semibold tracking-[1.5px] uppercase">{t.infographic_billFor}</Text>
              <Text className="text-sm font-bold text-[#0f172a]">{contactName}</Text>
            </View>
          </View>

          {/* Column headers */}
          <View className="flex-row justify-between pb-[6px] border-b-[1.5px] border-b-[#e2e8f0]">
            <Text className="text-[8px] font-bold text-[#94a3b8] tracking-[1.5px] uppercase">{t.infographic_item}</Text>
            <Text className="text-[8px] font-bold text-[#94a3b8] tracking-[1.5px] uppercase">{t.infographic_amount}</Text>
          </View>

          {/* Items */}
          {items.map((item, i) => (
            <View
              key={i}
              className="flex-row justify-between items-center py-[9px] border-b border-b-[#f1f5f9]"
            >
              <Text className="text-[13px] text-[#334155] flex-1 mr-3" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-[13px] font-bold text-[#0f172a]" style={{ fontVariant: ['tabular-nums'] }}>
                {formatCurrency(item.amount, country)}
              </Text>
            </View>
          ))}

          {/* Breakdown */}
          <View className="mt-2 gap-[2px]">
            <View className="flex-row justify-between py-1">
              <Text className="text-[11px] text-[#94a3b8]">{t.bill_subtotal}</Text>
              <Text className="text-[11px] text-[#64748b] font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(contactBase, country)}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-[11px] text-[#94a3b8]">{translatedTaxLabel}</Text>
              <Text className="text-[11px] text-[#64748b] font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(contactTax, country)}</Text>
            </View>
            <View className="flex-row justify-between py-1 border-t-[0.5px] border-t-[#e2e8f0] mt-[2px]">
              <Text className="text-[11px] text-[#64748b] font-semibold">{t.bill_beforeTip}</Text>
              <Text className="text-[11px] text-[#64748b] font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(contactBase + contactTax, country)}</Text>
            </View>
            {tipPercent > 0 && (
              <View className="flex-row justify-between py-1">
                <Text className="text-[11px] text-[#94a3b8]">{t.bill_tip(tipPercent)}</Text>
                <Text className="text-[11px] text-[#64748b] font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(contactTip, country)}</Text>
              </View>
            )}
          </View>

          <ReceiptDotLine />

          {/* Total */}
          <View className="flex-row justify-between items-baseline">
            <Text className="text-sm font-extrabold text-[#0f172a] tracking-[1px] uppercase">{t.infographic_total}</Text>
            <Text
              className="text-[22px] font-extrabold text-[#0a7ea4] shrink text-right"
              style={{ fontVariant: ['tabular-nums'] }}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.7}
            >
              {formatCurrency(contactTotal, country)}
            </Text>
          </View>

          <ReceiptDotLine />

          {/* Footer */}
          <View className="items-center gap-1">
            <Text className="text-[9px] text-[#94a3b8] italic">{t.infographic_tagline}</Text>
            <Text className="text-[8px] text-[#cbd5e1]">rondas.app</Text>
          </View>
        </View>
      </View>
      </View>
    </View>
  );
}

export default React.memo(BillInfographic);
