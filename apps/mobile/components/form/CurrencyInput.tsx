import React from 'react';
import RNCurrencyInput from 'react-native-currency-input';
import { Platform, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';
import { useColorScheme } from 'react-native';

interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'className'> {
  value: number;
  onChangeValue: (n: number) => void;
  country: string;
  decimalPlaces?: number;
  className?: string;
}

function CurrencyInput({ value, onChangeValue, country, decimalPlaces, className, style, ...rest }: CurrencyInputProps) {
  const isCO = country === 'CO';
  const isAndroid = Platform.OS === 'android';
  const precision = decimalPlaces ?? (isCO ? 0 : 2);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const baseStyle: StyleProp<TextStyle> = [
    { color: isDark ? '#f8fafc' : '#0f172a' },
    style,
    isAndroid && { includeFontPadding: false, textAlignVertical: 'center' as const, paddingVertical: 10 },
  ];

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
      style={baseStyle}
      {...rest}
    />
  );
}

export default React.memo(CurrencyInput);
