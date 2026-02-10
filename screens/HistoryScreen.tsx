// screens/HistoryScreen.tsx — REWRITTEN to use context + empty state + clear history
// Changes from audit:
//  - Props-based → reads from ScanContext
//  - Added EmptyState component when no scans
//  - Added "Clear History" functionality
//  - History starts empty (no pre-loaded mock data)

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
import type { ProductScan } from '@/types/product';

type FilterType = 'all' | 'verified' | 'flagged' | 'pending';

export default function HistoryScreen() {
  const router = useRouter();
  const { scanHistory, setCurrentProduct, clearHistory } = useScan();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filters: { key: FilterType; label: string; color: string }[] = [
    { key: 'all', label: 'ALL', color: '#ffffff' },
    { key: 'verified', label: 'VERIFIED', color: '#10b981' },
    { key: 'flagged', label: 'FLAGGED', color: '#f43f5e' },
    { key: 'pending', label: 'PENDING', color: '#3b82f6' },
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
    Alert.alert(
      'Clear Scan History',
      'This will permanently delete all your scan history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearHistory },
      ]
    );
  };

  const handleGoToScanner = () => {
    router.push('/(tabs)/scanner');
  };

  const renderItem = ({ item, index }: { item: ProductScan; index: number }) => (
    <Animated.View entering={FadeInRight.delay(index * 80).duration(300)}>
      <Pressable onPress={() => handleSelectProduct(item)} style={styles.scanCard}>
        <ScoreRing score={item.score} size={48} strokeWidth={3} showLabel={false} />
        <View style={{ flex: 1 }}>
          <Text style={styles.scanName}>{item.name}</Text>
          <Text style={styles.scanMeta}>{item.brand} · {item.category}</Text>
          <Text style={styles.scanDate}>{item.scanDate} · {item.id}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={item.status} size="sm" />
          <Text style={[styles.scanScore, {
            color: item.score >= 70 ? '#10b981' : item.score >= 40 ? '#f59e0b' : '#f43f5e',
          }]}>
            {item.score}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <DemoBanner />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSubtitle}>SCAN LOG</Text>
            <Text style={styles.headerTitle}>History</Text>
          </View>
          {scanHistory.length > 0 && (
            <Pressable onPress={handleClearHistory} style={styles.clearButton}>
              <Trash2 size={14} color="#f43f5e" />
              <Text style={styles.clearText}>CLEAR</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Search bar */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Filter pills */}
      <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.filterRow}>
        {filters.map(filter => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={[styles.filterPill, isActive && { backgroundColor: `${filter.color}20`, borderColor: `${filter.color}40` }]}
            >
              <Text style={[styles.filterText, isActive && { color: filter.color }]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* Results count */}
      {scanHistory.length > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsText}>{filteredHistory.length} RESULTS</Text>
        </View>
      )}

      {/* Scan list or empty state */}
      {scanHistory.length === 0 ? (
        <EmptyState
          title="No scans yet"
          description="Scan a product barcode to see its environmental impact score and supply chain audit."
          actionLabel="SCAN YOUR FIRST PRODUCT"
          onAction={handleGoToScanner}
        />
      ) : (
        <FlatList
          data={filteredHistory}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="No matches"
              description="Try adjusting your search or filters."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerSubtitle: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },
  headerTitle: { fontSize: 22, color: '#ffffff', fontWeight: '700', marginTop: 4 },
  clearButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(244,63,94,0.1)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  clearText: { fontFamily: 'SpaceMono-Regular', fontSize: 9, color: '#f43f5e', letterSpacing: 1 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingHorizontal: 12, height: 42, gap: 8,
  },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 13, fontFamily: 'SpaceMono-Regular' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  filterPill: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  filterText: { fontFamily: 'SpaceMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5 },
  resultsCount: { paddingHorizontal: 20, marginBottom: 10 },
  resultsText: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
  scanCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  scanName: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  scanMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  scanDate: { fontFamily: 'SpaceMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: 0.5 },
  scanScore: { fontFamily: 'SpaceMono-Regular', fontSize: 18, fontWeight: '800' },
});
