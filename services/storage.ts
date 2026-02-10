// services/storage.ts — AsyncStorage wrapper for persisting app data
// Implements scan history persistence and onboarding state (audit item #11, #10)

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductScan } from '@/types/product';

const KEYS = {
  SCAN_HISTORY: 'ecotrace_scan_history',
  HAS_SEEN_ONBOARDING: 'ecotrace_has_seen_onboarding',
} as const;

export async function saveScanHistory(history: ProductScan[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SCAN_HISTORY, JSON.stringify(history));
  } catch (e) {
    console.error('[Storage] Failed to save scan history:', e);
  }
}

export async function loadScanHistory(): Promise<ProductScan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SCAN_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[Storage] Failed to load scan history:', e);
    return [];
  }
}

export async function clearScanHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.SCAN_HISTORY);
  } catch (e) {
    console.error('[Storage] Failed to clear scan history:', e);
  }
}

export async function getHasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEYS.HAS_SEEN_ONBOARDING);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setHasSeenOnboarding(seen: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.HAS_SEEN_ONBOARDING, String(seen));
  } catch (e) {
    console.error('[Storage] Failed to save onboarding state:', e);
  }
}
