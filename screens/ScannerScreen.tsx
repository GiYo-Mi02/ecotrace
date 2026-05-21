// screens/ScannerScreen.tsx — MongoDB Design System Scanner
// Deep teal hero band with bright MongoDB green CTA pill
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions, Platform, Linking,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useScan } from '@/stores/ScanContext';
import CornerBrackets from '@/components/CornerBrackets';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSpring,
  FadeIn, FadeInDown, Easing,
} from 'react-native-reanimated';
import { ScanLine, Camera, Zap, AlertCircle, RefreshCw, Settings } from 'lucide-react-native';
import { colors } from '@/components/ui/theme';

const { width: SW } = Dimensions.get('window');
const SCAN_BOX = SW * 0.7;

type ScanState = 'idle' | 'scanning' | 'fetching' | 'predicting' | 'success' | 'not_found' | 'error';

export default function ScannerScreen() {
  const router = useRouter();
  const { setCurrentProduct } = useScan();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const isProcessingRef = useRef(false);

  const scanLineY = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.6);
  const statusScale = useSharedValue(1);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(SCAN_BOX - 4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
    pulseOpacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scanLineY.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  const handleBarcodeScanned = useCallback(({ data, type }: BarcodeScanningResult) => {
    if (isProcessingRef.current || scanState !== 'scanning') return;
    isProcessingRef.current = true;
    setScannedBarcode(data);
    setScanState('fetching');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    statusScale.value = withSpring(1.1, { damping: 8 }, () => { statusScale.value = withSpring(1); });
    setTimeout(() => {
      router.push(`/parsing?barcode=${data}`);
      setTimeout(() => { isProcessingRef.current = false; setScanState('idle'); setScannedBarcode(null); }, 1000);
    }, 300);
  }, [scanState, router]);

  const startScanning = () => { setScanState('scanning'); setScannedBarcode(null); setErrorMessage(''); isProcessingRef.current = false; };
  const handleDemoScan = () => { router.push('/parsing?barcode=demo'); };
  const resetScanner = () => { setScanState('idle'); setScannedBarcode(null); setErrorMessage(''); isProcessingRef.current = false; };

  // ─── Permission loading ──────────────────────────────────────
  if (!permission) {
    return (
      <View style={s.container}>
        <Text style={s.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  // ─── Permission request ──────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={s.container}>
        <Animated.View entering={FadeInDown.delay(200)} style={s.permissionCard}>
          <Camera size={48} color={colors.brandGreen} strokeWidth={1.5} />
          <Text style={s.permTitle}>Camera Access Required</Text>
          <Text style={s.permDesc}>
            ECOTRACE needs camera access to scan product barcodes and analyze their sustainability impact.
          </Text>
          <Pressable style={s.permButton} onPress={requestPermission}>
            <Text style={s.permButtonText}>Grant Camera Access</Text>
          </Pressable>
          <Pressable style={s.settingsLink} onPress={() => Linking.openSettings()}>
            <Settings size={14} color={colors.steel} />
            <Text style={s.settingsLinkText}>Open Device Settings</Text>
          </Pressable>
          <Pressable style={s.demoLink} onPress={handleDemoScan}>
            <Text style={s.demoLinkText}>Try demo mode instead</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ─── Main Scanner ────────────────────────────────────────────
  return (
    <View style={s.container}>
      {(scanState === 'scanning' || scanState === 'fetching') && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'] }}
          onBarcodeScanned={scanState === 'scanning' ? handleBarcodeScanned : undefined}
        />
      )}

      <View style={s.overlay}>
        {/* Top bar */}
        <Animated.View entering={FadeIn.delay(100)} style={s.topBar}>
          <Text style={s.logoText}>ECOTRACE</Text>
          <Animated.View style={[s.statusTag, pulseStyle]}>
            <Text style={s.statusTagText}>
              {scanState === 'idle' && 'READY'}
              {scanState === 'scanning' && 'SCANNING'}
              {scanState === 'fetching' && 'FETCHING DATA'}
              {scanState === 'predicting' && 'ANALYZING'}
              {scanState === 'success' && 'COMPLETE'}
              {scanState === 'not_found' && 'NOT FOUND'}
              {scanState === 'error' && 'ERROR'}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Scan box */}
        <View style={s.scanBoxContainer}>
          <View style={s.scanBox}>
            <CornerBrackets
              size={28}
              color={scanState === 'scanning' ? colors.brandGreen : scanState === 'error' ? '#EF4444' : colors.steel}
              pulseSpeed={scanState === 'scanning' ? 1200 : 2500}
            />
            {scanState === 'scanning' && <Animated.View style={[s.scanLine, scanLineStyle]} />}
            {scanState === 'idle' && (
              <Animated.View entering={FadeIn} style={s.centerContent}>
                <ScanLine size={32} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                <Text style={s.scanHint}>Tap to scan</Text>
              </Animated.View>
            )}
            {scanState === 'fetching' && (
              <Animated.View entering={FadeIn} style={s.centerContent}>
                <Zap size={32} color={colors.brandGreen} strokeWidth={1.5} />
                <Text style={s.scanHint}>Analyzing...</Text>
              </Animated.View>
            )}
            {scannedBarcode && (
              <Animated.View entering={FadeInDown} style={s.barcodeDisplay}>
                <Text style={s.barcodeText}>{scannedBarcode}</Text>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Bottom controls */}
        <View style={s.bottomBar}>
          {scanState === 'idle' && (
            <Animated.View entering={FadeInDown.delay(300)} style={s.controls}>
              <Pressable style={s.scanButton} onPress={startScanning}>
                <View style={s.scanButtonInner}>
                  <Camera size={24} color={colors.onPrimary} strokeWidth={2} />
                </View>
                <Text style={s.scanButtonLabel}>SCAN BARCODE</Text>
              </Pressable>
              <Pressable style={s.demoButton} onPress={handleDemoScan}>
                <Text style={s.demoButtonText}>Demo Mode</Text>
              </Pressable>
            </Animated.View>
          )}
          {scanState === 'scanning' && (
            <Animated.View entering={FadeIn} style={s.controls}>
              <Text style={s.instructionText}>Point camera at a product barcode</Text>
              <Pressable style={s.cancelButton} onPress={resetScanner}>
                <Text style={s.cancelButtonText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          )}
          {(scanState === 'error' || scanState === 'not_found') && (
            <Animated.View entering={FadeInDown} style={s.controls}>
              <View style={s.errorCard}>
                <AlertCircle size={24} color="#EF4444" />
                <Text style={s.errorText}>
                  {scanState === 'not_found' ? 'Product not found in database' : errorMessage || 'Something went wrong'}
                </Text>
              </View>
              <Pressable style={s.retryButton} onPress={resetScanner}>
                <RefreshCw size={18} color={colors.onPrimary} />
                <Text style={s.retryButtonText}>Try Again</Text>
              </Pressable>
            </Animated.View>
          )}
          <Text style={s.versionTag}>ECOTRACE SCANNER v2.0 • ML-POWERED</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brandTealDeep },
  overlay: { flex: 1, justifyContent: 'space-between' },
  loadingText: { fontSize: 14, color: colors.onDarkMuted, textAlign: 'center', flex: 1, textAlignVertical: 'center' },

  // Top bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24,
  },
  logoText: { fontSize: 18, fontWeight: '600', color: colors.brandGreen, letterSpacing: 3 },
  statusTag: {
    backgroundColor: 'rgba(0,237,100,0.1)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1, borderColor: 'rgba(0,237,100,0.2)',
  },
  statusTagText: { fontSize: 11, fontWeight: '600', color: colors.brandGreen, letterSpacing: 2 },

  // Scan box
  scanBoxContainer: { alignItems: 'center', justifyContent: 'center' },
  scanBox: { width: SCAN_BOX, height: SCAN_BOX, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  scanLine: {
    position: 'absolute', left: 10, right: 10, height: 2,
    backgroundColor: colors.brandGreen,
    shadowColor: colors.brandGreen, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, top: 0,
  },
  centerContent: { alignItems: 'center', gap: 12 },
  scanHint: { fontSize: 12, fontWeight: '600', color: colors.onDarkMuted, letterSpacing: 2, textTransform: 'uppercase' },
  barcodeDisplay: {
    position: 'absolute', bottom: -30,
    backgroundColor: 'rgba(0,237,100,0.12)', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(0,237,100,0.25)',
  },
  barcodeText: { fontFamily: 'SourceCodePro-Regular', fontSize: 14, color: colors.brandGreen, letterSpacing: 2 },

  // Bottom bar
  bottomBar: { alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: 24 },
  controls: { alignItems: 'center', width: '100%', gap: 16 },

  // Scan button — MongoDB green pill
  scanButton: { alignItems: 'center', gap: 12 },
  scanButtonInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.brandGreen,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brandGreen, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
  },
  scanButtonLabel: { fontSize: 12, fontWeight: '600', color: colors.brandGreen, letterSpacing: 3 },

  // Demo button — outlined pill on dark
  demoButton: {
    paddingHorizontal: 22, paddingVertical: 10,
    borderRadius: 9999, borderWidth: 1, borderColor: colors.hairlineDark,
  },
  demoButtonText: { fontSize: 14, fontWeight: '600', color: colors.onDarkMuted },

  // Instruction
  instructionText: { fontSize: 14, color: colors.onDarkMuted, textAlign: 'center' },

  // Cancel — outlined pill
  cancelButton: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  cancelButtonText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },

  // Error
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(239,68,68,0.08)', paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', width: '100%',
  },
  errorText: { flex: 1, fontSize: 14, color: '#FCA5A5', lineHeight: 20 },

  // Retry — brand green pill
  retryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 9999, backgroundColor: colors.brandGreen,
  },
  retryButtonText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary },

  // Version
  versionTag: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 20 },

  // Permission
  permissionCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 20 },
  permTitle: { fontSize: 22, fontWeight: '500', color: colors.onDark, textAlign: 'center', letterSpacing: -0.5 },
  permDesc: { fontSize: 16, color: colors.onDarkMuted, textAlign: 'center', lineHeight: 25 },
  permButton: {
    backgroundColor: colors.brandGreen,
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 9999, marginTop: 8,
  },
  permButtonText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary },
  demoLink: { marginTop: 8, paddingVertical: 8 },
  demoLinkText: { fontSize: 14, color: colors.brandGreenDark, fontWeight: '500', textDecorationLine: 'underline' },
  settingsLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 9999, borderWidth: 1, borderColor: colors.hairlineDark,
  },
  settingsLinkText: { fontSize: 14, fontWeight: '500', color: colors.onDarkMuted },
});
