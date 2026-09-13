import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Receipt } from '@/models/types';
import { reminderFireDate } from '@/utils/receipt/lifecycle';

const SETTINGS_KEY = 'memento_reminder_settings';
const RETURN_DAYS_BEFORE = 3;
const WARRANTY_DAYS_BEFORE = 30;

export type ReminderSettings = {
  enabled: boolean;
};

const DEFAULT_SETTINGS: ReminderSettings = { enabled: false };

export const loadReminderSettings = async (): Promise<ReminderSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return { enabled: parsed.enabled === true };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveReminderSettings = async (settings: ReminderSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const notificationId = (kind: 'return' | 'warranty', receiptId: string): string =>
  `memento-${kind}-${receiptId}`;

const loadNotifications = async () => {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
};

export const requestReminderPermission = async (): Promise<boolean> => {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted === true;
};

const cancelReceiptReminders = async (
  Notifications: NonNullable<Awaited<ReturnType<typeof loadNotifications>>>,
  receiptId: string
): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId('return', receiptId)).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(notificationId('warranty', receiptId)).catch(() => undefined);
};

/**
 * Schedule opt-in reminders only for stored warranty/return dates.
 * Never invents a deadline.
 */
export const syncReceiptReminders = async (receipt: Receipt): Promise<void> => {
  const settings = await loadReminderSettings();
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await cancelReceiptReminders(Notifications, receipt.id);
  if (!settings.enabled) return;

  if (receipt.returnWindowDays != null) {
    const expiry = new Date(`${receipt.date}T00:00:00`);
    if (!Number.isNaN(expiry.getTime())) {
      expiry.setDate(expiry.getDate() + receipt.returnWindowDays);
      const fire = reminderFireDate(expiry.toISOString().slice(0, 10), RETURN_DAYS_BEFORE);
      if (fire) {
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId('return', receipt.id),
          content: {
            title: receipt.merchant.trim() || 'Return window',
            body: 'Return window ends in 3 days.',
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fire) },
        });
      }
    }
  }

  if (receipt.warrantyUntil) {
    const fire = reminderFireDate(receipt.warrantyUntil, WARRANTY_DAYS_BEFORE);
    if (fire) {
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId('warranty', receipt.id),
        content: {
          title: receipt.merchant.trim() || 'Warranty',
          body: 'Warranty ends in 30 days.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fire) },
      });
    }
  }
};

export const cancelAllReceiptReminders = async (): Promise<void> => {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
};
