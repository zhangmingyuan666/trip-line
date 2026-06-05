import { useMemo, useState } from 'react';
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

export default function App() {
  const photos = initialPhotos;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialPhotos.length > 1);
  const [speed, setSpeed] = useState<PlaybackSpeed>('normal');
  const [mapTheme, setMapTheme] = useState<MapTheme>('clean');

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

  return (
    <main className="app-shell">
      <FootprintMap
        photos={photos}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        speed={speed}
        mapTheme={mapTheme}
        onIndexChange={setCurrentIndex}
        onDone={() => setIsPlaying(false)}
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

      <aside className="photo-preview" aria-label="当前照片">
        {currentPhoto ? (
          <>
            <img src={currentPhoto.imageUrl} alt={currentPhoto.fileName} />
            <div className="photo-meta">
              <strong>{currentPhoto.fileName}</strong>
              <span>{formatDateTime(currentPhoto.takenAt)}</span>
            </div>
          </>
        ) : (
          <div className="empty-preview">
            <ImageOff size={26} />
            <span>暂无照片</span>
          </div>
        )}
      </aside>
    </main>
  );
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
