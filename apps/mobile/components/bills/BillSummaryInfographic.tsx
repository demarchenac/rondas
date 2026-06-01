import React from 'react';
import { View, Text, Image } from 'react-native';
import { formatCurrency } from '@/lib/format';
import type { Translations } from '@/lib/i18n';

const RECEIPT_WIDTH = 460;
const RECEIPT_PADDING = 20;
const PAPER_WIDTH = RECEIPT_WIDTH - RECEIPT_PADDING * 2;
const BG_COLOR = '#e8e4df';
const PERF_SIZE = 11;
const PERF_HEIGHT = PERF_SIZE / 2;

function ReceiptPerforations({ position }: { position: 'top' | 'bottom' }) {
  const gap = 3;
  const count = Math.floor(PAPER_WIDTH / (PERF_SIZE + gap));
  const totalWidth = count * (PERF_SIZE + gap) - gap;
  const offset = (PAPER_WIDTH - totalWidth) / 2;
  return (
    <View className="bg-[#fafaf8] overflow-hidden" style={{ width: PAPER_WIDTH, height: PERF_HEIGHT }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className="absolute rounded-full"
          style={{
            width: PERF_SIZE, height: PERF_SIZE, backgroundColor: BG_COLOR,
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

interface ContactEntry {
  name: string;
  imageUri?: string;
  amount: number;
  paid: boolean;
}

function BillSummaryInfographic({
  billName, contacts, billTotal, location, date, country, decimalPlaces, t,
}: {
  billName: string;
  contacts: ContactEntry[];
  billTotal: number;
  location?: string;
  date: string;
  country: 'CO' | 'US';
  decimalPlaces?: number;
  t: Translations;
}) {
  const d = new Date(date);
  const isValidDate = !isNaN(d.getTime());
  const locale = country === 'US' ? 'en-US' : 'es-CO';
  const dateStr = isValidDate
    ? d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const flag = country === 'CO' ? '\u{1F1E8}\u{1F1F4}' : '\u{1F1FA}\u{1F1F8}';
  const paidCount = contacts.filter((c) => c.paid).length;

  return (
    <View style={{ width: RECEIPT_WIDTH, backgroundColor: BG_COLOR, paddingVertical: RECEIPT_PADDING }}>
      <View className="relative self-center" style={{ width: PAPER_WIDTH }}>
        <View className="absolute top-0 left-0 z-0">
          <ReceiptPerforations position="top" />
        </View>
        <View className="absolute bottom-0 left-0 z-0">
          <ReceiptPerforations position="bottom" />
        </View>

        <View className="bg-[#fafaf8] z-[1]" style={{ marginVertical: PERF_HEIGHT - 1 }}>
          <View className="px-7 pt-[22px] pb-5">

            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-sm font-extrabold text-[#0a7ea4] tracking-[4px] uppercase">
                Rondas
              </Text>
              <View className="flex-row items-center gap-1 bg-[#f1f5f9] px-2 py-[3px] rounded-[6px]">
                <Text className="text-sm">{flag}</Text>
                <Text className="text-sm font-bold text-[#64748b] tracking-[0.5px]">
                  {country === 'CO' ? 'COP' : 'USD'}
                </Text>
              </View>
            </View>

            <View className="mb-1">
              <Text className="text-2xl font-extrabold text-[#0f172a]">{billName}</Text>
              {location && !location.startsWith(billName) && (
                <Text className="text-sm text-[#94a3b8] mt-[3px]" numberOfLines={2}>{location}</Text>
              )}
              {dateStr && (
                <Text className="text-sm text-[#94a3b8] mt-[2px]">{dateStr}</Text>
              )}
            </View>

            <ReceiptDotLine />

            <Text className="text-[11px] text-[#94a3b8] font-semibold tracking-[1.5px] uppercase mb-3">
              {t.infographic_splitSummary}
            </Text>

            <View className="flex-row justify-between pb-[6px] border-b-[1.5px] border-b-[#e2e8f0]">
              <Text className="text-[11px] font-bold text-[#94a3b8] tracking-[1.5px] uppercase">{t.infographic_person}</Text>
              <Text className="text-[11px] font-bold text-[#94a3b8] tracking-[1.5px] uppercase">{t.infographic_amount}</Text>
            </View>

            {contacts.map((contact, i) => (
              <View key={i} className="flex-row items-center py-[9px] border-b border-b-[#f1f5f9]">
                {contact.imageUri ? (
                  <Image source={{ uri: contact.imageUri }} className="w-6 h-6 rounded-full mr-2" />
                ) : (
                  <View className="w-6 h-6 rounded-full bg-[#e0f2fe] items-center justify-center mr-2">
                    <Text className="text-[10px] font-bold text-[#0a7ea4]">
                      {contact.name[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
                <Text className="text-sm text-[#334155] flex-1 mr-2" numberOfLines={1}>
                  {contact.name}
                </Text>
                <Text className="text-[11px] mr-2" style={{ color: contact.paid ? '#10b981' : '#94a3b8' }}>
                  {contact.paid ? '✓' : '○'}
                </Text>
                <Text className="text-sm font-bold text-[#0f172a]" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(contact.amount, country, decimalPlaces)}
                </Text>
              </View>
            ))}

            <View className="mt-2 flex-row justify-end">
              <Text className="text-[11px] text-[#94a3b8]">
                {paidCount}/{contacts.length} {t.share_paid.toLowerCase()}
              </Text>
            </View>

            <ReceiptDotLine />

            <View className="flex-row justify-between items-baseline">
              <Text className="text-base font-extrabold text-[#0f172a] tracking-[1px] uppercase">{t.infographic_total}</Text>
              <Text
                className="text-[24px] font-extrabold text-[#0a7ea4] shrink text-right"
                style={{ fontVariant: ['tabular-nums'] }}
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.7}
              >
                {formatCurrency(billTotal, country, decimalPlaces)}
              </Text>
            </View>

            <ReceiptDotLine />

            <View className="items-center gap-1">
              <Text className="text-sm text-[#94a3b8] italic">{t.infographic_tagline}</Text>
              <Text className="text-[11px] text-[#cbd5e1]">rondas.app</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default React.memo(BillSummaryInfographic);
