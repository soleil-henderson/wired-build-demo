import { Platform, Share } from 'react-native';

import type { ModWithPart } from './mods';
import type { Database } from '@/types/database';

type Vehicle = Pick<
  Database['public']['Tables']['vehicles']['Row'],
  'vin' | 'year' | 'make' | 'model' | 'trim' | 'nickname' | 'total_spend' | 'build_value'
>;

export function buildCsvExport(vehicle: Vehicle, mods: ModWithPart[]): string {
  const header = [
    'install_date',
    'category',
    'part',
    'cost',
    'approximate_cost',
    'installer',
    'notes',
  ].join(',');

  const rows = mods.map((m) => {
    const partLabel = m.part
      ? `${m.part.brand} ${m.part.name}`
      : m.custom_part_name ?? '';
    return [
      m.install_date,
      m.category,
      csvEscape(partLabel),
      m.cost ?? '',
      m.cost_is_approximate ? 'yes' : 'no',
      m.installer_type,
      csvEscape(m.notes ?? ''),
    ].join(',');
  });

  const meta = [
    `# ${vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}`,
    `# VIN ${vehicle.vin}`,
    `# Total spend ${vehicle.total_spend}`,
    `# Est. value ${vehicle.build_value ?? 'n/a'}`,
  ];

  return [...meta, header, ...rows].join('\n');
}

/** Share on native; trigger a file download on web (Share API does not export CSV there). */
export async function shareCsvExport(csv: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    downloadCsvOnWeb(csv, filename);
    return;
  }

  await Share.share({
    message: csv,
    title: filename.replace(/\.csv$/i, ''),
  });
}

function downloadCsvOnWeb(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function csvExportFilename(vehicle: Vehicle): string {
  const base = (vehicle.nickname ?? `${vehicle.year}-${vehicle.make}-${vehicle.model}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'build'}-mods.csv`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
