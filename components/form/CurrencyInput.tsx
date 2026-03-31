import React from 'react';
import RNCurrencyInput from 'react-native-currency-input';
import type { TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';

interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: number;
  onChangeValue: (n: number) => void;
  country: string;
  className?: string;
}

/**
 * Currency input with live formatting using react-native-currency-input.
 * Configures delimiters per country (CO: dot thousands, US: comma thousands).
 */
function CurrencyInput({ value, onChangeValue, country, className, ...rest }: CurrencyInputProps) {
  const isCO = country === 'CO';

  return (
    <RNCurrencyInput
      value={value || null}
      onChangeValue={(v) => onChangeValue(v ?? 0)}
      prefix="$"
      suffix={isCO ? ' COP' : ' USD'}
      delimiter={isCO ? '.' : ','}
      separator={isCO ? ',' : '.'}
      precision={0}
      minValue={0}
      keyboardType="number-pad"
      className={cn('text-foreground', className)}
      {...rest}
    />
  );
}

export default React.memo(CurrencyInput);
