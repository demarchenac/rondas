import React from 'react';
import { View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';

function BillCardSkeleton() {
  return (
    <View className="rounded-[20px] bg-muted-foreground/[0.03] px-4 py-3" style={{ gap: 8 }}>
      <View className="flex-row items-center justify-between">
        <Skeleton width={128} height={16} borderRadius={6} />
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>
      <Skeleton width={160} height={28} borderRadius={6} />
      <View className="flex-row items-center justify-between">
        <Skeleton width={96} height={12} borderRadius={6} />
        <View className="flex-row items-center gap-1">
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={24} height={24} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

export default React.memo(BillCardSkeleton);
