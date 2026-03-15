# Styling

## NativeWind (Tailwind for RN)

- Use `className` prop for all styling — avoid inline `style` objects
- Configure brand palette in `tailwind.config.js` under `extend.colors`
- Use semantic color tokens (e.g., `primary`, `muted`, `destructive`) not raw hex values in components

## Theme

- Support light, dark, and system modes
- Use NativeWind's `colorScheme` for theme switching
- Define dark variants using Tailwind's `dark:` prefix

## React Native Reusables

- Use as the base component library (Button, Card, Badge, Input, etc.)
- Customize via theme tokens (colors, radius, spacing) not by overriding component internals
- Wrap Reusables components in project-specific components only when adding significant behavior
