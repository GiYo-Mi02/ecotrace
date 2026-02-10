import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface CornerBracketsProps {
  size?: number;
  color?: string;
  pulseSpeed?: number;
}

export default function CornerBrackets({ 
  size = 24, 
  color = '#10b981',
  pulseSpeed = 1500 
}: CornerBracketsProps) {
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: pulseSpeed, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const bracketStyle = {
    width: size,
    height: size,
    borderColor: color,
  };

  return (
    <>
      {/* Top Left */}
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            ...bracketStyle,
            borderTopWidth: 2,
            borderLeftWidth: 2,
          },
        ]}
      />
      {/* Top Right */}
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            top: 0,
            right: 0,
            ...bracketStyle,
            borderTopWidth: 2,
            borderRightWidth: 2,
          },
        ]}
      />
      {/* Bottom Left */}
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            ...bracketStyle,
            borderBottomWidth: 2,
            borderLeftWidth: 2,
          },
        ]}
      />
      {/* Bottom Right */}
      <Animated.View
        style={[
          animatedStyle,
          {
            position: 'absolute',
            bottom: 0,
            right: 0,
            ...bracketStyle,
            borderBottomWidth: 2,
            borderRightWidth: 2,
          },
        ]}
      />
    </>
  );
}
