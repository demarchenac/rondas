import React from 'react';
import RNCurrencyInput from 'react-native-currency-input';
import { Platform, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';


interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: number;
  onChangeValue: (n: number) => void;
  country: string;
  decimalPlaces?: number;
  className?: string;
}

function CurrencyInput({ value, onChangeValue, country, decimalPlaces, className, ...rest }: CurrencyInputProps) {
  const isCO = country === 'CO';
  const isAndroid = Platform.OS === 'android';
  const precision = decimalPlaces ?? (isCO ? 0 : 2);

  return (
    <RNCurrencyInput
      value={value || null}
      onChangeValue={(v) => onChangeValue(v ?? 0)}
      prefix="$"
      suffix={isCO ? ' COP' : ' USD'}
      delimiter={isCO ? '.' : ','}
      separator={isCO ? ',' : '.'}
      precision={precision}
      minValue={0}
      keyboardType={precision > 0 ? 'decimal-pad' : 'number-pad'}
      className={cn('text-foreground', className)}
      {...rest}
      {...(isAndroid && {
        style: [rest.style, { includeFontPadding: false, textAlignVertical: 'center' as const, paddingVertical: 10 }],
      })}
    />
  );
}

export default React.memo(CurrencyInput);
