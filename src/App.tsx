import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
type PhotoPreviewStyle = CSSProperties & { '--popover-placement': PhotoPopoverPlacement };
type PhotoPopoverSnapshot = {
  instanceId: string;
  photo: PhotoPoint;
  placement: PhotoPopoverPlacement;
  style: PhotoPreviewStyle;
};

type PhotoPopoverProps = {
  photo: PhotoPoint;
  placement: PhotoPopoverPlacement;
  state: 'entering' | 'leaving';
  style: PhotoPreviewStyle;
  onAnimationEnd?: () => void;
};

export default function App() {
  const photos = initialPhotos;
  const showDebugUi = import.meta.env.DEV;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialPhotos.length > 1);
  const [speed, setSpeed] = useState<PlaybackSpeed>('normal');
  const [mapTheme, setMapTheme] = useState<MapTheme>('clean');
  const [photoAnchor, setPhotoAnchor] = useState<PhotoAnchor | null>(null);
  const [leavingPhotoPopovers, setLeavingPhotoPopovers] = useState<PhotoPopoverSnapshot[]>([]);
  const lastActivePopoverRef = useRef<PhotoPopoverSnapshot | null>(null);
  const popoverInstanceIdRef = useRef(0);

  const currentPhoto = photos[previewIndex];
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
    setPreviewIndex(0);
  }

  function togglePlayback() {
    if (!hasRoute) return;
    if (currentIndex >= photos.length - 1) {
      setCurrentIndex(0);
      setPreviewIndex(0);
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

  const queueLeavingPhotoPopover = useCallback((popover: PhotoPopoverSnapshot) => {
    setLeavingPhotoPopovers((previousPopovers) => {
      const nextPopovers = previousPopovers.filter(
        (previousPopover) => previousPopover.photo.id !== popover.photo.id,
      );

      return [...nextPopovers, popover].slice(-3);
    });
  }, []);

  const removeLeavingPhotoPopover = useCallback((instanceId: string) => {
    setLeavingPhotoPopovers((previousPopovers) =>
      previousPopovers.filter((popover) => popover.instanceId !== instanceId),
    );
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setPreviewIndex(currentIndex);
    }
  }, [currentIndex, isPlaying]);

  useEffect(() => {
    preloadUpcomingPhotos(photos, previewIndex, 3);
  }, [previewIndex, photos]);

  useEffect(() => {
    if (!currentPhoto || !photoPreviewStyle || !shouldShowPhotoPopover) {
      if (lastActivePopoverRef.current) {
        queueLeavingPhotoPopover(lastActivePopoverRef.current);
        lastActivePopoverRef.current = null;
      }

      return;
    }

    const previousPopover = lastActivePopoverRef.current;
    if (previousPopover && previousPopover.photo.id !== currentPhoto.id) {
      queueLeavingPhotoPopover(previousPopover);
    }

    const instanceId =
      previousPopover?.photo.id === currentPhoto.id
        ? previousPopover.instanceId
        : `${currentPhoto.id}-${popoverInstanceIdRef.current}`;

    if (previousPopover?.photo.id !== currentPhoto.id) {
      popoverInstanceIdRef.current += 1;
    }

    lastActivePopoverRef.current = {
      instanceId,
      photo: currentPhoto,
      placement: popoverPlacement,
      style: { ...photoPreviewStyle },
    };

    if (leavingPhotoPopovers.some((popover) => popover.photo.id === currentPhoto.id)) {
      setLeavingPhotoPopovers((previousPopovers) =>
        previousPopovers.filter((popover) => popover.photo.id !== currentPhoto.id),
      );
    }
  }, [
    currentPhoto,
    leavingPhotoPopovers,
    photoPreviewStyle,
    popoverPlacement,
    queueLeavingPhotoPopover,
    shouldShowPhotoPopover,
  ]);

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
        onPreviewIndexChange={setPreviewIndex}
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

      {leavingPhotoPopovers.map((popover) => (
        <PhotoPopover
          key={popover.instanceId}
          photo={popover.photo}
          placement={popover.placement}
          state="leaving"
          style={popover.style}
          onAnimationEnd={() => removeLeavingPhotoPopover(popover.instanceId)}
        />
      ))}

      {shouldShowPhotoPopover && currentPhoto && photoPreviewStyle && (
        <PhotoPopover
          key={`active-${currentPhoto.id}`}
          photo={currentPhoto}
          placement={popoverPlacement}
          state="entering"
          style={photoPreviewStyle}
        />
      )}

      {!currentPhoto && (
        <aside className="photo-popover is-entering" aria-label="当前照片">
          <div className="empty-preview">
            <ImageOff size={26} />
            <span>暂无照片</span>
          </div>
        </aside>
      )}
    </main>
  );
}

function PhotoPopover({ photo, placement, state, style, onAnimationEnd }: PhotoPopoverProps) {
  return (
    <aside
      className={`photo-popover is-${placement} is-${state}`}
      style={style}
      aria-label="当前照片"
      onAnimationEnd={onAnimationEnd}
    >
      <div className="photo-frame">
        <img src={photo.imageUrl} alt={photo.fileName} />
      </div>
      <div className="photo-meta">
        <strong>{photo.fileName}</strong>
        <span>{formatDateTime(photo.takenAt)}</span>
        <dl className="photo-details" aria-label="照片信息">
          <div>
            <dt>格式</dt>
            <dd>{formatFileType(photo.fileType)}</dd>
          </div>
          <div>
            <dt>坐标</dt>
            <dd>{formatCoordinatePair(photo)}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

function getAnchoredPhotoStyle(anchor: PhotoAnchor | null): PhotoPreviewStyle | undefined {
  if (!anchor || typeof window === 'undefined') return undefined;
  if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return undefined;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isCompact = viewportWidth <= 760;
  const margin = isCompact ? 12 : 24;
  const gap = isCompact ? 11 : 14;
  const width = isCompact ? Math.min(148, Math.max(124, viewportWidth - 64)) : Math.min(184, viewportWidth - 48);
  const height = width * (16 / 9) + (isCompact ? 92 : 88);
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

function formatFileType(fileType: string): string {
  const [, subtype] = fileType.split('/');

  if (!subtype) return fileType.toUpperCase();
  if (subtype === 'jpeg') return 'JPEG';

  return subtype.toUpperCase();
}

function formatCoordinatePair(photo: PhotoPoint): string {
  return `${formatCoordinate(photo.lat, 'N', 'S')} ${formatCoordinate(photo.lng, 'E', 'W')}`;
}

function formatCoordinate(value: number, positiveDirection: string, negativeDirection: string): string {
  const direction = value >= 0 ? positiveDirection : negativeDirection;

  return `${direction} ${Math.abs(value).toFixed(4)}`;
}

function preloadUpcomingPhotos(photos: PhotoPoint[], currentIndex: number, lookaheadCount: number) {
  if (typeof window === 'undefined') return;

  photos.slice(currentIndex + 1, currentIndex + 1 + lookaheadCount).forEach((photo) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = photo.imageUrl;
  });
}
