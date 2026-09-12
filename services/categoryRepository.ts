import { Category } from '@/models/types';

export const builtinCategories: Category[] = [
  { id: '1', name: 'Food & Dining', icon: 'UtensilsCrossed', color: '#F59E0B', builtin: true },
  { id: '2', name: 'Transportation', icon: 'Car', color: '#3B82F6', builtin: true },
  { id: '3', name: 'Office Supplies', icon: 'Paperclip', color: '#8B5CF6', builtin: true },
  { id: '4', name: 'Software & Tools', icon: 'Monitor', color: '#0D9488', builtin: true },
  { id: '5', name: 'Travel', icon: 'Plane', color: '#EC4899', builtin: true },
  { id: '6', name: 'Utilities', icon: 'Zap', color: '#10B981', builtin: true },
  { id: '7', name: 'Marketing', icon: 'Megaphone', color: '#EF4444', builtin: true },
  { id: '8', name: 'Professional Services', icon: 'Briefcase', color: '#6366F1', builtin: true },
  { id: '9', name: 'Equipment', icon: 'Wrench', color: '#78716C', builtin: true },
  { id: '10', name: 'Other', icon: 'MoreHorizontal', color: '#71717A', builtin: true },
];

const CUSTOM_ICONS = ['Tag', 'Bookmark', 'Folder', 'Hash'] as const;
const CUSTOM_COLORS = ['#0D9488', '#3B82F6', '#F59E0B', '#6366F1', '#EC4899'];

export const buildCustomCategory = (name: string): Category => {
  const trimmed = name.trim();
  const hash = trimmed.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return {
    id: `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    icon: CUSTOM_ICONS[hash % CUSTOM_ICONS.length],
    color: CUSTOM_COLORS[hash % CUSTOM_COLORS.length],
    builtin: false,
  };
};
