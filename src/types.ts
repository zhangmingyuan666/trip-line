export type PhotoPoint = {
  id: string;
  fileName: string;
  takenAt: Date;
  lat: number;
  lng: number;
  imageUrl: string;
  rawUrl: string;
  fileType: string;
  sourceFileType: string;
  metadata: PhotoMetadata;
};

export type PhotoMetadataValue =
  | string
  | number
  | boolean
  | null
  | PhotoMetadataValue[]
  | { [key: string]: PhotoMetadataValue };

export type PhotoMetadata = {
  file: {
    name: string;
    relativePath: string;
    previewPath: string;
    extension: string;
    sourceFileType: string;
    previewFileType: string;
    sizeBytes: number;
    modifiedAt: string;
  };
  derived: {
    takenAt: string;
    takenAtSource: string;
    latitude: number;
    longitude: number;
    locationSource: string;
    location: PhotoResolvedLocation | null;
    locationProviders: { [provider: string]: PhotoResolvedLocation };
  };
  exif: { [key: string]: PhotoMetadataValue };
};

export type PhotoResolvedLocation = {
  provider: string;
  providerPlaceId: string | null;
  name: string | null;
  poi: string | null;
  address: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  queriedAt: string;
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
