import { cn } from '@/lib/cn';
import { Platform, TextInput, type TextInputProps } from 'react-native';


function Input({
  className,
  placeholderClassName,
  ...props
}: TextInputProps & React.RefAttributes<TextInput> & { placeholderClassName?: string }) {
  const isAndroid = Platform.OS === 'android';
  return (
    <TextInput

      className={cn(
        'w-full rounded-md border border-input bg-background px-3 text-base text-foreground',
        isAndroid ? 'py-2.5' : 'h-10 py-1',
        props.editable === false && 'opacity-50',
        className
      )}
      placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
      {...props}
      {...(isAndroid && {
        style: [props.style, { includeFontPadding: false, textAlignVertical: 'center' as const }],
      })}
    />
  );
}

export { Input };
