import type { ExpoConfig, ConfigContext } from 'expo/config';

const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PREVIEW ? 'Rondas (Preview)' : 'Rondas',
  slug: 'rondas',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: IS_PREVIEW ? 'rondas-preview' : 'rondas',
  userInterfaceStyle: 'automatic',
  ios: {
    ...config.ios,
    supportsTablet: false,
    bundleIdentifier: IS_PREVIEW ? 'app.rondas.mobile.preview' : 'app.rondas.mobile',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: IS_PREVIEW ? 'app.rondas.mobile.preview' : 'app.rondas.mobile',
    permissions: [
      'android.permission.READ_CONTACTS',
      'android.permission.WRITE_CONTACTS',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.INTERNET',
    ],
  },
  web: {
    output: 'static' as const,
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#1E293B',
        dark: {
          backgroundColor: '#0F172A',
        },
      },
    ],
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    'expo-image',
    'expo-sharing',
    'expo-web-browser',
    [
      'expo-contacts',
      {
        contactsPermission:
          'Rondas usa tus contactos para asignar personas a los ítems de la cuenta y compartir el resumen por WhatsApp.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Rondas usa tu ubicación para identificar automáticamente el lugar donde fue hecha la cuenta.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Rondas accede a tus fotos para escanear recibos guardados en tu galería.',
        cameraPermission:
          'Rondas necesita acceso a la cámara para escanear recibos y extraer los ítems automáticamente.',
      },
    ],
    'expo-file-system',
    'expo-system-ui',
    'expo-asset',
    'expo-dev-client',
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        project: 'rondas',
        organization: 'demarchenac',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '108dace2-7c2f-4aad-8a3f-d8695905f5d8',
    },
  },
  owner: 'demarchenac',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/108dace2-7c2f-4aad-8a3f-d8695905f5d8',
  },
});
