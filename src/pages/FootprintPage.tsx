import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { CompactPlayToggle } from '../components/controls/CompactPlayToggle';
import { DebugControlPanel } from '../components/controls/DebugControlPanel';
import FootprintMap from '../components/footprint-map/FootprintMap';
import { PhotoPopover } from '../components/photo-popover/PhotoPopover';
import { getAnchoredPhotoStyle } from '../components/photo-popover/layout';
import type { PhotoAnchor, PhotoPopoverSnapshot } from '../components/photo-popover/types';
import { formatDate } from '../core/photo/format';
import { preloadUpcomingPhotos } from '../core/photo/preload';
import type { MapTheme, PhotoPoint, PlaybackSpeed } from '../core/photo/types';
import { photoManifest } from '../generated/photoManifest';

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

export default function FootprintPage() {
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
        preferredPlacement: anchor.preferredPlacement,
      };

      if (
        previousAnchor?.x === nextAnchor.x &&
        previousAnchor.y === nextAnchor.y &&
        previousAnchor.preferredPlacement === nextAnchor.preferredPlacement
      ) {
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
