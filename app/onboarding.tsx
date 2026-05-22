// app/onboarding.tsx — MongoDB Design System onboarding
// Deep teal hero band with brand-green CTA pill

import React, { useState } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Leaf, Camera, ShieldCheck, ArrowRight, ChevronRight, Heart } from 'lucide-react-native';
import Animated, {
  FadeInRight, FadeOutLeft,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { setHasSeenOnboarding } from '@/services/storage';
import { colors } from '@/components/ui/theme';

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
    color: colors.brandGreen,
    title: 'Know What\nYou Buy',
    subtitle: 'WELCOME TO ECOTRACE',
    description: 'Scan any product barcode to instantly see its environmental impact score and supply chain transparency.',
  },
  {
    icon: Camera,
    color: colors.accentBlue,
    title: 'Scan Any\nBarcode',
    subtitle: 'HOW IT WORKS',
    description: 'Point your camera at a product barcode. We\'ll look up its data in the Open Food Facts database and compute a sustainability score.',
  },
  {
    icon: ShieldCheck,
    color: colors.accentOrange,
    title: 'Transparent\nScoring',
    subtitle: 'TRUST THE DATA',
    description: 'Our scoring algorithm is fully documented. Every score shows its confidence level and data sources so you can make informed decisions.',
  },
  {
    icon: Heart,
    color: '#f43f5e',
    title: 'Your Health,\nYour Rules',
    subtitle: 'PERSONAL HEALTH',
    description: "Tell us your dietary preferences and allergens once. We'll flag risky ingredients and highlight products that match your lifestyle — every scan, automatically.",
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
      await setHasSeenOnboarding(true);
      router.replace('/health-profile' as any);
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
      {/* Skip */}
      {!isLast && (
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
      )}

      {/* Slide */}
      <Animated.View
        key={currentSlide}
        entering={FadeInRight.duration(300)}
        exiting={FadeOutLeft.duration(200)}
        style={styles.slideContent}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${slide.color}18`, borderColor: `${slide.color}30` }]}>
          <Icon size={48} color={slide.color} />
        </View>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </Animated.View>

      {/* Bottom */}
      <View style={styles.bottomSection}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentSlide && { backgroundColor: colors.brandGreen, width: 24 },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPressIn={() => { buttonScale.value = withSpring(0.96); }}
          onPressOut={() => { buttonScale.value = withSpring(1); handleNext(); }}
        >
          <Animated.View style={[buttonStyle, styles.nextButton]}>
            <Text style={styles.nextButtonText}>{isLast ? 'GET STARTED' : 'NEXT'}</Text>
            {isLast
              ? <ArrowRight size={18} color={colors.onPrimary} />
              : <ChevronRight size={18} color={colors.onPrimary} />
            }
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brandTealDeep },
  skipButton: { position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8 },
  skipText: { fontSize: 11, fontWeight: '600', color: colors.onDarkMuted, letterSpacing: 2 },
  slideContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 40,
  },
  subtitle: {
    fontSize: 11, fontWeight: '600', color: colors.brandGreen,
    letterSpacing: 3, marginBottom: 12,
  },
  title: {
    fontSize: 32, color: colors.onDark, fontWeight: '500',
    textAlign: 'center', lineHeight: 40, marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16, color: colors.onDarkMuted,
    textAlign: 'center', lineHeight: 25,
  },
  bottomSection: { paddingHorizontal: 40, paddingBottom: 50, alignItems: 'center', gap: 30 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  nextButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brandGreen,
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 9999, // pill
    width: width - 80,
  },
  nextButtonText: {
    fontSize: 14, color: colors.onPrimary,
    fontWeight: '600', letterSpacing: 1,
  },
});
