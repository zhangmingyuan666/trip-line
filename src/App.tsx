import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import FootprintMap from './FootprintMap';
import { CompactPlayToggle } from './components/CompactPlayToggle';
import { DebugControlPanel } from './components/DebugControlPanel';
import { photoManifest } from './generated/photoManifest';
import { formatDateTime, formatDate } from './photoFormat';
import type { MapTheme, PhotoPoint, PlaybackSpeed } from './types';

const initialPhotos: PhotoPoint[] = photoManifest.map((photo) => ({
  id: photo.id,
  fileName: photo.fileName,
  takenAt: new Date(photo.takenAt),
  lat: photo.lat,
  lng: photo.lng,
  imageUrl: photo.rawUrl,
  rawUrl: photo.rawUrl,
  fileType: photo.fileType,
}));

type PhotoAnchor = {
  x: number;
  y: number;
};

type PhotoPopoverPlacement = 'left' | 'right';

export default function App() {
  const photos = initialPhotos;
  const showDebugUi = import.meta.env.DEV;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialPhotos.length > 1);
  const [speed, setSpeed] = useState<PlaybackSpeed>('normal');
  const [mapTheme, setMapTheme] = useState<MapTheme>('clean');
  const [photoAnchor, setPhotoAnchor] = useState<PhotoAnchor | null>(null);

  const currentPhoto = photos[currentIndex];
  const hasRoute = photos.length > 1;

  const dateRange = useMemo(() => {
    if (!photos.length) return '暂无照片';
    const first = formatDate(photos[0].takenAt);
    const last = formatDate(photos[photos.length - 1].takenAt);
    return first === last ? first : `${first} - ${last}`;
  }, [photos]);

  function resetPlayback() {
    setIsPlaying(false);
    setCurrentIndex(0);
  }

  function togglePlayback() {
    if (!hasRoute) return;
    if (currentIndex >= photos.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying((value) => !value);
  }

  function changeMapTheme(nextTheme: MapTheme) {
    setIsPlaying(false);
    setMapTheme(nextTheme);
  }

  const handlePlaybackDone = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handlePhotoAnchorChange = useCallback((anchor: PhotoAnchor | null) => {
    setPhotoAnchor((previousAnchor) => {
      if (!anchor) return previousAnchor === null ? previousAnchor : null;

      const nextAnchor = {
        x: Math.round(anchor.x),
        y: Math.round(anchor.y),
      };

      if (previousAnchor?.x === nextAnchor.x && previousAnchor.y === nextAnchor.y) {
        return previousAnchor;
      }

      return nextAnchor;
    });
  }, []);

  const photoPreviewStyle = useMemo(() => getAnchoredPhotoStyle(photoAnchor), [photoAnchor]);
  const popoverPlacement = photoPreviewStyle?.['--popover-placement'] ?? 'right';
  const shouldShowPhotoPopover = Boolean(currentPhoto && photoAnchor && photoPreviewStyle);

  useEffect(() => {
    preloadUpcomingPhotos(photos, currentIndex, 3);
  }, [currentIndex, photos]);

  return (
    <main className="app-shell">
      <FootprintMap
        photos={photos}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        speed={speed}
        mapTheme={mapTheme}
        onAnchorChange={handlePhotoAnchorChange}
        onIndexChange={setCurrentIndex}
        onDone={handlePlaybackDone}
      />

      {showDebugUi ? (
        <DebugControlPanel
          photos={photos}
          currentIndex={currentIndex}
          dateRange={dateRange}
          hasRoute={hasRoute}
          isPlaying={isPlaying}
          mapTheme={mapTheme}
          speed={speed}
          onResetPlayback={resetPlayback}
          onTogglePlayback={togglePlayback}
          onSetSpeed={setSpeed}
          onSetMapTheme={changeMapTheme}
        />
      ) : (
        <CompactPlayToggle isPlaying={isPlaying} disabled={!hasRoute} onToggle={togglePlayback} />
      )}

      {shouldShowPhotoPopover && (
        <aside
          className={`photo-popover is-${popoverPlacement}`}
          key={currentPhoto.id}
          style={photoPreviewStyle}
          aria-label="当前照片"
        >
          <div className="photo-frame">
            <img src={currentPhoto.imageUrl} alt={currentPhoto.fileName} />
          </div>
          <div className="photo-meta">
            <strong>{currentPhoto.fileName}</strong>
            <span>{formatDateTime(currentPhoto.takenAt)}</span>
          </div>
        </aside>
      )}

      {!currentPhoto && (
        <aside className="photo-popover" aria-label="当前照片">
          <div className="empty-preview">
            <ImageOff size={26} />
            <span>暂无照片</span>
          </div>
        </aside>
      )}
    </main>
  );
}

function getAnchoredPhotoStyle(anchor: PhotoAnchor | null): (CSSProperties & { '--popover-placement': PhotoPopoverPlacement }) | undefined {
  if (!anchor || typeof window === 'undefined') return undefined;
  if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return undefined;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isCompact = viewportWidth <= 760;
  const margin = isCompact ? 12 : 24;
  const gap = isCompact ? 11 : 14;
  const width = isCompact ? Math.min(148, Math.max(124, viewportWidth - 64)) : Math.min(184, viewportWidth - 48);
  const height = width * (16 / 9) + (isCompact ? 54 : 58);
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const maxTop = Math.max(margin, viewportHeight - height - margin);
  const boundedAnchor = {
    x: clamp(anchor.x, margin, viewportWidth - margin),
    y: clamp(anchor.y, margin, viewportHeight - margin),
  };
  const placement: PhotoPopoverPlacement =
    boundedAnchor.x + gap + width > viewportWidth - margin ? 'left' : 'right';
  let left = boundedAnchor.x + gap;

  if (placement === 'left') {
    left = boundedAnchor.x - width - gap;
  }

  const top = clamp(boundedAnchor.y - height / 2, margin, maxTop);

  return {
    bottom: 'auto',
    left: `${clamp(left, margin, maxLeft)}px`,
    top: `${top}px`,
    width: `${width}px`,
    '--popover-placement': placement,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function preloadUpcomingPhotos(photos: PhotoPoint[], currentIndex: number, lookaheadCount: number) {
  if (typeof window === 'undefined') return;

  photos.slice(currentIndex + 1, currentIndex + 1 + lookaheadCount).forEach((photo) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = photo.imageUrl;
  });
}
