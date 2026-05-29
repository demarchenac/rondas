import { create } from 'zustand';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  timestamp: number;
}

interface LogState {
  logs: LogEntry[];
  nextId: number;
  add: (level: LogLevel, message: string) => void;
  clear: () => void;
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  nextId: 1,
  add: (level, message) => {
    const { nextId, logs } = get();
    const entry: LogEntry = { id: nextId, level, message, timestamp: Date.now() };
    set({ logs: [entry, ...logs].slice(0, 500), nextId: nextId + 1 });
  },
  clear: () => set({ logs: [], nextId: 1 }),
}));

const IS_PREVIEW = process.env.EXPO_PUBLIC_APP_VARIANT === 'preview' || process.env.APP_VARIANT === 'preview';

export const devLog = {
  info: (msg: string) => { if (IS_PREVIEW) useLogStore.getState().add('info', msg); },
  warn: (msg: string) => { if (IS_PREVIEW) useLogStore.getState().add('warn', msg); },
  error: (msg: string) => { if (IS_PREVIEW) useLogStore.getState().add('error', msg); },
  enabled: IS_PREVIEW,
};
