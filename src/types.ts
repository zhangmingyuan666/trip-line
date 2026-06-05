export type PhotoPoint = {
  id: string;
  fileName: string;
  takenAt: Date;
  lat: number;
  lng: number;
  imageUrl: string;
  rawUrl: string;
  fileType: string;
};

export type ImportSummary = {
  total: number;
  imported: number;
  skippedNoGps: number;
  skippedNoDate: number;
  failed: number;
};

export type PlaybackSpeed = 'slow' | 'normal' | 'fast';

export type MapTheme = 'clean' | 'travel' | 'dark' | 'standard';
