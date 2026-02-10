import React, { useState, useCallback } from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import ScannerScreen from '@/screens/ScannerScreen';
import ParsingScreen from '@/screens/ParsingScreen';
import ImpactScreen from '@/screens/ImpactScreen';
import AuditScreen from '@/screens/AuditScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import BottomNav from '@/components/BottomNav';
import { MOCK_PRODUCTS, getRandomProduct } from '@/data/mockData';
import type { ProductScan } from '@/data/mockData';

type AppScreen = 'scanner' | 'parsing' | 'impact' | 'audit' | 'history';

export default function HomeScreen() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('scanner');
  const [currentProduct, setCurrentProduct] = useState<ProductScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ProductScan[]>(MOCK_PRODUCTS.slice(0, 4));

  const [fontsLoaded] = useFonts({
    'SpaceMono-Regular': require('@/assets/fonts/SpaceMono-Regular.ttf'),
  });

  const handleScan = useCallback(() => {
    setCurrentScreen('parsing');
  }, []);

  const handleScanComplete = useCallback(() => {
    const product = getRandomProduct();
    setCurrentProduct(product);
    setScanHistory(prev => [product, ...prev]);
    setCurrentScreen('impact');
  }, []);

  const handleNavigate = useCallback((screen: AppScreen) => {
    if (screen === 'impact' && !currentProduct) {
      setCurrentScreen('scanner');
    } else {
      setCurrentScreen(screen);
    }
  }, [currentProduct]);

  const handleSelectProduct = useCallback((product: ProductScan) => {
    setCurrentProduct(product);
    setCurrentScreen('impact');
  }, []);

  const handleViewAudit = useCallback(() => {
    setCurrentScreen('audit');
  }, []);

  const handleBackToScanner = useCallback(() => {
    setCurrentScreen('scanner');
  }, []);

  const handleBackToImpact = useCallback(() => {
    setCurrentScreen('impact');
  }, []);

  const handleViewLastScan = useCallback(() => {
    if (scanHistory.length > 0) {
      setCurrentProduct(scanHistory[0]);
      setCurrentScreen('impact');
    }
  }, [scanHistory]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0f172a' }} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'scanner':
        return (
          <ScannerScreen
            onScan={handleScan}
            lastScan={scanHistory.length > 0 ? scanHistory[0] : null}
            onViewLastScan={handleViewLastScan}
          />
        );
      case 'parsing':
        return <ParsingScreen onComplete={handleScanComplete} />;
      case 'impact':
        return currentProduct ? (
          <ImpactScreen
            product={currentProduct}
            onBack={handleBackToScanner}
            onViewAudit={handleViewAudit}
          />
        ) : (
          <ScannerScreen
            onScan={handleScan}
            lastScan={scanHistory.length > 0 ? scanHistory[0] : null}
            onViewLastScan={handleViewLastScan}
          />
        );
      case 'audit':
        return currentProduct ? (
          <AuditScreen
            product={currentProduct}
            onBack={handleBackToImpact}
          />
        ) : null;
      case 'history':
        return (
          <HistoryScreen
            scanHistory={scanHistory}
            onSelectProduct={handleSelectProduct}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {renderScreen()}
      </SafeAreaView>
      {currentScreen !== 'parsing' && (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#0f172a' }}>
          <BottomNav currentScreen={currentScreen} onNavigate={handleNavigate} />
        </SafeAreaView>
      )}
    </View>
  );
}
