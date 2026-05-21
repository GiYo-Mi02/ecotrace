// components/ui/MDBInput.tsx — MongoDB Design System Input & Search
import React, { useState } from 'react';
import {
  View, TextInput, StyleSheet, type ViewStyle, type TextStyle, type TextInputProps,
} from 'react-native';
import { Search } from 'lucide-react-native';

const C = {
  canvas: '#FFFFFF', ink: '#001E2B', steel: '#889397',
  hairlineStrong: '#C1C7C6', greenDark: '#00684A', surface: '#F9FBFA',
} as const;

// ─── MDBTextInput ─────────────────────────────────────────────────

interface MDBTextInputProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: ViewStyle;
  style?: TextStyle;
}

export function MDBTextInput({ containerStyle, style: s, ...rest }: MDBTextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      <TextInput
        placeholderTextColor={C.steel}
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={[st.input, focused && st.inputFocused, s]}
      />
    </View>
  );
}

// ─── MDBSearchPill ────────────────────────────────────────────────

interface MDBSearchPillProps extends Omit<TextInputProps, 'style'> {
  large?: boolean;
  containerStyle?: ViewStyle;
  style?: TextStyle;
}

export function MDBSearchPill({ large, containerStyle, style: s, ...rest }: MDBSearchPillProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[st.searchWrap, large ? st.searchLg : st.searchSm, focused && st.searchFocus, containerStyle]}>
      <Search size={18} color={C.steel} />
      <TextInput
        placeholderTextColor={C.steel}
        placeholder="Search..."
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        style={[st.searchInput, s]}
      />
    </View>
  );
}

const st = StyleSheet.create({
  input: {
    backgroundColor: C.canvas, color: C.ink,
    borderWidth: 1, borderColor: C.hairlineStrong, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 12, height: 44,
    fontSize: 16, lineHeight: 24,
  },
  inputFocused: {
    borderWidth: 2, borderColor: C.greenDark,
    paddingHorizontal: 15, paddingVertical: 11,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.hairlineStrong,
    borderRadius: 8, paddingHorizontal: 16, gap: 10,
  },
  searchSm: { backgroundColor: C.surface, height: 44 },
  searchLg: { backgroundColor: C.canvas, height: 56 },
  searchFocus: {
    borderWidth: 2, borderColor: C.greenDark, paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1, fontSize: 16, color: C.ink, paddingVertical: 0,
  },
});
