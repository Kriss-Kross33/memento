import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SectionList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, Camera, SlidersHorizontal } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import { Receipt, formatMonthLabel } from '@/mocks/receipts';
import ReceiptRow from '@/components/ReceiptRow';
import EmptyState from '@/components/EmptyState';
import FilterSheet from '@/components/FilterSheet';
import {
  ReceiptFilters,
  DEFAULT_FILTERS,
  isFilterActive,
  filterAndSortReceipts,
  describeFilters,
} from '@/utils/receiptFilters';

interface Section {
  key: string;
  title: string;
  data: Receipt[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const sectionTitle = (dateStr: string): string => {
  const date = new Date(dateStr);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((startOfToday.getTime() - new Date(dateStr).setHours(0, 0, 0, 0)) / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return formatMonthLabel(date);
};

export default function LibraryScreen() {
  const router = useRouter();
  const { receipts, categories } = useReceipts();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [filters, setFilters] = useState<ReceiptFilters>(DEFAULT_FILTERS);
  const [sheetVisible, setSheetVisible] = useState(false);
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const filtersActive = isFilterActive(filters);

  /**
   * Structured search across merchant, category, notes, receipt number,
   * amount, date, tags, and line-item names — all local.
   */
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = receipts.filter((r) => {
      if (activeCategory !== 'All' && r.category !== activeCategory) return false;
      if (!query) return true;
      const amountText = r.amount.toFixed(2);
      return (
        r.merchant.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query) ||
        (r.notes ?? '').toLowerCase().includes(query) ||
        (r.receiptNumber ?? '').toLowerCase().includes(query) ||
        r.date.toLowerCase().includes(query) ||
        amountText.includes(query) ||
        String(r.amount).includes(query) ||
        (r.tags ?? []).some((tag) => tag.toLowerCase().includes(query)) ||
        (r.items ?? []).some((item) => item.label.toLowerCase().includes(query))
      );
    });
    return filterAndSortReceipts(matching, filters);
  }, [receipts, search, activeCategory, filters]);

  const sections = useMemo<Section[]>(() => {
    const map = new Map<string, Receipt[]>();
    for (const receipt of filtered) {
      const title = sectionTitle(receipt.date);
      const bucket = map.get(title);
      if (bucket) {
        bucket.push(receipt);
      } else {
        map.set(title, [receipt]);
      }
    }
    return Array.from(map.entries()).map(([key, data]) => ({ key, title: key, data }));
  }, [filtered]);

  const isEmptyLibrary = receipts.length === 0;
  const hasFilters =
    search.trim().length > 0 || activeCategory !== 'All' || filtersActive;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Merchant, amount, date, tag…"
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
            autoCorrect={false}
            testID="library-search"
            accessibilityLabel="Search receipts"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, filtersActive && styles.filterButtonActive]}
          onPress={() => setSheetVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          testID="library-filters-button"
        >
          <SlidersHorizontal
            size={17}
            color={filtersActive ? Colors.primary : Colors.textSecondary}
          />
          {filtersActive && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {['All', ...categories.map((c) => c.name)].map((name) => (
            <TouchableOpacity
              key={name}
              style={[styles.filterChip, activeCategory === name && styles.filterChipActive]}
              onPress={() => setActiveCategory(name)}
              accessibilityRole="button"
              accessibilityState={{ selected: activeCategory === name }}
            >
              <Text
                style={[styles.filterText, activeCategory === name && styles.filterTextActive]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isEmptyLibrary ? (
        <EmptyState
          title="No receipts yet"
          message="Scan your first receipt to start building your private receipt library."
          action={
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => router.push('/(tabs)/scan')}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <Camera size={18} color={Colors.surface} strokeWidth={2.5} />
              <Text style={styles.emptyActionText}>Scan Receipt</Text>
            </TouchableOpacity>
          }
        />
      ) : sections.length === 0 ? (
        <EmptyState
          title="No receipts found"
          message={
            filtersActive
              ? `Nothing matches ${describeFilters(filters).toLowerCase()}${
                  activeCategory !== 'All' ? ` in ${activeCategory}` : ''
                }.`
              : activeCategory !== 'All'
                ? `Nothing in ${activeCategory} matches your search.`
                : 'Try a different search term.'
          }
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReceiptRow receipt={item} onPress={() => router.push(`/receipt/${item.id}`, { withAnchor: true })} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>
                {section.data.length} {section.data.length === 1 ? 'receipt' : 'receipts'}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderSectionFooter={({ section }) =>
            section === sections[sections.length - 1] ? null : <View style={styles.sectionGap} />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <FilterSheet
        visible={sheetVisible}
        value={filters}
        onApply={(next) => {
          setFilters(next);
          setSheetVisible(false);
        }}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: Colors.primaryMuted,
    backgroundColor: Colors.primaryMuted + '30',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 34,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryMuted,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 82,
  },
  sectionGap: {
    height: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.surface,
  },
});
