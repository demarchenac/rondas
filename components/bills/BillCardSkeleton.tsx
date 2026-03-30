import React from 'react';
import { View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';

function BillCardSkeleton() {
  return (
    <View className="rounded-xl border-l-[3px] border-l-muted bg-card px-4 py-3.5">
      {/* Top row: name + badge */}
      <View className="flex-row items-center justify-between">
        <Skeleton width="60%" height={18} />
        <Skeleton width={60} height={20} borderRadius={10} />
      </View>
      {/* Bottom row: amount + avatars */}
      <View className="mt-2 flex-row items-end justify-between">
        <View>
          <Skeleton width={120} height={24} />
          <Skeleton width={100} height={12} style={{ marginTop: 4 }} />
        </View>
        <View className="flex-row">
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              width={26}
              height={26}
              borderRadius={13}
              style={i > 0 ? { marginLeft: -8 } : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default React.memo(BillCardSkeleton);
