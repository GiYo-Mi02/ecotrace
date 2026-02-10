// app/onboarding.tsx — Onboarding flow (shown once on first launch)
// AUDIT FIX: New screen for first-run experience

import React, { useState } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Leaf, Camera, ShieldCheck, ArrowRight, ChevronRight } from 'lucide-react-native';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { setHasSeenOnboarding } from '@/services/storage';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  icon: React.ComponentType<any>;
  color: string;
  title: string;
  subtitle: string;
  description: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    icon: Leaf,
    color: '#10b981',
    title: 'Know What\nYou Buy',
    subtitle: 'WELCOME TO ECOTRACE',
    description: 'Scan any product barcode to instantly see its environmental impact score and supply chain transparency.',
  },
  {
    icon: Camera,
    color: '#3b82f6',
    title: 'Scan Any\nBarcode',
    subtitle: 'HOW IT WORKS',
    description: 'Point your camera at a product barcode. We\'ll look up its data in the Open Food Facts database and compute a sustainability score.',
  },
  {
    icon: ShieldCheck,
    color: '#f59e0b',
    title: 'Transparent\nScoring',
    subtitle: 'TRUST THE DATA',
    description: 'Our scoring algorithm is fully documented. Every score shows its confidence level and data sources so you can make informed decisions.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const buttonScale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleNext = async () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      // Final slide — complete onboarding
      await setHasSeenOnboarding(true);
      router.replace('/(tabs)/scanner');
    }
  };

  const handleSkip = async () => {
    await setHasSeenOnboarding(true);
    router.replace('/(tabs)/scanner');
  };

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;
  const Icon = slide.icon;

  return (
    <View style={styles.container}>
      {/* Skip button */}
      {!isLast && (
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      )}

      {/* Slide content */}
      <Animated.View
        key={currentSlide}
        entering={FadeInRight.duration(300)}
        exiting={FadeOutLeft.duration(200)}
        style={styles.slideContent}
      >
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: `${slide.color}15`, borderColor: `${slide.color}30` }]}>
          <Icon size={48} color={slide.color} />
        </View>

        {/* Text */}
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </Animated.View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentSlide && { backgroundColor: '#10b981', width: 24 },
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started button */}
        <Pressable
          onPressIn={() => { buttonScale.value = withSpring(0.96); }}
          onPressOut={() => {
            buttonScale.value = withSpring(1);
            handleNext();
          }}
        >
          <Animated.View style={[buttonStyle, styles.nextButton, isLast && styles.nextButtonFinal]}>
            {isLast ? (
              <>
                <Text style={styles.nextButtonText}>GET STARTED</Text>
                <ArrowRight size={18} color="#0f172a" />
              </>
            ) : (
              <>
                <Text style={styles.nextButtonText}>NEXT</Text>
                <ChevronRight size={18} color="#0f172a" />
              </>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  skipButton: { position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8 },
  skipText: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  slideContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 40,
  },
  subtitle: {
    fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)',
    letterSpacing: 3, marginBottom: 12,
  },
  title: { fontSize: 32, color: '#ffffff', fontWeight: '800', textAlign: 'center', lineHeight: 40, marginBottom: 16 },
  description: {
    fontFamily: 'SpaceMono-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 22, letterSpacing: 0.3,
  },
  bottomSection: { paddingHorizontal: 40, paddingBottom: 50, alignItems: 'center', gap: 30 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  nextButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10b981', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12,
    width: width - 80,
  },
  nextButtonFinal: { backgroundColor: '#10b981' },
  nextButtonText: {
    fontFamily: 'SpaceMono-Regular', fontSize: 13, color: '#0f172a',
    fontWeight: '700', letterSpacing: 2,
  },
});
