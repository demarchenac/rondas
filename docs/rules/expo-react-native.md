# Expo & React Native

## Routing (Expo Router)

- File-based routing in `app/` directory
- Route groups use parentheses: `(auth)`, `(tabs)`
- Dynamic routes use brackets: `[id]`
- Layouts: `_layout.tsx` in each route group

## Route Structure

```
app/
├── _layout.tsx              # Root layout (auth check, providers)
├── (auth)/
│   ├── _layout.tsx          # Auth layout
│   └── login.tsx
├── (tabs)/
│   ├── _layout.tsx          # Tab navigator config
│   ├── index.tsx            # Home (bill list)
│   └── settings.tsx
└── bills/
    ├── new.tsx              # Bill creation
    └── [id]/
        ├── index.tsx        # Bill detail
        └── summary.tsx      # Bill summary
```

## Conventions

- Use `expo-image` over `Image` from react-native — import via `import { Image } from '@/lib/expo-image'` which wraps expo-image with `styled()` from react-native-css so NativeWind `className` works correctly. **Do not** import `Image` directly from `expo-image` as `className` will be silently ignored
- Use `expo-haptics` for tactile feedback on key actions
- Request permissions lazily (camera, contacts) — only when the feature is first used. Cache permission status in a `useRef` to avoid re-requesting
- Cache `expo-contacts` results in a `useRef` with a TTL (5 min). Use two-phase loading: fast fetch (Name + PhoneNumbers) first, then background re-fetch with Image field
- Use `expo-constants` for environment variables, never hardcode API keys
- Prefer `FlashList` over `FlatList` for long lists — especially in modals with 100+ items
- Use `react-native-currency-input` for currency fields — provides live formatting with proper cursor management. Wrapped in `@/components/form/CurrencyInput`
