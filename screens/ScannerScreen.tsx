// screens/ScannerScreen.tsx — REWRITTEN for real barcode scanning
// Changes from audit:
//  - "NEURAL SCANNER v2.4" → "ECOTRACE SCANNER"
//  - Fake scan button → real expo-camera barcode detection
//  - Props-based → context/router-based
//  - Added DemoBanner, camera permission handling, haptic feedback

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Crosshair, Zap, Radio, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import CornerBrackets from '@/components/CornerBrackets';
import StatusBadge from '@/components/StatusBadge';
import ScoreRing from '@/components/ScoreRing';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';

export default function ScannerScreen() {
  const router = useRouter();
  const { scanHistory } = useScan();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const lastScan = scanHistory.length > 0 ? scanHistory[0] : null;

  // Reset scan state when screen refocuses (coming back from parsing/impact)
  useFocusEffect(
    useCallback(() => {
      setHasScanned(false);
      setIsScanning(false);
    }, [])
  );

  // ─── Animations ─────────────────────────────────────────────────
  const pulseScale = useSharedValue(1);
  const crosshairOpacity = useSharedValue(0.4);
  const buttonPressed = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    crosshairOpacity.value = withRepeat(
      withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const crosshairStyle = useAnimatedStyle(() => ({
    opacity: crosshairOpacity.value,
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonPressed.value }],
  }));

  // ─── Handlers ───────────────────────────────────────────────────
  const handleBarcodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (hasScanned) return;
      setHasScanned(true);
      setIsScanning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/parsing', params: { barcode: data } });
    },
    [hasScanned, router]
  );

  const handleScanPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (!permission?.granted) {
      requestPermission();
      return;
    }

    if (isScanning) {
      // Already scanning — tap again uses demo data as fallback
      setIsScanning(false);
      setHasScanned(true);
      router.push({ pathname: '/parsing', params: { barcode: 'demo' } });
    } else {
      setIsScanning(true);
      setHasScanned(false);
    }
  }, [permission, isScanning, router, requestPermission]);

  const handlePressIn = () => {
    buttonPressed.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    buttonPressed.value = withSpring(1);
    handleScanPress();
  };

  const handleViewLastScan = useCallback(() => {
    if (lastScan) {
      router.push('/impact');
    }
  }, [lastScan, router]);

  // ─── Camera Viewport ───────────────────────────────────────────
  const renderCameraViewport = () => {
    if (!permission?.granted) {
      return (
        <View style={styles.permissionContainer}>
          <Camera size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.permissionText}>
            Camera access needed{'\n'}to scan product barcodes
          </Text>
          <Pressable onPress={requestPermission} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>GRANT ACCESS</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
        }}
        onBarcodeScanned={isScanning && !hasScanned ? handleBarcodeScanned : undefined}
      />
    );
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <DemoBanner />

      {/* Header — AUDIT FIX: Replaced "NEURAL SCANNER v2.4" */}
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>ECOTRACE SCANNER</Text>
        <Text style={styles.headerTitle}>Product Scanner</Text>
      </View>

      {/* Status pills */}
      <View style={styles.pillRow}>
        <View style={[styles.pill, isScanning && styles.pillActive]}>
          <Text style={[styles.pillText, isScanning && styles.pillTextActive]}>
            {isScanning ? 'SCANNING...' : 'READY'}
          </Text>
        </View>
        {permission?.granted && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>CAMERA ACTIVE</Text>
          </View>
        )}
      </View>

      {/* Scanner viewport */}
      <View style={styles.viewportContainer}>
        <View style={styles.viewport}>
          <CornerBrackets size={30} color={isScanning ? '#10b981' : 'rgba(16,185,129,0.5)'} />

          {renderCameraViewport()}

          {/* Grid overlay (always shown for visual consistency) */}
          <View style={styles.gridOuter} />
          <View style={styles.gridInner} />

          {/* Crosshair (shown when not actively scanning via camera) */}
          {(!permission?.granted || !isScanning) && (
            <Animated.View style={[crosshairStyle, styles.crosshairCenter]}>
              <Crosshair size={60} color="rgba(16,185,129,0.5)" strokeWidth={1} />
            </Animated.View>
          )}

          {/* Status text at bottom of viewport */}
          <View style={styles.viewportStatus}>
            <View style={styles.viewportStatusRow}>
              <Radio size={10} color="#10b981" />
              <Text style={styles.viewportStatusText}>
                {isScanning ? 'POINT AT BARCODE' : 'READY TO SCAN'}
              </Text>
            </View>
          </View>
        </View>

        {/* Scan button */}
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <Animated.View style={[pulseStyle, buttonStyle, styles.scanButton]}>
            <Zap size={32} color="#0f172a" fill="#0f172a" />
          </Animated.View>
        </Pressable>
        <Text style={styles.scanHint}>
          {isScanning ? 'TAP AGAIN FOR DEMO DATA' : 'TAP TO SCAN'}
        </Text>
      </View>

      {/* Last scan preview */}
      {lastScan && (
        <Pressable onPress={handleViewLastScan}>
          <View style={styles.lastScanCard}>
            <ScoreRing score={lastScan.score} size={44} strokeWidth={3} showLabel={false} />
            <View style={styles.lastScanInfo}>
              <Text style={styles.lastScanLabel}>LAST SCAN</Text>
              <Text style={styles.lastScanName}>{lastScan.name}</Text>
              <Text style={styles.lastScanMeta}>
                {lastScan.brand} · {lastScan.scanDate}
              </Text>
            </View>
            <StatusBadge status={lastScan.status} size="sm" />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerSubtitle: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 3,
  },
  headerTitle: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 4,
  },
  pillRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  pillText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  pillTextActive: { color: '#10b981' },
  viewportContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  viewport: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 300,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  gridOuter: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
  },
  gridInner: {
    position: 'absolute',
    width: '60%',
    height: '60%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
  },
  crosshairCenter: { alignItems: 'center', justifyContent: 'center' },
  viewportStatus: { position: 'absolute', bottom: 20, alignItems: 'center', zIndex: 10 },
  viewportStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewportStatusText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: '#10b981',
    letterSpacing: 2,
  },
  scanButton: {
    marginTop: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  scanHint: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 12,
    letterSpacing: 2,
  },
  permissionContainer: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  permissionText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    letterSpacing: 1,
  },
  permissionButton: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  permissionButtonText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: '#10b981',
    letterSpacing: 2,
  },
  lastScanCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastScanInfo: { flex: 1 },
  lastScanLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  lastScanName: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  lastScanMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
});
