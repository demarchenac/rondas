import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import { ENV } from '@/constants/env';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';

export const PRO_ENTITLEMENT_ID = 'Rondas Pro';

let isConfigured = false;

export async function initRevenueCat(workosId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? ENV.REVENUECAT_IOS_KEY : ENV.REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    if (__DEV__) console.warn('[RevenueCat] API key not configured — skipping init');
    useSubscriptionStore.getState().setLoading(false);
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    if (!isConfigured) {
      Purchases.configure({ apiKey, appUserID: workosId });
      isConfigured = true;
    } else {
      await Purchases.logIn(workosId);
    }

    Purchases.addCustomerInfoUpdateListener((info) => {
      syncProStatus(info);
    });

    const info = await Purchases.getCustomerInfo();
    syncProStatus(info);
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] init failed:', err);
  } finally {
    useSubscriptionStore.getState().setLoading(false);
  }
}

function syncProStatus(info: CustomerInfo): void {
  const isPro = info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
  useSubscriptionStore.getState().setRevenueCatPro(isPro);
}

export async function getOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] getOffering failed:', err);
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    syncProStatus(customerInfo);
    return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
  } catch (err: unknown) {
    const errorObj = err as { userCancelled?: boolean };
    if (errorObj.userCancelled) return false;
    throw err;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  syncProStatus(info);
  return info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

export async function presentCodeRedemptionSheet(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Purchases.presentCodeRedemptionSheet();
  }
}

export async function presentCustomerCenter(): Promise<void> {
  const RevenueCatUI = (await import('react-native-purchases-ui')).default;
  await RevenueCatUI.presentCustomerCenter();
}

export async function presentRemotePaywall(): Promise<'purchased' | 'cancelled' | 'error'> {
  try {
    const { default: RevenueCatUI, PAYWALL_RESULT } = await import('react-native-purchases-ui');
    const result = await RevenueCatUI.presentPaywall();
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return 'purchased';
      case PAYWALL_RESULT.CANCELLED:
      case PAYWALL_RESULT.NOT_PRESENTED:
        return 'cancelled';
      default:
        return 'error';
    }
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] remote paywall failed:', err);
    return 'error';
  }
}

export async function logoutRevenueCat(): Promise<void> {
  if (!isConfigured) return;
  try {
    await Purchases.logOut();
    useSubscriptionStore.getState().reset();
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] logout failed:', err);
  }
}
