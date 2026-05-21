// screens/HistoryScreen.tsx — MongoDB Design System
// White surface with card-base scan items, search pill, pill tab filters

import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, Alert, StyleSheet } from 'react-native';
import { Search, X, Trash2 } from 'lucide-react-native';
import Animated, { FadeInRight, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import ScoreRing from '@/components/ScoreRing';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';
import { colors } from '@/components/ui/theme';
import type { ProductScan } from '@/types/product';

type FilterType = 'all' | 'verified' | 'flagged' | 'pending';

export default function HistoryScreen() {
  const router = useRouter();
  const { scanHistory, setCurrentProduct, clearHistory } = useScan();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'verified', label: 'VERIFIED' },
    { key: 'flagged', label: 'FLAGGED' },
    { key: 'pending', label: 'PENDING' },
  ];

  const filteredHistory = scanHistory.filter(scan => {
    const matchesSearch =
      scan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || scan.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleSelectProduct = (product: ProductScan) => {
    setCurrentProduct(product);
    router.push('/impact');
  };

  const handleClearHistory = () => {
    Alert.alert('Clear Scan History',
      'This will permanently delete all your scan history. This cannot be undone.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear All', style: 'destructive', onPress: clearHistory }]
    );
  };

  const renderItem = ({ item, index }: { item: ProductScan; index: number }) => {
    const scoreColor = item.score >= 70 ? colors.brandGreenDark : item.score >= 40 ? colors.accentOrange : '#DC2626';
    return (
      <Animated.View entering={FadeInRight.delay(index * 80).duration(300)}>
        <Pressable onPress={() => handleSelectProduct(item)} style={s.scanCard}>
          <ScoreRing score={item.score} size={48} strokeWidth={3} showLabel={false} />
          <View style={{ flex: 1 }}>
            <Text style={s.scanName}>{item.name}</Text>
            <Text style={s.scanMeta}>{item.brand} · {item.category}</Text>
            <Text style={s.scanDate}>{item.scanDate} · {item.id}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <StatusBadge status={item.status} size="sm" />
            <Text style={[s.scanScore, { color: scoreColor }]}>{item.score}</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={s.container}>
      <DemoBanner />

      {/* Dark hero band header */}
      <View style={s.headerBand}>
        <Animated.View entering={FadeInDown.duration(300)} style={s.headerRow}>
          <View>
            <Text style={s.headerEyebrow}>SCAN LOG</Text>
            <Text style={s.headerTitle}>History</Text>
          </View>
          {scanHistory.length > 0 && (
            <Pressable onPress={handleClearHistory} style={s.clearButton}>
              <Trash2 size={14} color="#DC2626" />
              <Text style={s.clearText}>CLEAR</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>

      {/* White content surface */}
      <View style={s.contentSurface}>
        {/* Search bar */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={s.searchContainer}>
          <View style={s.searchBar}>
            <Search size={16} color={colors.steel} />
            <TextInput
              value={searchQuery} onChangeText={setSearchQuery}
              placeholder="Search products..."
              placeholderTextColor={colors.steel}
              style={s.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.steel} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Filter pills */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={s.filterRow}>
          {filters.map(filter => {
            const isActive = activeFilter === filter.key;
            return (
              <Pressable key={filter.key} onPress={() => setActiveFilter(filter.key)}
                style={[s.filterPill, isActive && s.filterPillActive]}>
                <Text style={[s.filterText, isActive && s.filterTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Results count */}
        {scanHistory.length > 0 && (
          <View style={s.resultsCount}>
            <Text style={s.resultsText}>{filteredHistory.length} RESULTS</Text>
          </View>
        )}

        {/* List */}
        {scanHistory.length === 0 ? (
          <EmptyState
            title="No scans yet"
            description="Scan a product barcode to see its environmental impact score and supply chain audit."
            actionLabel="SCAN YOUR FIRST PRODUCT"
            onAction={() => router.push('/(tabs)/scanner')}
          />
        ) : (
          <FlatList
            data={filteredHistory}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState title="No matches" description="Try adjusting your search or filters." />}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  // Dark header band
  headerBand: { backgroundColor: colors.brandTealDeep, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerEyebrow: { fontSize: 11, fontWeight: '600', color: colors.brandGreen, letterSpacing: 3 },
  headerTitle: { fontSize: 28, color: colors.onDark, fontWeight: '500', marginTop: 4, letterSpacing: -0.5 },
  clearButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(220,38,38,0.1)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)',
    borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6,
  },
  clearText: { fontSize: 11, fontWeight: '600', color: '#DC2626', letterSpacing: 1 },
  // White content
  contentSurface: { flex: 1, backgroundColor: colors.canvas },
  searchContainer: { paddingHorizontal: 20, paddingTop: 16, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: 8,
    paddingHorizontal: 12, height: 44, gap: 8,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  filterPill: {
    borderWidth: 1, borderColor: colors.hairline,
    borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 7,
  },
  filterPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontSize: 11, fontWeight: '600', color: colors.steel, letterSpacing: 1 },
  filterTextActive: { color: colors.onDark },
  resultsCount: { paddingHorizontal: 20, marginBottom: 10 },
  resultsText: { fontSize: 11, fontWeight: '600', color: colors.steel, letterSpacing: 1 },
  // Scan card
  scanCard: {
    backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline,
    borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  scanName: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  scanMeta: { fontSize: 12, color: colors.slate, marginTop: 2 },
  scanDate: { fontSize: 11, color: colors.stone, marginTop: 4 },
  scanScore: { fontFamily: 'SourceCodePro-Bold', fontSize: 18 },
});
