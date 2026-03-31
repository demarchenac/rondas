import React, { useCallback, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';
import { formatCurrency, parseCurrency } from '@/lib/format';

interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: number;
  onChangeValue: (n: number) => void;
  country: string;
  className?: string;
}

function CurrencyInput({ value, onChangeValue, country, className, ...rest }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(
    value === 0 ? '' : formatCurrency(value, country),
  );

  // Sync from external value changes
  React.useEffect(() => {
    setDisplayValue(value === 0 ? '' : formatCurrency(value, country));
  }, [value, country]);

  const handleChangeText = useCallback(
    (text: string) => {
      const numeric = parseCurrency(text);
      const newFormatted = numeric === 0 ? '' : formatCurrency(numeric, country);
      setDisplayValue(newFormatted);
      onChangeValue(numeric);
    },
    [country, onChangeValue],
  );

  return (
    <TextInput
      value={displayValue}
      onChangeText={handleChangeText}
      keyboardType="number-pad"
      className={cn('text-foreground', className)}
      {...rest}
    />
  );
}

export default React.memo(CurrencyInput);
