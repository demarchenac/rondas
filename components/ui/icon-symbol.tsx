// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

// SymbolViewProps['name'] can be a union with platform-specific objects in newer
// expo-symbols; extract only the string form for use as a Record key.
type SFSymbolString = Extract<SymbolViewProps['name'], string>;
type IconMapping = Record<SFSymbolString, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'gearshape.fill': 'settings',
  'plus': 'add',
  'camera.fill': 'camera-alt',
  'photo.fill': 'photo-library',
  'person.crop.circle': 'account-circle',
  'sun.max.fill': 'light-mode',
  'moon.fill': 'dark-mode',
  'globe': 'language',
  'rectangle.portrait.and.arrow.right': 'logout',
  'crown.fill': 'workspace-premium',
  'line.3.horizontal.decrease': 'filter-list',
  'xmark': 'close',
  'receipt': 'receipt-long',
  'info.circle': 'info-outline',
  'globe.americas.fill': 'public',
  'map.fill': 'map',
  'clock.fill': 'schedule',
  'lock.fill': 'lock',
  'location.fill': 'location-on',
  'percent': 'percent',
  'chevron.left': 'chevron-left',
  'checkmark.circle.fill': 'check-circle',
  'circle': 'radio-button-unchecked',
  'xmark.circle.fill': 'cancel',
  'fork.knife': 'restaurant',
  'cart': 'shopping-cart',
  'wrench.adjustable': 'build',
  'circle.grid.2x2': 'grid-view',
  'person.2': 'group',
  'dollarsign.circle': 'attach-money',
  'calendar': 'calendar-today',
  'envelope.fill': 'email',
  'wifi.slash': 'wifi-off',
  'exclamationmark.triangle': 'warning',
  'trash': 'delete',
  'checkmark': 'check',
  'doc.text.viewfinder': 'document-scanner',
  'arrow.counterclockwise': 'refresh',
  'person.2.fill': 'group',
  'ellipsis': 'more-horiz',
  'arrow.up.arrow.down': 'swap-vert',
  'pencil.line': 'edit',
  'minus.circle.fill': 'remove-circle',
  'plus.circle.fill': 'add-circle',
  'person.badge.plus': 'person-add',
  'mappin': 'place',
  'clock': 'schedule',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style as StyleProp<TextStyle>} />;
}
