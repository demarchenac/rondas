import React from 'react';
import { View } from 'react-native';
import { Image } from '@/lib/expo-image';
import { cva, type VariantProps } from 'class-variance-authority';
import { Text } from './text';
import { cn } from '@/lib/cn';

const avatarVariants = cva('items-center justify-center rounded-full bg-primary/10', {
  variants: {
    size: {
      xs: 'h-[26px] w-[26px]',
      sm: 'h-6 w-6',
      md: 'h-9 w-9',
      lg: 'h-10 w-10',
      xl: 'h-20 w-20',
    },
  },
  defaultVariants: { size: 'md' },
});

const textVariants = cva('font-bold text-primary', {
  variants: {
    size: {
      xs: 'text-sm',
      sm: 'text-sm',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-4xl',
    },
  },
  defaultVariants: { size: 'md' },
});

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  imageUri?: string;
  className?: string;
  bgClassName?: string;
  textClassName?: string;
}

function Avatar({ name, imageUri, size, className, bgClassName, textClassName }: AvatarProps) {
  if (imageUri) {
    return <Image source={{ uri: imageUri }} className={cn(avatarVariants({ size }), className)} />;
  }
  return (
    <View className={cn(avatarVariants({ size }), bgClassName, className)}>
      <Text className={cn(textVariants({ size }), textClassName)}>
        {(name[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export default React.memo(Avatar);
