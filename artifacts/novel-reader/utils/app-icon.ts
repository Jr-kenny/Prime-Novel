export type AppIconId = 'classic' | 'black' | 'white' | 'orange' | 'cream' | 'midnight';

export type AppIconOption = {
  id: AppIconId;
  label: string;
  description: string;
  previewBackground: string;
  previewMark: string;
};

export const DEFAULT_APP_ICON: AppIconId = 'classic';

export const APP_ICON_OPTIONS: AppIconOption[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'White field with the original mark',
    previewBackground: '#ffffff',
    previewMark: '#111111',
  },
  {
    id: 'black',
    label: 'Black',
    description: 'Near-black field with a light mark',
    previewBackground: '#111111',
    previewMark: '#ffffff',
  },
  {
    id: 'white',
    label: 'White',
    description: 'Light plate on a dark field',
    previewBackground: '#171614',
    previewMark: '#111111',
  },
  {
    id: 'orange',
    label: 'Orange',
    description: 'Warm orange field with a light mark',
    previewBackground: '#e85d04',
    previewMark: '#ffffff',
  },
  {
    id: 'cream',
    label: 'Cream',
    description: 'Soft cream field with the brand mark',
    previewBackground: '#f7f3ed',
    previewMark: '#b65f47',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep charcoal field with a warm mark',
    previewBackground: '#171614',
    previewMark: '#e8dccb',
  },
];

export function isAppIconId(value: unknown): value is AppIconId {
  return typeof value === 'string' && APP_ICON_OPTIONS.some((option) => option.id === value);
}

export function normalizeAppIconId(value: unknown): AppIconId {
  return isAppIconId(value) ? value : DEFAULT_APP_ICON;
}

export function getAppIconOption(id: AppIconId): AppIconOption {
  return APP_ICON_OPTIONS.find((option) => option.id === id) ?? APP_ICON_OPTIONS[0];
}
