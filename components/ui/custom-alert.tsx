import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface ActionSheetConfig {
  options: string[];
  cancelButtonIndex?: number;
  destructiveButtonIndex?: number;
  onSelect: (index: number) => void;
}

interface CustomAlertContextValue {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  actionSheet: (config: ActionSheetConfig) => void;
}

const CustomAlertContext = createContext<CustomAlertContextValue | null>(null);

export function useCustomAlert(): CustomAlertContextValue {
  const ctx = useContext(CustomAlertContext);
  if (!ctx) throw new Error('useCustomAlert must be used within CustomAlertProvider');
  return ctx;
}

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [sheetConfig, setSheetConfig] = useState<ActionSheetConfig | null>(null);
  const callbacksRef = useRef<AlertButton[]>([]);
  const sheetCallbackRef = useRef<((index: number) => void) | null>(null);

  const alert = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    const btns = buttons || [{ text: 'OK' }];
    if (Platform.OS === 'ios') {
      Alert.alert(title, message, btns);
      return;
    }
    callbacksRef.current = btns;
    setAlertConfig({ title, message, buttons: btns });
  }, []);

  const actionSheet = useCallback((config: ActionSheetConfig) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: config.options,
          cancelButtonIndex: config.cancelButtonIndex,
          destructiveButtonIndex: config.destructiveButtonIndex,
        },
        config.onSelect,
      );
      return;
    }
    sheetCallbackRef.current = config.onSelect;
    setSheetConfig(config);
  }, []);

  const dismissAlert = useCallback(() => {
    setAlertConfig(null);
    callbacksRef.current = [];
  }, []);

  const dismissSheet = useCallback(() => {
    setSheetConfig(null);
    sheetCallbackRef.current = null;
  }, []);

  const handleAlertButton = useCallback((btn: AlertButton) => {
    dismissAlert();
    btn.onPress?.();
  }, [dismissAlert]);

  const handleSheetOption = useCallback((index: number) => {
    const cb = sheetCallbackRef.current;
    dismissSheet();
    cb?.(index);
  }, [dismissSheet]);

  return (
    <CustomAlertContext.Provider value={{ alert, actionSheet }}>
      {children}

      {/* Alert Modal (Android only) */}
      {alertConfig && (
        <Modal visible transparent animationType="fade" onRequestClose={dismissAlert}>
          <TouchableWithoutFeedback onPress={dismissAlert}>
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <TouchableWithoutFeedback>
                <View className="mx-8 w-80 rounded-2xl border border-border bg-card p-6">
                  {alertConfig.title !== '' && (
                    <Text className="mb-1 text-center text-lg font-bold text-foreground">
                      {alertConfig.title}
                    </Text>
                  )}
                  {alertConfig.message && (
                    <Text className="mb-4 text-center text-sm text-muted-foreground">
                      {alertConfig.message}
                    </Text>
                  )}
                  {!alertConfig.message && <View className="mb-3" />}
                  <View className="gap-2">
                    {alertConfig.buttons
                      .filter((b) => b.style !== 'cancel')
                      .map((btn, i) => (
                        <Pressable
                          key={i}
                          onPress={() => handleAlertButton(btn)}
                          className={cn(
                            'items-center rounded-xl py-3 active:opacity-80',
                            btn.style === 'destructive' ? 'bg-destructive/10' : 'bg-primary',
                          )}
                        >
                          <Text
                            className={cn(
                              'text-sm font-semibold',
                              btn.style === 'destructive' ? 'text-destructive' : 'text-primary-foreground',
                            )}
                          >
                            {btn.text}
                          </Text>
                        </Pressable>
                      ))}
                    {alertConfig.buttons
                      .filter((b) => b.style === 'cancel')
                      .map((btn, i) => (
                        <Pressable
                          key={`cancel-${i}`}
                          onPress={() => handleAlertButton(btn)}
                          className="items-center rounded-xl bg-muted py-3 active:opacity-80"
                        >
                          <Text className="text-sm font-semibold text-muted-foreground">
                            {btn.text}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Action Sheet Modal (Android only) */}
      {sheetConfig && (
        <Modal visible transparent animationType="fade" onRequestClose={dismissSheet}>
          <TouchableWithoutFeedback onPress={dismissSheet}>
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <TouchableWithoutFeedback>
                <View className="mx-4 mb-4 rounded-2xl border border-border bg-card overflow-hidden">
                  {sheetConfig.options.map((label, i) => {
                    if (i === sheetConfig.cancelButtonIndex) return null;
                    const isDestructive = i === sheetConfig.destructiveButtonIndex;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => handleSheetOption(i)}
                        className={cn(
                          'items-center border-b border-border/30 py-4 active:bg-muted/50',
                          i === sheetConfig.options.length - 1 && 'border-b-0',
                          sheetConfig.cancelButtonIndex !== undefined &&
                            i === sheetConfig.options.length - 2 && 'border-b-0',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-base font-medium',
                            isDestructive ? 'text-destructive' : 'text-primary',
                          )}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </TouchableWithoutFeedback>
              {sheetConfig.cancelButtonIndex !== undefined && (
                <TouchableWithoutFeedback>
                  <Pressable
                    onPress={() => handleSheetOption(sheetConfig.cancelButtonIndex!)}
                    className="mx-4 mb-4 items-center rounded-2xl border border-border bg-card py-4 active:bg-muted/50"
                  >
                    <Text className="text-base font-semibold text-muted-foreground">
                      {sheetConfig.options[sheetConfig.cancelButtonIndex]}
                    </Text>
                  </Pressable>
                </TouchableWithoutFeedback>
              )}
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </CustomAlertContext.Provider>
  );
}
