import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Buffers a text input's value locally to prevent real-time subscription
 * overwrites while the user is typing. Debounces commits to the server.
 *
 * Use for inline edits without a submit button (e.g., bill name, tax).
 * For form-based inputs with a submit button, use TanStack Form instead.
 */
export function useBufferedInput(
  serverValue: string,
  onCommit: (value: string) => void,
  delay = 500,
) {
  const [localValue, setLocalValue] = useState(serverValue);
  const isFocused = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync from server when not focused
  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(serverValue);
    }
  }, [serverValue]);

  const onChangeText = useCallback(
    (text: string) => {
      setLocalValue(text);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onCommit(text), delay);
    },
    [onCommit, delay],
  );

  const onFocus = useCallback(() => {
    isFocused.current = true;
  }, []);

  const onBlur = useCallback(() => {
    isFocused.current = false;
    clearTimeout(timerRef.current);
    if (localValue !== serverValue) {
      onCommit(localValue);
    }
  }, [localValue, serverValue, onCommit]);

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { value: localValue, onChangeText, onFocus, onBlur };
}
