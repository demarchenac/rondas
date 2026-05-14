import { Image as ExpoImage } from 'expo-image';
import { styled } from 'react-native-css';

/**
 * expo-image wrapped with react-native-css's `styled` so that NativeWind
 * className is correctly mapped to the style prop.
 */
export const Image = styled(ExpoImage, { className: 'style' });
