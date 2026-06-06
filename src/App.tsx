import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Gauge, ImageOff, Layers, MapPin, Pause, Play, RotateCcw } from 'lucide-react';
import FootprintMap from './FootprintMap';
import { mapThemeLabels } from './mapStyles';
import { photoManifest } from './photoManifest';
import type { MapTheme, PhotoPoint, PlaybackSpeed } from './types';

const speedLabels: Record<PlaybackSpeed, string> = {
  slow: '慢',
  normal: '正常',
  fast: '快',
};

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

      <section className="control-panel" aria-label="照片足迹控制">
        <div className="brand-row">
          <div>
            <p className="eyebrow">照片足迹</p>
            <h1>Footprint</h1>
          </div>
          <div className="point-count">{photos.length}</div>
        </div>

        <div className="metrics-grid">
          <Metric icon={<MapPin size={16} />} label="足迹点" value={`${photos.length} 张`} />
          <Metric icon={<CalendarDays size={16} />} label="时间" value={dateRange} />
        </div>

        {!photos.length && (
          <p className="status-line">没有可展示的照片。请把带 GPS 和拍摄时间的原图放到 photos 目录后重新启动。</p>
        )}

        <div className="playback-row">
          <button className="primary-button" type="button" onClick={togglePlayback} disabled={!hasRoute}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            <span>{isPlaying ? '暂停' : '播放'}</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={resetPlayback}
            disabled={!photos.length}
            aria-label="重播"
            title="重播"
          >
            <RotateCcw size={19} />
          </button>
        </div>

        <div className="speed-row" aria-label="播放速度">
          <Gauge size={17} />
          {(['slow', 'normal', 'fast'] as PlaybackSpeed[]).map((value) => (
            <button
              className={speed === value ? 'speed-option is-active' : 'speed-option'}
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
            >
              {speedLabels[value]}
            </button>
          ))}
        </div>

        <div className="theme-row" aria-label="地图样式">
          <Layers size={17} />
          {(['clean', 'travel', 'dark', 'standard'] as MapTheme[]).map((value) => (
            <button
              className={mapTheme === value ? 'theme-option is-active' : 'theme-option'}
              key={value}
              type="button"
              onClick={() => changeMapTheme(value)}
            >
              {mapThemeLabels[value]}
            </button>
          ))}
        </div>

        <div className="progress-bar" aria-label="播放进度">
          <div
            style={{
              width: photos.length ? `${((currentIndex + 1) / photos.length) * 100}%` : '0%',
            }}
          />
        </div>
        <p className="progress-text">
          {photos.length ? `${currentIndex + 1} / ${photos.length}` : '0 / 0'}
        </p>
      </section>

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

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isCompact = viewportWidth <= 760;
  const margin = isCompact ? 12 : 24;
  const gap = isCompact ? 11 : 14;
  const width = isCompact ? Math.min(148, Math.max(124, viewportWidth - 64)) : Math.min(184, viewportWidth - 48);
  const height = width * (16 / 9) + (isCompact ? 54 : 58);
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const maxTop = Math.max(margin, viewportHeight - height - margin);
  const placement: PhotoPopoverPlacement = anchor.x + gap + width > viewportWidth - margin ? 'left' : 'right';
  let left = anchor.x + gap;

  if (placement === 'left') {
    left = anchor.x - width - gap;
  }

  const top = clamp(anchor.y - height / 2, margin, maxTop);

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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-label">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
