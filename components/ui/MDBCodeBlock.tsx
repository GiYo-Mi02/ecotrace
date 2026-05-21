// components/ui/MDBCodeBlock.tsx — MongoDB Design System Code Block
// Terminal-aesthetic code display on dark canvas
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

interface MDBCodeBlockProps {
  children: string;
  /** Show terminal-style mockup header dots */
  showHeader?: boolean;
  style?: ViewStyle;
}

export default function MDBCodeBlock({ children, showHeader = false, style }: MDBCodeBlockProps) {
  return (
    <View style={[st.container, style]}>
      {showHeader && (
        <View style={st.header}>
          <View style={[st.dot, { backgroundColor: '#FF5F56' }]} />
          <View style={[st.dot, { backgroundColor: '#FFBD2E' }]} />
          <View style={[st.dot, { backgroundColor: '#27C93F' }]} />
        </View>
      )}
      <Text style={st.code}>{children}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    backgroundColor: '#001E2B', // canvas-dark
    borderRadius: 12, // rounded.lg
    padding: 24, // spacing.lg
  },
  header: {
    flexDirection: 'row', gap: 6, marginBottom: 16,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  code: {
    fontFamily: 'SourceCodePro-Regular',
    fontSize: 14, lineHeight: 22, // code-md
    color: '#FFFFFF', // on-dark
  },
});
