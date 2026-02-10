import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList } from 'react-native';
import { Search, X } from 'lucide-react-native';
import Animated, { FadeInRight, FadeInDown } from 'react-native-reanimated';
import ScoreRing from '@/components/ScoreRing';
import StatusBadge from '@/components/StatusBadge';
import type { ProductScan } from '@/data/mockData';

interface HistoryScreenProps {
  scanHistory: ProductScan[];
  onSelectProduct: (product: ProductScan) => void;
}

type FilterType = 'all' | 'verified' | 'flagged' | 'pending';

export default function HistoryScreen({ scanHistory, onSelectProduct }: HistoryScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filters: { key: FilterType; label: string; color: string }[] = [
    { key: 'all', label: 'ALL', color: '#ffffff' },
    { key: 'verified', label: 'VERIFIED', color: '#10b981' },
    { key: 'flagged', label: 'FLAGGED', color: '#f43f5e' },
    { key: 'pending', label: 'PENDING', color: '#3b82f6' },
  ];

  const filteredHistory = scanHistory.filter(scan => {
    const matchesSearch = scan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || scan.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const renderItem = ({ item, index }: { item: ProductScan; index: number }) => (
    <Animated.View entering={FadeInRight.delay(index * 100).duration(300)}>
      <Pressable
        onPress={() => onSelectProduct(item)}
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <ScoreRing score={item.score} size={48} strokeWidth={3} showLabel={false} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '600' }}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {item.brand} · {item.category}
          </Text>
          <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: 0.5 }}>
            {item.scanDate} · {item.id}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={item.status} size="sm" />
          <Text
            style={{
              fontFamily: 'SpaceMono-Regular',
              fontSize: 18,
              fontWeight: '800',
              color: item.score >= 70 ? '#10b981' : item.score >= 40 ? '#f59e0b' : '#f43f5e',
            }}
          >
            {item.score}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}
      >
        <Text
          style={{
            fontFamily: 'SpaceMono-Regular',
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 3,
          }}
        >
          SCAN LOG
        </Text>
        <Text style={{ fontSize: 22, color: '#ffffff', fontWeight: '700', marginTop: 4 }}>
          History
        </Text>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(300)}
        style={{ paddingHorizontal: 20, marginBottom: 12 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 42,
            gap: 8,
          }}
        >
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={{
              flex: 1,
              color: '#ffffff',
              fontSize: 13,
              fontFamily: 'SpaceMono-Regular',
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Filter Pills */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(300)}
        style={{
          flexDirection: 'row',
          paddingHorizontal: 20,
          gap: 8,
          marginBottom: 16,
        }}
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={{
                backgroundColor: isActive ? `${filter.color}20` : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: isActive ? `${filter.color}40` : 'rgba(255,255,255,0.1)',
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: 'SpaceMono-Regular',
                  fontSize: 9,
                  color: isActive ? filter.color : 'rgba(255,255,255,0.5)',
                  letterSpacing: 1.5,
                }}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* Results count */}
      <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
        <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
          {filteredHistory.length} RESULTS
        </Text>
      </View>

      {/* Scan List */}
      <FlatList
        data={filteredHistory}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>
              No scans found
            </Text>
          </View>
        }
      />
    </View>
  );
}
