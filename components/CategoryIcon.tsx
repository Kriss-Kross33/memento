import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  UtensilsCrossed,
  Car,
  Paperclip,
  Monitor,
  Plane,
  Zap,
  Megaphone,
  Briefcase,
  Wrench,
  MoreHorizontal,
  Tag,
  Bookmark,
  Folder,
  Hash,
} from 'lucide-react-native';

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: number;
}

const iconMap: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  UtensilsCrossed,
  Car,
  Paperclip,
  Monitor,
  Plane,
  Zap,
  Megaphone,
  Briefcase,
  Wrench,
  MoreHorizontal,
  Tag,
  Bookmark,
  Folder,
  Hash,
};

export default function CategoryIcon({ icon, color, size = 20 }: CategoryIconProps) {
  const IconComponent = iconMap[icon] || MoreHorizontal;
  
  return (
    <View style={[styles.container, { backgroundColor: color + '15' }]}>
      <IconComponent size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
