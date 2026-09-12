import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { FileSpreadsheet, FileText, Check, Crown } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useRouter } from 'expo-router';
import { Receipt } from '@/models/types';
import { buildExportFilename } from '@/utils/csv';
import { shareCsv, sharePdf } from '@/utils/exportShare';
import Button from '@/components/Button';

type ExportFormat = 'csv' | 'pdf';
type ExportScope = 'all' | 'month' | 'range' | 'category';

export default function ExportScreen() {
  const { receipts, categories } = useReceipts();
  const { hasPro } = useSubscription();
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('all');
  const [category, setCategory] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const scoped = useMemo<Receipt[]>(() => {
    if (scope === 'month') {
      return receipts.filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() === month && d.getFullYear() === year;
      });
    }
    if (scope === 'range') {
      return receipts.filter((r) => {
        if (fromDate && r.date < fromDate) return false;
        if (toDate && r.date > toDate) return false;
        return true;
      });
    }
    if (scope === 'category') {
      return category === 'All' ? receipts : receipts.filter((r) => r.category === category);
    }
    return receipts;
  }, [receipts, scope, category, fromDate, toDate, month, year]);

  const handleExport = async () => {
    if (scoped.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        if (!hasPro) {
          router.push('/paywall?reason=export');
          return;
        }
        await sharePdf(scoped);
      } else {
        await shareCsv(scoped, buildExportFilename());
      }
    } catch (error) {
      Alert.alert(
        'Export failed',
        'The file could not be generated. Your receipts are unaffected — try again.',
        [{ text: 'OK' }]
      );
      console.warn('[export] failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  const dateRangeLabel =
    scope === 'all'
      ? 'All time'
      : scope === 'month'
        ? now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : scope === 'range'
          ? `${fromDate || '…'} – ${toDate || '…'}`
          : category;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Format</Text>
        <View style={styles.formatOptions}>
          <TouchableOpacity
            style={[styles.formatOption, format === 'csv' && styles.formatOptionSelected]}
            onPress={() => setFormat('csv')}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: format === 'csv' }}
          >
            <FileSpreadsheet
              size={24}
              color={format === 'csv' ? Colors.primary : Colors.textSecondary}
            />
            <View style={styles.formatInfo}>
              <Text style={[styles.formatName, format === 'csv' && styles.formatNameSelected]}>CSV</Text>
              <Text style={styles.formatDesc}>Opens in Excel, Numbers, or Sheets</Text>
            </View>
            {format === 'csv' && (
              <View style={styles.checkmark}>
                <Check size={18} color={Colors.primary} strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatOption, format === 'pdf' && styles.formatOptionSelected]}
            onPress={() => setFormat('pdf')}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: format === 'pdf' }}
          >
            <FileText size={24} color={format === 'pdf' ? Colors.primary : Colors.textSecondary} />
            <View style={styles.formatInfo}>
              <View style={styles.formatTitleRow}>
                <Text style={[styles.formatName, format === 'pdf' && styles.formatNameSelected]}>PDF</Text>
                {!hasPro ? (
                  <View style={styles.proChip}>
                    <Crown size={11} color={Colors.primary} />
                    <Text style={styles.proChipText}>Pro</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.formatDesc}>Print-ready report generated on device</Text>
            </View>
            {format === 'pdf' && (
              <View style={styles.checkmark}>
                <Check size={18} color={Colors.primary} strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scope</Text>
        <View style={styles.scopeRow}>
          {(
            [
              { key: 'all', label: 'All receipts' },
              { key: 'month', label: 'This month' },
              { key: 'range', label: 'Date range' },
              { key: 'category', label: 'Category' },
            ] as { key: ExportScope; label: string }[]
          ).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.scopeChip, scope === opt.key && styles.scopeChipActive]}
              onPress={() => setScope(opt.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: scope === opt.key }}
            >
              <Text style={[styles.scopeText, scope === opt.key && styles.scopeTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {scope === 'range' ? (
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              accessibilityLabel="From date"
            />
            <TextInput
              style={styles.rangeInput}
              value={toDate}
              onChangeText={setToDate}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              accessibilityLabel="To date"
            />
          </View>
        ) : null}
        {scope === 'category' ? (
          <View style={styles.scopeRow}>
            {['All', ...categories.map((c) => c.name)].map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.scopeChip, category === name && styles.scopeChipActive]}
                onPress={() => setCategory(name)}
              >
                <Text style={[styles.scopeText, category === name && styles.scopeTextActive]}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Receipts</Text>
            <Text style={styles.summaryValue}>{scoped.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date Range</Text>
            <Text style={styles.summaryValue}>{dateRangeLabel}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Format</Text>
            <Text style={styles.summaryValue}>{format.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <Button
        title={scoped.length === 0 ? 'Nothing to Export' : `Export ${scoped.length} Receipts`}
        onPress={() => void handleExport()}
        disabled={scoped.length === 0}
        loading={isExporting}
        style={styles.exportButton}
        testID="export-button"
      />
      <Text style={styles.exportNote}>
        Generated on your device. Nothing leaves Memento unless you share the file.
      </Text>

      {!hasPro ? (
        <TouchableOpacity
          style={styles.proSection}
          onPress={() => router.push('/paywall?reason=export')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to Memento Pro"
        >
          <View style={styles.proHeader}>
            <Crown size={20} color={Colors.primary} />
            <Text style={styles.proTitle}>Memento Pro</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PDF export</Text>
            </View>
          </View>
          <Text style={styles.proDescription}>
            CSV stays free. Pro unlocks PDF reports, unlimited scans, and advanced organization.
            Receipts still stay on this device.
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  formatOptions: {
    gap: 12,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formatOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted + '20',
  },
  formatOptionDisabled: {
    opacity: 0.6,
  },
  formatInfo: {
    flex: 1,
    marginLeft: 14,
  },
  formatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proChipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  formatName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  formatNameSelected: {
    color: Colors.primary,
  },
  formatNameDisabled: {
    color: Colors.textTertiary,
  },
  formatDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  soonBadgeText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scopeChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryMuted,
  },
  scopeText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  scopeTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  exportButton: {
    marginBottom: 12,
  },
  exportNote: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 32,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rangeInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  proSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  proTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  proBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
  },
  proDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  proFeatures: {
    gap: 12,
  },
  proFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proFeatureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryMuted + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proFeatureText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
});
