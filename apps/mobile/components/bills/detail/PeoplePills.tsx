import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Avatar from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { Id } from '@convex/_generated/dataModel';
import type { Translations } from '@/lib/i18n';
import type { IconPalette } from '@/constants/colors';

interface ContactWithTotal {
  contactId: Id<'contacts'>;
  name: string;
  imageUri?: string;
  isSelf?: boolean;
  paid: boolean;
  total: number;
}

export function ContactPill({
  contact, billCountry, decimalPlaces, iconColors, t, onPress,
}: {
  contact: ContactWithTotal;
  billCountry: string;
  decimalPlaces?: number;
  iconColors: IconPalette;
  t: Translations;
  onPress: (contactId: Id<'contacts'>) => void;
}) {
  return (
    <Animated.View layout={LinearTransition}>
      <Pressable
        onPress={() => onPress(contact.contactId)}
        className={cn('w-[160px] rounded-xl border-l-[3px] bg-card px-3.5 py-3 active:opacity-80', contact.paid ? 'border-l-emerald-500' : 'border-l-amber-500')}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="rounded-full border-2 border-card">
            <Avatar name={contact.name} imageUri={contact.imageUri} size="sm" />
          </View>
          <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
            {contact.isSelf ? t.self_label(contact.name) : contact.name}
          </Text>
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(contact.total, billCountry, decimalPlaces)}
          </Text>
          <IconSymbol name={contact.paid ? 'checkmark.circle.fill' : 'circle'} size={16} color={contact.paid ? '#10b981' : iconColors.mutedLight} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

interface GroupWithData {
  id: string;
  name: string;
  members: ContactWithTotal[];
  total: number;
  allMembersPaid: boolean;
  tint: { bg: string; border: string };
}

export function GroupPill({
  group, billCountry, decimalPlaces, iconColors, onPress,
  editingNameGroupId, editingNameValue, onEditingNameChange, onNameSave, onNameEdit,
}: {
  group: GroupWithData;
  billCountry: string;
  decimalPlaces?: number;
  iconColors: IconPalette;
  onPress: (groupId: string) => void;
  editingNameGroupId: string | null;
  editingNameValue: string;
  onEditingNameChange: (value: string) => void;
  onNameSave: () => void;
  onNameEdit: (groupId: string, name: string) => void;
}) {
  return (
    <Animated.View layout={LinearTransition}>
      <Pressable
        onPress={() => onPress(group.id)}
        className={cn('w-[160px] rounded-xl border-l-[3px] px-3.5 py-3 active:opacity-80', group.tint.bg, group.allMembersPaid ? 'border-l-emerald-500' : 'border-l-amber-500')}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="flex-row">
            {group.members.slice(0, 3).map((member, idx) => (
              <View key={String(member.contactId)} style={{ marginLeft: idx > 0 ? -8 : 0, zIndex: 3 - idx }} className="rounded-full border-2 border-card">
                <Avatar name={member.name} imageUri={member.imageUri} size="sm" />
              </View>
            ))}
            {group.members.length > 3 && (
              <View style={{ marginLeft: -8, zIndex: 0 }} className="h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted">
                <Text className="text-[10px] font-bold text-muted-foreground">+{group.members.length - 3}</Text>
              </View>
            )}
          </View>
          <View className="flex-1">
            {editingNameGroupId === group.id ? (
              <TextInput value={editingNameValue} onChangeText={onEditingNameChange} onBlur={onNameSave} onSubmitEditing={onNameSave} autoFocus className="h-5 p-0 text-sm font-semibold text-foreground" returnKeyType="done" />
            ) : (
              <Pressable onPress={() => onNameEdit(group.id, group.name)}>
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{group.name}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(group.total, billCountry, decimalPlaces)}</Text>
          <IconSymbol name={group.allMembersPaid ? 'checkmark.circle.fill' : 'circle'} size={16} color={group.allMembersPaid ? '#10b981' : iconColors.mutedLight} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function SelectablePill({
  contact, isSelected, billCountry, decimalPlaces, iconColors, t, onToggle,
}: {
  contact: ContactWithTotal;
  isSelected: boolean;
  billCountry: string;
  decimalPlaces?: number;
  iconColors: IconPalette;
  t: Translations;
  onToggle: (contactId: string) => void;
}) {
  return (
    <Animated.View layout={LinearTransition}>
      <Pressable
        onPress={() => onToggle(String(contact.contactId))}
        className={cn('w-[160px] rounded-xl border-l-[3px] bg-card px-3.5 py-3 active:opacity-80', isSelected ? 'border-l-primary' : 'border-l-muted')}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="rounded-full border-2 border-card">
            <Avatar name={contact.name} imageUri={contact.imageUri} size="sm" />
          </View>
          <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
            {contact.isSelf ? t.self_label(contact.name) : contact.name}
          </Text>
          <Animated.View entering={FadeIn.duration(200)}>
            <IconSymbol name={isSelected ? 'checkmark.circle.fill' : 'circle'} size={16} color={isSelected ? iconColors.primary : iconColors.mutedLight} />
          </Animated.View>
        </View>
        <View className="mt-2">
          <Text className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(contact.total, billCountry, decimalPlaces)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function CollapsedGroupPill({
  group, t, onExpand,
}: {
  group: GroupWithData;
  t: Translations;
  onExpand: (groupId: string) => void;
}) {
  return (
    <Animated.View layout={LinearTransition}>
      <Pressable
        onPress={() => onExpand(group.id)}
        className={cn('w-[160px] rounded-xl border-l-[3px] px-3.5 py-3 active:opacity-80', group.tint.bg, group.tint.border)}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="flex-row">
            {group.members.slice(0, 2).map((member, idx) => (
              <View key={String(member.contactId)} style={{ marginLeft: idx > 0 ? -8 : 0, zIndex: 2 - idx }} className="rounded-full border-2 border-card">
                <Avatar name={member.name} imageUri={member.imageUri} size="sm" />
              </View>
            ))}
          </View>
          <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>{group.name}</Text>
        </View>
        <Text className="mt-2 text-xs text-muted-foreground">{t.a11y_tapToEdit}</Text>
      </Pressable>
    </Animated.View>
  );
}
