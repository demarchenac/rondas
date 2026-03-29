# Styling

## NativeWind v5 + Tailwind CSS v4

- Use `className` prop for all styling — avoid inline `style` objects
- Only use inline `style` for truly dynamic values (animated widths, state-driven colors)
- Theme tokens are defined in `global.css` via `@theme` block (no `tailwind.config.js`)
- Use semantic color tokens (`primary`, `muted`, `destructive`, `state-split`, etc.) — never hardcode hex values
- Use `cn()` from `@/lib/cn` for conditional classNames — not template literals

## Theme

- Support light, dark, and system modes
- Colors resolve automatically via CSS custom properties in `global.css`
- **Never use** `colorScheme === 'dark' ? '#xxx' : '#yyy'` — use token classes instead
- Use `ICON_COLORS` from `@/constants/colors` for icon color props that need raw values

## React Native Reusables

- Use as the base component library: **Button**, **Card**, **Badge**, **Input**, **Text**, **Avatar**
- Use CVA (class-variance-authority) for component variants
- Badge has bill-state variants: `draft`, `unsplit`, `split`, `unresolved`
- FilterChip uses CVA with `active` variant
- TipSelector is a shared component for tip percentage selection
- Wrap RNR components in project-specific components only when adding significant behavior

## Typography

- Use Tailwind text classes (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.) — not inline `fontSize`
- Use Tailwind font weight classes (`font-medium`, `font-semibold`, `font-bold`) — not inline `fontWeight`
- Use `<Text>` component from `@/components/ui/text` with CVA variants where applicable

## Spacing

- `px-7` for bill detail screen content
- `px-5` for home screen content
- `gap-2` to `gap-6` for element spacing
- Consistent within each screen; intentionally different between screens
