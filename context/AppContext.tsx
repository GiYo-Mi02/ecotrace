import React, { createContext, useContext, useState, useCallback } from 'react';
import { ProductScan, getRandomProduct, MOCK_PRODUCTS } from '@/data/mockData';

export type AppScreen = 'scanner' | 'parsing' | 'impact' | 'audit' | 'history';

interface AppState {
  currentScreen: AppScreen;
  currentProduct: ProductScan | null;
  scanHistory: ProductScan[];
  isScanning: boolean;
  navigateTo: (screen: AppScreen) => void;
  startScan: () => void;
  completeScan: () => void;
  selectProduct: (product: ProductScan) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('scanner');
  const [currentProduct, setCurrentProduct] = useState<ProductScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ProductScan[]>(MOCK_PRODUCTS.slice(0, 4));
  const [isScanning, setIsScanning] = useState(false);

  const navigateTo = useCallback((screen: AppScreen) => {
    setCurrentScreen(screen);
  }, []);

  const startScan = useCallback(() => {
    setIsScanning(true);
    setCurrentScreen('parsing');
  }, []);

  const completeScan = useCallback(() => {
    const product = getRandomProduct();
    setCurrentProduct(product);
    setScanHistory(prev => [product, ...prev]);
    setIsScanning(false);
    setCurrentScreen('impact');
  }, []);

  const selectProduct = useCallback((product: ProductScan) => {
    setCurrentProduct(product);
    setCurrentScreen('impact');
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        currentProduct,
        scanHistory,
        isScanning,
        navigateTo,
        startScan,
        completeScan,
        selectProduct,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
