// components/EmptyState.tsx — MongoDB DS styled empty state
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Scan } from 'lucide-react-native';
import { colors } from '@/components/ui/theme';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon || <Scan size={48} color={colors.stone} />}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingTop: 60, gap: 12,
  },
  title: {
    fontSize: 16, color: colors.slate, fontWeight: '600',
    textAlign: 'center', marginTop: 8,
  },
  description: {
    fontSize: 14, color: colors.steel, textAlign: 'center',
    lineHeight: 21,
  },
  button: {
    backgroundColor: colors.brandGreen,
    borderRadius: 9999,
    paddingHorizontal: 22, paddingVertical: 10, marginTop: 8,
  },
  buttonText: {
    fontSize: 14, fontWeight: '600', color: colors.onPrimary,
  },
});
