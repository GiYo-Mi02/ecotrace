import React, { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import CornerBrackets from '@/components/CornerBrackets';

interface ParsingScreenProps {
  onComplete: () => void;
}

const DOT_COUNT = 12;

function ScanDot({ index, delay }: { index: number; delay: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 8, stiffness: 100 })
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 300 })
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const x = Math.random() * 200 - 100;
  const y = Math.random() * 200 - 100;

  return (
    <Animated.View
      style={[
        dotStyle,
        {
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: x,
          marginTop: y,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#10b981',
          shadowColor: '#10b981',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
        },
      ]}
    />
  );
}

export default function ParsingScreen({ onComplete }: ParsingScreenProps) {
  const progressWidth = useSharedValue(0);
  const labelOpacity = useSharedValue(0.6);
  const [dots, setDots] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Animate progress bar
    progressWidth.value = withTiming(100, {
      duration: 3000,
      easing: Easing.linear,
    });

    // Pulse the label
    labelOpacity.value = withRepeat(
      withTiming(1, { duration: 500 }),
      -1,
      true
    );

    // Add dots staggered
    const dotIntervals: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const timeout = setTimeout(() => {
        setDots(prev => [...prev, i]);
      }, i * 250);
      dotIntervals.push(timeout);
    }

    // Auto-transition after 3 seconds
    timerRef.current = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      dotIntervals.forEach(clearTimeout);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
      {/* Header */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16 }}>
        <Text
          style={{
            fontFamily: 'SpaceMono-Regular',
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 3,
          }}
        >
          NEURAL SCANNER v2.4
        </Text>
      </View>

      {/* Scanner viewport with dots */}
      <View
        style={{
          width: 280,
          height: 280,
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CornerBrackets size={30} color="#10b981" pulseSpeed={800} />

        {/* Animated dots */}
        {dots.map((dotIndex) => (
          <ScanDot key={dotIndex} index={dotIndex} delay={0} />
        ))}
      </View>

      {/* Status text */}
      <Animated.Text
        style={[
          labelStyle,
          {
            fontFamily: 'SpaceMono-Regular',
            fontSize: 14,
            color: '#10b981',
            letterSpacing: 4,
            marginTop: 30,
          },
        ]}
      >
        NEURAL PARSING...
      </Animated.Text>

      {/* Scan protocol */}
      <Text
        style={{
          fontFamily: 'SpaceMono-Regular',
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: 2,
          marginTop: 8,
        }}
      >
        ANALYZING SUPPLY CHAIN DATA
      </Text>

      {/* Progress bar */}
      <View
        style={{
          width: 280,
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 2,
          marginTop: 24,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            progressStyle,
            {
              height: '100%',
              backgroundColor: '#10b981',
              borderRadius: 2,
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 8,
            },
          ]}
        />
      </View>

      {/* Scanning details */}
      <View style={{ marginTop: 40, alignItems: 'center', gap: 8 }}>
        {['Material Composition', 'Carbon Footprint', 'Supply Chain Nodes'].map((item, i) => (
          <Animated.View
            key={item}
            entering={FadeIn.delay(i * 800).duration(400)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : 'rgba(255,255,255,0.3)',
              }}
            />
            <Text
              style={{
                fontFamily: 'SpaceMono-Regular',
                fontSize: 11,
                color: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                letterSpacing: 1,
              }}
            >
              {i === 0 ? '✓ ' : i === 1 ? '◎ ' : '○ '}
              {item}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
