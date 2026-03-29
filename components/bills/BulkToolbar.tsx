import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useT } from '@/lib/i18n';

interface BulkToolbarProps {
  selectedItemIds: Set<string>;
  hasContactsOnSelection: boolean;
  onAssign: () => void;
  onUnassign: () => void;
  onDelete: () => void;
}

function BulkToolbar({ selectedItemIds, hasContactsOnSelection, onAssign, onUnassign, onDelete }: BulkToolbarProps) {
  const t = useT();

  if (selectedItemIds.size === 0) return null;

  return (
    <View className="border-t border-border/30 px-7 pb-2 pt-3">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Assign contact */}
        <Pressable
          onPress={onAssign}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(56, 189, 248, 0.2)',
          }}
        >
          <IconSymbol name="person.crop.circle" size={16} color="#38bdf8" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#38bdf8' }}>{t.bulk_assign}</Text>
        </Pressable>

        {/* Remove contact — only if any selected item has contacts */}
        {hasContactsOnSelection && (
          <Pressable
            onPress={onUnassign}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.2)',
            }}
          >
            <IconSymbol name="person.crop.circle" size={16} color="#f59e0b" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#f59e0b' }}>{t.bulk_unassign}</Text>
          </Pressable>
        )}

        {/* Delete items */}
        <Pressable
          onPress={onDelete}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.2)',
          }}
        >
          <IconSymbol name="xmark" size={14} color="#ef4444" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>{t.bulk_delete}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default BulkToolbar;
