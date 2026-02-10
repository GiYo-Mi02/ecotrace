// app/methodology.tsx — Scoring Methodology page
// AUDIT FIX: Transparent, documented scoring algorithm

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ArrowLeft, Leaf, Package, Truck, FlaskConical, Award, Info } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

interface FactorRowProps {
  icon: React.ComponentType<any>;
  name: string;
  weight: string;
  color: string;
  description: string;
}

function FactorRow({ icon: Icon, name, weight, color, description }: FactorRowProps) {
  return (
    <View style={styles.factorCard}>
      <View style={styles.factorHeader}>
        <View style={[styles.factorIcon, { backgroundColor: `${color}20` }]}>
          <Icon size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.factorName}>{name}</Text>
          <Text style={styles.factorWeight}>{weight}</Text>
        </View>
      </View>
      <Text style={styles.factorDesc}>{description}</Text>
    </View>
  );
}

export default function MethodologyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
          <Text style={styles.title}>Scoring Methodology</Text>
          <Text style={styles.subtitle}>ECOTRACE SUSTAINABILITY INDEX v0.1</Text>
        </Animated.View>

        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OVERVIEW</Text>
          <Text style={styles.bodyText}>
            The ECOTRACE Sustainability Index is a composite score from 0-100 based on publicly
            available product data. It aggregates five environmental factors to provide a quick,
            transparent snapshot of a product's environmental footprint.
          </Text>
          <View style={styles.disclaimerBox}>
            <Info size={14} color="#f59e0b" />
            <Text style={styles.disclaimerText}>
              Scores are estimates, not certified assessments. Data completeness varies by product.
              The confidence indicator shows how much data was available.
            </Text>
          </View>
        </View>

        {/* Scoring Factors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SCORING FACTORS</Text>

          <FactorRow
            icon={Leaf}
            name="Eco-Impact Score"
            weight="40% weight"
            color="#10b981"
            description="Based on the product's Eco-Score grade (A-E) from Open Food Facts, which considers lifecycle analysis, carbon footprint, and environmental impact. A = 40pts, B = 32pts, C = 24pts, D = 16pts, E = 8pts. Unknown defaults to 20pts (neutral midpoint)."
          />

          <FactorRow
            icon={Package}
            name="Packaging Assessment"
            weight="20% weight"
            color="#3b82f6"
            description="Evaluates packaging materials for recyclability and environmental impact. Positive: recyclable, recycled content, glass, cardboard. Negative: plastic, non-recyclable, polystyrene. Score range: 0-20pts."
          />

          <FactorRow
            icon={Truck}
            name="Transport Estimate"
            weight="15% weight"
            color="#8b5cf6"
            description="Rough distance estimate based on stated product origins and manufacturing locations. Local/national = 15pts, regional (same continent) = 10pts, international = 5pts, unknown = 7pts."
          />

          <FactorRow
            icon={FlaskConical}
            name="Processing Level"
            weight="15% weight"
            color="#f59e0b"
            description="Based on the NOVA food classification system. NOVA 1 (unprocessed) = 15pts, NOVA 2 (processed ingredients) = 11pts, NOVA 3 (processed) = 7pts, NOVA 4 (ultra-processed) = 3pts."
          />

          <FactorRow
            icon={Award}
            name="Certifications"
            weight="10% weight"
            color="#ec4899"
            description="Bonus points for recognized environmental and ethical certifications: organic, fair-trade, Rainforest Alliance, MSC, FSC, etc. 3pts per certification, max 10pts."
          />
        </View>

        {/* Confidence Levels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONFIDENCE LEVELS</Text>
          <Text style={styles.bodyText}>
            Each score includes a confidence indicator based on how many data points were available:
          </Text>

          {[
            { level: 'HIGH', color: '#10b981', desc: '4-5 data factors available. Most reliable estimate.' },
            { level: 'ESTIMATED', color: '#f59e0b', desc: '2-3 data factors available. Reasonable estimate with some interpolation.' },
            { level: 'LIMITED DATA', color: '#f43f5e', desc: '0-1 data factors available. Category-level defaults used.' },
          ].map(({ level, color, desc }) => (
            <View key={level} style={styles.confidenceRow}>
              <View style={[styles.confidenceDot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.confidenceLabel, { color }]}>{level}</Text>
                <Text style={styles.confidenceDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Data Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA SOURCES</Text>
          <Text style={styles.bodyText}>
            Product data is sourced from Open Food Facts, a free, open, collaborative database of
            food products from around the world with over 3 million products. Data is contributed
            by volunteers and producers.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>
            Open Food Facts is licensed under the Open Database License (ODbL). Product images
            are under the Creative Commons Attribution ShareAlike licence.
          </Text>
        </View>

        {/* Limitations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIMITATIONS</Text>
          <Text style={styles.bodyText}>
            • Scores are NOT certified environmental assessments{'\n'}
            • Data completeness varies significantly between products{'\n'}
            • Transport estimates are rough heuristics, not actual logistics data{'\n'}
            • Packaging analysis relies on free-text descriptions{'\n'}
            • No accounting for seasonal variations or production method changes{'\n'}
            • The algorithm is continually improved — scores may change between versions
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backText: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  title: { fontSize: 22, color: '#ffffff', fontWeight: '700' },
  subtitle: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionTitle: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 12 },
  bodyText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 22 },
  disclaimerBox: {
    flexDirection: 'row', gap: 10, marginTop: 12, padding: 12,
    backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', borderRadius: 10,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
  factorCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  factorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  factorIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  factorName: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  factorWeight: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  factorDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
  confidenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  confidenceDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  confidenceLabel: { fontFamily: 'SpaceMono-Regular', fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  confidenceDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 16, marginTop: 2 },
});
