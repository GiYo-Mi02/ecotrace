import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface StatusBadgeProps {
  status: 'verified' | 'flagged' | 'pending';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const STATUS_CONFIG = {
  verified: {
    label: 'VERIFIED',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
    Icon: CheckCircle,
  },
  flagged: {
    label: 'HIGH RISK',
    color: '#f43f5e',
    bgColor: 'rgba(244,63,94,0.15)',
    borderColor: 'rgba(244,63,94,0.3)',
    Icon: AlertTriangle,
  },
  pending: {
    label: 'PENDING',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.3)',
    Icon: Clock,
  },
};

const SIZE_CONFIG = {
  sm: { fontSize: 8, iconSize: 10, px: 6, py: 3 },
  md: { fontSize: 10, iconSize: 12, px: 8, py: 4 },
  lg: { fontSize: 12, iconSize: 14, px: 10, py: 5 },
};

export default function StatusBadge({ status, size = 'md', pulse = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (pulse && status === 'flagged') {
      opacity.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
    }
  }, [pulse, status]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: config.bgColor,
          borderWidth: 1,
          borderColor: config.borderColor,
          borderRadius: 6,
          paddingHorizontal: sizeConfig.px,
          paddingVertical: sizeConfig.py,
        },
      ]}
    >
      <config.Icon size={sizeConfig.iconSize} color={config.color} />
      <Text
        style={{
          fontFamily: 'SpaceMono-Regular',
          fontSize: sizeConfig.fontSize,
          color: config.color,
          fontWeight: '600',
          letterSpacing: 1,
        }}
      >
        {config.label}
      </Text>
    </Animated.View>
  );
}
