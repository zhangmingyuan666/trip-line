export const mapThemes = ['clean', 'travel', 'dark', 'standard'] as const;

export type MapTheme = (typeof mapThemes)[number];

export const mapThemeLabels: Record<MapTheme, string> = {
  clean: '清爽',
  travel: '旅行',
  dark: '深色',
  standard: '标准',
};

export function isDarkMapTheme(theme: MapTheme): boolean {
  return theme === 'dark';
}
