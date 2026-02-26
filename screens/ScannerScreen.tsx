// screens/ScannerScreen.tsx — Main Barcode Scanner with ML Integration
//
// Features:
//  - Real camera-based barcode scanning (expo-camera)
//  - State machine: idle → scanning → fetching → predicting → success/not_found/error
//  - CornerBrackets animation with ECOTRACE branding
//  - Dark theme (#0f172a), green accent (#10b981)
//  - Real Open Food Facts API lookup
//  - ML eco-score prediction with fallback chain
//
// Routes:
//  - Success → /parsing?barcode={code} (which handles API + scoring + routing to /impact)
//  - Demo mode for testing

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useScan } from '@/stores/ScanContext';
import CornerBrackets from '@/components/CornerBrackets';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
  Easing,
} from 'react-native-reanimated';
import { ScanLine, Camera, Zap, AlertCircle, RefreshCw, Settings } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_BOX_SIZE = SCREEN_WIDTH * 0.7;

// ─── Types ───────────────────────────────────────────────────────

type ScanState = 'idle' | 'scanning' | 'fetching' | 'predicting' | 'success' | 'not_found' | 'error';

// ─── Component ───────────────────────────────────────────────────

export default function ScannerScreen() {
  const router = useRouter();
  const { setCurrentProduct } = useScan();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const isProcessingRef = useRef(false);

  // Animation values
  const scanLineY = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.6);
  const statusScale = useSharedValue(1);

  // Start scan line animation
  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(SCAN_BOX_SIZE - 4, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    pulseOpacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // ─── Barcode Handler ────────────────────────────────────────────

  const handleBarcodeScanned = useCallback(({ data, type }: BarcodeScanningResult) => {
    if (isProcessingRef.current || scanState !== 'scanning') return;

    isProcessingRef.current = true;
    setScannedBarcode(data);
    setScanState('fetching');

    console.log(`[Scanner] Barcode scanned: ${data} (type: ${type})`);

    // Haptic feedback on successful scan
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Animate status change
    statusScale.value = withSpring(1.1, { damping: 8 }, () => {
      statusScale.value = withSpring(1);
    });

    // Route to ParsingScreen for API lookup + ML prediction + scoring
    setTimeout(() => {
      router.push(`/parsing?barcode=${data}`);

      // Reset after navigation
      setTimeout(() => {
        isProcessingRef.current = false;
        setScanState('idle');
        setScannedBarcode(null);
      }, 1000);
    }, 300);
  }, [scanState, router]);

  // ─── Actions ────────────────────────────────────────────────────

  const startScanning = () => {
    setScanState('scanning');
    setScannedBarcode(null);
    setErrorMessage('');
    isProcessingRef.current = false;
  };

  const handleDemoScan = () => {
    router.push('/parsing?barcode=demo');
  };

  const resetScanner = () => {
    setScanState('idle');
    setScannedBarcode(null);
    setErrorMessage('');
    isProcessingRef.current = false;
  };

  // ─── Permission Request ─────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.delay(200)} style={styles.permissionCard}>
          <Camera size={48} color="#10b981" strokeWidth={1.5} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionDesc}>
            ECOTRACE needs camera access to scan product barcodes and analyze their sustainability impact.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </Pressable>
          <Pressable
            style={styles.settingsLink}
            onPress={() => Linking.openSettings()}
          >
            <Settings size={14} color="#64748b" />
            <Text style={styles.settingsLinkText}>Open Device Settings</Text>
          </Pressable>
          <Pressable style={styles.demoLink} onPress={handleDemoScan}>
            <Text style={styles.demoLinkText}>Try demo mode instead</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ─── Main Scanner View ──────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Camera */}
      {(scanState === 'scanning' || scanState === 'fetching') ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'],
          }}
          onBarcodeScanned={scanState === 'scanning' ? handleBarcodeScanned : undefined}
        />
      ) : null}

      {/* Dark overlay with scan window cutout */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.topBar}>
          <Text style={styles.logoText}>ECOTRACE</Text>
          <Animated.Text style={[styles.statusTag, pulseStyle]}>
            {scanState === 'idle' && 'READY'}
            {scanState === 'scanning' && 'SCANNING'}
            {scanState === 'fetching' && 'FETCHING DATA'}
            {scanState === 'predicting' && 'ANALYZING'}
            {scanState === 'success' && 'COMPLETE'}
            {scanState === 'not_found' && 'NOT FOUND'}
            {scanState === 'error' && 'ERROR'}
          </Animated.Text>
        </Animated.View>

        {/* Scan box area */}
        <View style={styles.scanBoxContainer}>
          <View style={styles.scanBox}>
            <CornerBrackets
              size={28}
              color={scanState === 'scanning' ? '#10b981' : scanState === 'error' ? '#ef4444' : '#64748b'}
              pulseSpeed={scanState === 'scanning' ? 1200 : 2500}
            />

            {/* Scan line */}
            {scanState === 'scanning' && (
              <Animated.View style={[styles.scanLine, scanLineStyle]} />
            )}

            {/* Center icon */}
            {scanState === 'idle' && (
              <Animated.View entering={FadeIn} style={styles.centerContent}>
                <ScanLine size={32} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                <Text style={styles.scanHint}>Tap to scan</Text>
              </Animated.View>
            )}

            {scanState === 'fetching' && (
              <Animated.View entering={FadeIn} style={styles.centerContent}>
                <Zap size={32} color="#10b981" strokeWidth={1.5} />
                <Text style={styles.scanHint}>Analyzing...</Text>
              </Animated.View>
            )}

            {/* Scanned barcode number */}
            {scannedBarcode && (
              <Animated.View entering={FadeInDown} style={styles.barcodeDisplay}>
                <Text style={styles.barcodeText}>{scannedBarcode}</Text>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {scanState === 'idle' && (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.controls}>
              <Pressable style={styles.scanButton} onPress={startScanning}>
                <View style={styles.scanButtonInner}>
                  <Camera size={24} color="#ffffff" strokeWidth={2} />
                </View>
                <Text style={styles.scanButtonLabel}>SCAN BARCODE</Text>
              </Pressable>

              <Pressable style={styles.demoButton} onPress={handleDemoScan}>
                <Text style={styles.demoButtonText}>Demo Mode</Text>
              </Pressable>
            </Animated.View>
          )}

          {scanState === 'scanning' && (
            <Animated.View entering={FadeIn} style={styles.controls}>
              <Text style={styles.instructionText}>
                Point camera at a product barcode
              </Text>
              <Pressable style={styles.cancelButton} onPress={resetScanner}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          )}

          {(scanState === 'error' || scanState === 'not_found') && (
            <Animated.View entering={FadeInDown} style={styles.controls}>
              <View style={styles.errorCard}>
                <AlertCircle size={24} color="#ef4444" />
                <Text style={styles.errorText}>
                  {scanState === 'not_found'
                    ? 'Product not found in database'
                    : errorMessage || 'Something went wrong'}
                </Text>
              </View>
              <Pressable style={styles.retryButton} onPress={resetScanner}>
                <RefreshCw size={18} color="#ffffff" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Version tag */}
          <Text style={styles.versionTag}>
            ECOTRACE SCANNER v2.0 • ML-POWERED
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
  },
  logoText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 18,
    color: '#10b981',
    letterSpacing: 3,
  },
  statusTag: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: '#10b981',
    letterSpacing: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    overflow: 'hidden',
  },

  // Scan box
  scanBoxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    top: 0,
  },
  centerContent: {
    alignItems: 'center',
    gap: 12,
  },
  scanHint: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  barcodeDisplay: {
    position: 'absolute',
    bottom: -30,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  barcodeText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 14,
    color: '#10b981',
    letterSpacing: 2,
  },

  // Bottom bar
  bottomBar: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 24,
  },
  controls: {
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },

  // Scan button
  scanButton: {
    alignItems: 'center',
    gap: 12,
  },
  scanButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 3,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: '#10b981',
    letterSpacing: 3,
  },

  // Demo button
  demoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  demoButtonText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 1,
  },

  // Instructions
  instructionText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    letterSpacing: 1,
  },

  // Cancel
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cancelButtonText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: '#ef4444',
    letterSpacing: 1,
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 18,
  },

  // Retry
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  retryButtonText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: '#10b981',
    letterSpacing: 1,
  },

  // Version
  versionTag: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: 'rgba(100, 116, 139, 0.5)',
    letterSpacing: 1,
    marginTop: 20,
  },

  // Permission
  permissionText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    flex: 1,
    textAlignVertical: 'center',
  },
  permissionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  permissionDesc: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  demoLink: {
    marginTop: 8,
    paddingVertical: 8,
  },
  demoLinkText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  settingsLinkText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 1,
  },
});
