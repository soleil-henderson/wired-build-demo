import type { ModCategory } from '@/types/database';

export const MOD_CATEGORY_OPTIONS: { value: ModCategory; label: string }[] = [
  { value: 'suspension', label: 'Suspension' },
  { value: 'wheels_tyres', label: 'Wheels & tyres' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'body', label: 'Body' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'drivetrain', label: 'Drivetrain' },
  { value: 'camping', label: 'Camping' },
  { value: 'interior', label: 'Interior' },
  { value: 'other', label: 'Other' },
];

export const MOD_CATEGORY_LABELS: Record<ModCategory, string> = Object.fromEntries(
  MOD_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<ModCategory, string>;

export function formatModCategory(category: ModCategory): string {
  return MOD_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}

export function modCategoryFromParam(
  value: string | string[] | undefined
): ModCategory | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  return MOD_CATEGORY_OPTIONS.some((o) => o.value === raw) ? (raw as ModCategory) : null;
}
