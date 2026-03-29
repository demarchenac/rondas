import React from 'react';
import { View, Image } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { Text } from './text';
import { cn } from '@/lib/cn';

const avatarVariants = cva('items-center justify-center rounded-full bg-primary/10', {
  variants: {
    size: {
      sm: 'h-7 w-7',
      md: 'h-9 w-9',
      lg: 'h-10 w-10',
    },
  },
  defaultVariants: { size: 'md' },
});

const textVariants = cva('font-bold text-primary', {
  variants: {
    size: {
      sm: 'text-[10px]',
      md: 'text-xs',
      lg: 'text-sm',
    },
  },
  defaultVariants: { size: 'md' },
});

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  imageUri?: string;
  className?: string;
}

function Avatar({ name, imageUri, size, className }: AvatarProps) {
  if (imageUri) {
    return <Image source={{ uri: imageUri }} className={cn(avatarVariants({ size }), className)} />;
  }
  return (
    <View className={cn(avatarVariants({ size }), className)}>
      <Text className={textVariants({ size })}>
        {(name[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export default React.memo(Avatar);
