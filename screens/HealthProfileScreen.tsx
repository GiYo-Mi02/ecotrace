// screens/HealthProfileScreen.tsx
//
// Allows users to:
//   - Set dietary flags (vegan, gluten-free, etc.) via toggle rows
//   - Enter allergens via a chip input (comma-separated)
//   - Choose health_consciousness_level via 3-button selector
//
// Style: identical to SettingsScreen.tsx (dark card rows, SpaceMono labels)
// Navigation: back to Settings via router.back()

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useHealth } from '@/stores/HealthContext';
import { DIETARY_LABELS } from '@/types/userPreferences';
import type { DietaryFlag, HealthConsciousnessLevel } from '@/types/userPreferences';

const DIET_FLAGS = Object.keys(DIETARY_LABELS) as DietaryFlag[];

const LEVELS: { label: string; value: HealthConsciousnessLevel }[] = [
  { label: 'LOW', value: 'low' },
  { label: 'MEDIUM', value: 'medium' },
  { label: 'HIGH', value: 'high' },
];

const COMMON_ALLERGENS: Array<{ label: string; value: string }> = [
  { label: 'Milk', value: 'milk' },
  { label: 'Egg', value: 'egg' },
  { label: 'Peanuts', value: 'peanuts' },
  { label: 'Tree Nuts', value: 'tree nuts' },
  { label: 'Soy', value: 'soy' },
  { label: 'Wheat', value: 'wheat' },
  { label: 'Fish', value: 'fish' },
  { label: 'Shellfish', value: 'shellfish' },
  { label: 'Sesame', value: 'sesame' },
  { label: 'Mustard', value: 'mustard' },
  { label: 'Celery', value: 'celery' },
  { label: 'Lupin', value: 'lupin' },
  { label: 'Sulphites', value: 'sulphites' },
  { label: 'Alcohol', value: 'alcohol' },
];

function parseAllergens(input: string): string[] {
  return input
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

export default function HealthProfileScreen() {
  const router = useRouter();
  const { preferences, updatePreferences, resetPreferences } = useHealth();
  const [allergenInput, setAllergenInput] = useState(preferences.allergens.join(', '));
  const parsedAllergens = useMemo(() => parseAllergens(allergenInput), [allergenInput]);

  useEffect(() => {
    setAllergenInput(preferences.allergens.join(', '));
  }, [preferences.allergens]);

  const handleToggle = (flag: DietaryFlag) => {
    updatePreferences({
      hasCompletedHealthOnboarding: true,
      dietaryFlags: { ...preferences.dietaryFlags, [flag]: !preferences.dietaryFlags[flag] },
    });
  };

  const handleAllergenCommit = () => {
    const parsed = parseAllergens(allergenInput);

    updatePreferences({
      hasCompletedHealthOnboarding: true,
      allergens: parsed,
    });
  };

  const handleAllergenToggle = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const next = new Set(parsedAllergens);
    if (next.has(normalized)) {
      next.delete(normalized);
    } else {
      next.add(normalized);
    }
    const updated = Array.from(next);
    setAllergenInput(updated.join(', '));
    updatePreferences({
      hasCompletedHealthOnboarding: true,
      allergens: updated,
    });
  };

  const handleLevelChange = (level: HealthConsciousnessLevel) => {
    updatePreferences({
      hasCompletedHealthOnboarding: true,
      healthConsciousnessLevel: level,
    });
  };

  const handleSave = () => {
    handleAllergenCommit();
    router.back();
  };

  const selectedCount = useMemo(() => {
    return Object.values(preferences.dietaryFlags).filter(Boolean).length;
  }, [preferences.dietaryFlags]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBand}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Health Profile</Text>
        <Text style={styles.subtitle}>Personalize every scan with your health goals</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DIETARY PREFERENCES</Text>
          <View style={styles.cardGroup}>
            {DIET_FLAGS.map(flag => (
              <View key={flag} style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>{DIETARY_LABELS[flag]}</Text>
                  <Text style={styles.cardHint}>
                    {preferences.dietaryFlags[flag] ? 'Active preference' : 'Tap to enable'}
                  </Text>
                </View>
                <Switch
                  value={preferences.dietaryFlags[flag]}
                  onValueChange={() => handleToggle(flag)}
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(16,185,129,0.6)' }}
                  thumbColor={preferences.dietaryFlags[flag] ? '#10b981' : '#94a3b8'}
                />
              </View>
            ))}
          </View>
          <Text style={styles.noteText}>{selectedCount} preference{selectedCount === 1 ? '' : 's'} active</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ALLERGENS</Text>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Ingredient Alerts</Text>
              <Text style={styles.cardHint}>Comma-separated, e.g. peanuts, dairy</Text>
              <TextInput
                value={allergenInput}
                onChangeText={setAllergenInput}
                onBlur={handleAllergenCommit}
                onSubmitEditing={handleAllergenCommit}
                placeholder="peanuts, dairy, shellfish"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
                returnKeyType="done"
              />
              <Text style={styles.chipLabel}>Quick picks</Text>
              <View style={styles.chipRow}>
                {COMMON_ALLERGENS.map((item) => {
                  const isActive = parsedAllergens.includes(item.value);
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => handleAllergenToggle(item.value)}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HEALTH GOALS</Text>
          <View style={styles.levelRow}>
            {LEVELS.map(level => {
              const isActive = preferences.healthConsciousnessLevel === level.value;
              return (
                <Pressable
                  key={level.value}
                  onPress={() => handleLevelChange(level.value)}
                  style={[styles.levelPill, isActive && styles.levelPillActive]}
                >
                  <Text style={[styles.levelText, isActive && styles.levelTextActive]}>{level.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.noteText}>Controls how strict health warnings are</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESET</Text>
          <Pressable onPress={resetPreferences} style={styles.resetRow}>
            <Text style={styles.resetText}>Reset to defaults</Text>
          </Pressable>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SAVE</Text>
          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save and Go Back</Text>
          </Pressable>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBand: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  backText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, fontFamily: 'SpaceMono-Regular' },
  title: { fontSize: 24, color: '#ffffff', fontWeight: '600' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    marginBottom: 12,
  },
  cardGroup: { gap: 10 },
  cardRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardLabel: { fontSize: 14, color: '#ffffff', fontWeight: '600', fontFamily: 'SpaceMono-Regular' },
  cardHint: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  input: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    fontSize: 13,
  },
  chipLabel: { marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.6)' },
  chipText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'SpaceMono-Regular' },
  chipTextActive: { color: '#10b981' },
  levelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  levelPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  levelPillActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: 'rgba(16,185,129,0.6)',
  },
  levelText: { fontSize: 12, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', fontFamily: 'SpaceMono-Regular' },
  levelTextActive: { color: '#10b981' },
  noteText: { marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  resetRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  resetText: { color: '#f43f5e', fontWeight: '600', fontSize: 13 },
  saveButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveText: { color: '#0f172a', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
});
