import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, TouchableOpacity, Platform, Share } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  HardDrive,
  CloudOff,
  Shield,
  FileDown,
  Trash2,
  Info,
  Mail,
  Check,
  Crown,
  SunMoon,
  Archive,
} from 'lucide-react-native';
import { useThemeColors, useThemeMode } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { useReceipts } from '@/context/ReceiptsContext';
import SettingsRow from '@/components/SettingsRow';
import { currencies, Currency } from '@/utils/currency';
import { createLocalBackup, restoreLocalBackup } from '@/services/backup';

export default function SettingsScreen() {
  const router = useRouter();
  const { receipts, defaultCurrency, setDefaultCurrency, clearAll, reload } = useReceipts();
  const { mode, setTheme } = useThemeMode();
  const Colors = useThemeColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handleToggleTheme = (value: boolean) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setTheme(value ? 'dark' : 'light');
  };

  const handleClearAll = () => {
    if (receipts.length === 0) return;
    Alert.alert(
      'Clear All Data',
      `This permanently deletes ${receipts.length} ${receipts.length === 1 ? 'receipt' : 'receipts'} and their photos from ReceiptSnap. Photos in your device library are not touched. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => void clearAll(),
        },
      ]
    );
  };

  const handleContactSupport = () => {
    void Linking.openURL('mailto:support@receiptsnap.app?subject=ReceiptSnap%20Support');
  };

  const handleBackup = async () => {
    try {
      const backup = await createLocalBackup();
      if (Platform.OS === 'web') {
        const { Blob: BlobCtor, URL: UrlObj, document: doc } = globalThis as unknown as {
          Blob?: new (parts: string[], options?: { type: string }) => unknown;
          URL?: { createObjectURL(obj: unknown): string; revokeObjectURL(url: string): void };
          document?: { createElement(tag: 'a'): { href: string; download: string; click(): void } };
        };
        if (BlobCtor && UrlObj && doc) {
          const url = UrlObj.createObjectURL(new BlobCtor([backup.json], { type: 'application/json' }));
          const anchor = doc.createElement('a');
          anchor.href = url;
          anchor.download = backup.filename;
          anchor.click();
          UrlObj.revokeObjectURL(url);
        }
        return;
      }
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backup.uri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: backup.filename,
        });
        return;
      }
      await Share.share({
        title: backup.filename,
        url: backup.uri,
      });
    } catch (error) {
      Alert.alert('Backup failed', 'The backup file could not be created. Try again.');
      console.warn('[backup] failed', error);
    }
  };

  const handleRestore = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const FileSystem = await import('expo-file-system/legacy');
      const json = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const restored = await restoreLocalBackup(json);
      await reload();
      Alert.alert(
        'Backup restored',
        `${restored.receipts} receipts and ${restored.photos} photos were copied onto this device.`
      );
    } catch {
      Alert.alert('Restore failed', 'That file is not a ReceiptSnap backup.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon={<HardDrive size={20} color={Colors.textSecondary} />}
            title="On-Device Storage"
            subtitle={
              receipts.length === 0 ? 'No receipts stored yet' : 'Stored on this device'
            }
            showArrow={false}
            rightElement={
              <View style={styles.storageBadge}>
                <Text style={styles.storageBadgeText}>
                  {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'}
                </Text>
              </View>
            }
          />
          <View style={styles.divider} />
          {/* Truthful placeholder — opens a clearly labelled product preview,
              never a fake working toggle. */}
          <SettingsRow
            icon={<CloudOff size={20} color={Colors.textTertiary} />}
            title="Cloud Backup"
            subtitle="Local-first today — encrypted backup planned"
            onPress={() => router.push('/preview?topic=cloud')}
            rightElement={
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>Coming soon</Text>
              </View>
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon={<SunMoon size={20} color={Colors.textSecondary} />}
            title="Dark Mode"
            subtitle={mode === 'dark' ? 'Dark theme on' : 'Light theme on'}
            showArrow={false}
            toggle={{ value: mode === 'dark', onValueChange: handleToggleTheme }}
            testID="dark-mode-toggle"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.sectionContent}>
          {currencies.map((c: { code: Currency; symbol: string; label: string }, index) => (
            <React.Fragment key={c.code}>
              {index > 0 && <View style={styles.divider} />}
              <SettingsRow
                icon={<Text style={styles.currencyIcon}>{c.symbol}</Text>}
                title={c.label}
                subtitle={c.code}
                onPress={() => setDefaultCurrency(c.code)}
                showArrow={false}
                rightElement={
                  defaultCurrency === c.code ? <Check size={18} color={Colors.primary} strokeWidth={2.5} /> : null
                }
              />
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.sectionFootnote}>Used for new receipts and totals.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ReceiptSnap Pro</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon={<Crown size={20} color={Colors.textSecondary} />}
            title="What Pro will include"
            subtitle="Core features stay free and offline"
            onPress={() => router.push('/preview?topic=pro')}
            rightElement={
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>Preview</Text>
              </View>
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon={<FileDown size={20} color={Colors.textSecondary} />}
            title="Export Data"
            subtitle="CSV or PDF from your receipts"
            onPress={() => router.push('/export')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Archive size={20} color={Colors.textSecondary} />}
            title="Backup to File"
            subtitle="Save receipts and photos outside the app"
            onPress={() => void handleBackup()}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Archive size={20} color={Colors.textSecondary} />}
            title="Restore from File"
            subtitle="Import a ReceiptSnap backup"
            onPress={() => void handleRestore()}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Shield size={20} color={Colors.textSecondary} />}
            title="Warranties & Returns"
            subtitle="Dates stored on this device"
            onPress={() => router.push('/protection')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Trash2 size={20} color={Colors.error} />}
            title="Clear All Data"
            subtitle={receipts.length === 0 ? 'No receipts to delete' : 'Permanently delete all receipts'}
            onPress={handleClearAll}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.privacyNote}>
          <Shield size={16} color={Colors.primary} />
          <Text style={styles.privacyNoteText}>
            All data stays on your device. Uninstalling ReceiptSnap deletes its copy of receipts
            unless you saved a backup file. Photos in your gallery are never deleted.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            icon={<Mail size={20} color={Colors.textSecondary} />}
            title="Contact Support"
            onPress={handleContactSupport}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Info size={20} color={Colors.textSecondary} />}
            title="About"
            subtitle="Version 1.0.0"
            showArrow={false}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>ReceiptSnap</Text>
        <Text style={styles.footerVersion}>Private. Simple. Useful.</Text>
      </View>
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
    paddingBottom: 32,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionFootnote: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionContent: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 66,
  },
  storageBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  storageBadgeText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
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
  currencyIcon: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
  },
  footerVersion: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 4,
  },
});
