import { cn } from '@/lib/cn';
import { Platform, TextInput, type TextInputProps } from 'react-native';

function Input({
  className,
  placeholderClassName,
  ...props
}: TextInputProps & React.RefAttributes<TextInput> & { placeholderClassName?: string }) {
  return (
    <TextInput
      className={cn(
        'h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-base text-foreground',
        props.editable === false && 'opacity-50',
        className
      )}
      placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
      {...(Platform.OS === 'android' && {
        style: [{ includeFontPadding: false, textAlignVertical: 'center' }, props.style],
      })}
      {...props}
    />
  );
}

export { Input };
