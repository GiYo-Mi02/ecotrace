// stores/ScanContext.tsx — Shared state for scan data
// Replaces the unused AppContext.tsx with a properly wired context
// Persists scan history to AsyncStorage automatically

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ProductScan } from '@/types/product';
import { saveScanHistory, loadScanHistory, clearScanHistory as clearStorage } from '@/services/storage';

interface ScanContextType {
  currentProduct: ProductScan | null;
  scanHistory: ProductScan[];
  isLoading: boolean;
  setCurrentProduct: (product: ProductScan | null) => void;
  addToHistory: (product: ProductScan) => void;
  clearHistory: () => void;
}

const ScanContext = createContext<ScanContextType | undefined>(undefined);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [currentProduct, setCurrentProduct] = useState<ProductScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ProductScan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted history on mount
  useEffect(() => {
    loadScanHistory().then(history => {
      setScanHistory(history);
      setIsLoading(false);
    });
  }, []);

  const addToHistory = useCallback((product: ProductScan) => {
    setScanHistory(prev => {
      const updated = [product, ...prev];
      saveScanHistory(updated); // Persist in background
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setScanHistory([]);
    clearStorage();
  }, []);

  return (
    <ScanContext.Provider
      value={{
        currentProduct,
        scanHistory,
        isLoading,
        setCurrentProduct,
        addToHistory,
        clearHistory,
      }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) throw new Error('useScan must be used within ScanProvider');
  return context;
}
