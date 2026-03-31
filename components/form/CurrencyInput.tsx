import React, { useCallback, useRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';
import { formatCurrency, parseCurrency } from '@/lib/format';

function countDigitsBefore(text: string, position: number): number {
  let count = 0;
  for (let i = 0; i < position && i < text.length; i++) {
    if (/\d/.test(text[i])) count++;
  }
  return count;
}

function findPositionForDigitCount(text: string, digitCount: number): number {
  if (digitCount === 0) {
    // Place cursor before the first digit
    for (let i = 0; i < text.length; i++) {
      if (/\d/.test(text[i])) return i;
    }
    return 0;
  }
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i])) count++;
    if (count === digitCount) return i + 1;
  }
  return text.length;
}

interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: number;
  onChangeValue: (n: number) => void;
  country: string;
  className?: string;
}

function CurrencyInput({ value, onChangeValue, country, className, ...rest }: CurrencyInputProps) {
  const formatted = value === 0 ? '' : formatCurrency(value, country);
  const [displayValue, setDisplayValue] = useState(formatted);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const cursorRef = useRef(0);

  // Sync from external value changes
  React.useEffect(() => {
    const newFormatted = value === 0 ? '' : formatCurrency(value, country);
    setDisplayValue(newFormatted);
  }, [value, country]);

  const handleChangeText = useCallback(
    (text: string) => {
      const numeric = parseCurrency(text);
      const newFormatted = numeric === 0 ? '' : formatCurrency(numeric, country);

      // Digit-counting cursor management
      const digitsBefore = countDigitsBefore(text, cursorRef.current);
      const newCursorPos = newFormatted
        ? findPositionForDigitCount(newFormatted, digitsBefore)
        : 0;

      setDisplayValue(newFormatted);
      setSelection({ start: newCursorPos, end: newCursorPos });
      onChangeValue(numeric);
    },
    [country, onChangeValue],
  );

  const handleSelectionChange = useCallback(
    (e: { nativeEvent: { selection: { start: number; end: number } } }) => {
      cursorRef.current = e.nativeEvent.selection.start;
      // Clear controlled selection after it's been applied to avoid fighting with user taps
      if (selection) setSelection(undefined);
    },
    [selection],
  );

  return (
    <TextInput
      value={displayValue}
      onChangeText={handleChangeText}
      onSelectionChange={handleSelectionChange}
      selection={selection}
      keyboardType="number-pad"
      className={cn('text-foreground', className)}
      {...rest}
    />
  );
}

export default React.memo(CurrencyInput);
