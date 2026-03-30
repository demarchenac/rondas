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

- Use `expo-image` over `Image` from react-native for content images (bill photos, large assets). **Exception:** use RN `Image` for small thumbnails styled with NativeWind `className` — `expo-image` is not intercepted by react-native-css's babel plugin, so `className` is silently ignored (renders with 0 dimensions)
- Use `expo-haptics` for tactile feedback on key actions
- Request permissions lazily (camera, contacts) — only when the feature is first used
- Use `expo-constants` for environment variables, never hardcode API keys
- Prefer `FlashList` over `FlatList` for long lists
