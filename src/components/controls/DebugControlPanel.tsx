import { useState, type ReactNode } from 'react';
import { CalendarDays, Gauge, Layers, MapPin, Pause, Play, RotateCcw } from 'lucide-react';
import { mapThemeLabels, mapThemes } from '../../enums/mapTheme';
import { playbackSpeedLabels, playbackSpeeds } from '../../enums/playbackSpeed';
import { formatDate, formatDateTime } from '../../core/photo/format';
import type { MapTheme, PhotoPoint, PlaybackSpeed } from '../../core/photo/types';

type DebugControlPanelProps = {
  photos: PhotoPoint[];
  currentIndex: number;
  dateRange: string;
  hasRoute: boolean;
  isPlaying: boolean;
  mapTheme: MapTheme;
  speed: PlaybackSpeed;
  onResetPlayback: () => void;
  onTogglePlayback: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onSetMapTheme: (theme: MapTheme) => void;
};

export function DebugControlPanel({
  photos,
  currentIndex,
  dateRange,
  hasRoute,
  isPlaying,
  mapTheme,
  speed,
  onResetPlayback,
  onTogglePlayback,
  onSetSpeed,
  onSetMapTheme,
}: DebugControlPanelProps) {
  const [debugPreviewIndex, setDebugPreviewIndex] = useState<number | null>(null);
  const debugPreviewPhoto = debugPreviewIndex === null ? null : photos[debugPreviewIndex];

  return (
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
        <button className="primary-button" type="button" onClick={onTogglePlayback} disabled={!hasRoute}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          <span>{isPlaying ? '暂停' : '播放'}</span>
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onResetPlayback}
          disabled={!photos.length}
          aria-label="重播"
          title="重播"
        >
          <RotateCcw size={19} />
        </button>
      </div>

      <div className="speed-row" aria-label="播放速度">
        <Gauge size={17} />
        {playbackSpeeds.map((value) => (
          <button
            className={speed === value ? 'speed-option is-active' : 'speed-option'}
            key={value}
            type="button"
            onClick={() => onSetSpeed(value)}
          >
            {playbackSpeedLabels[value]}
          </button>
        ))}
      </div>

      <div className="theme-row" aria-label="地图样式">
        <Layers size={17} />
        {mapThemes.map((value) => (
          <button
            className={mapTheme === value ? 'theme-option is-active' : 'theme-option'}
            key={value}
            type="button"
            onClick={() => onSetMapTheme(value)}
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
      <p className="progress-text">{photos.length ? `${currentIndex + 1} / ${photos.length}` : '0 / 0'}</p>

      {!!photos.length && (
        <section className="debug-photo-order" aria-label="图片渲染顺序">
          <div className="debug-photo-order-header">
            <span>渲染顺序</span>
            <span>{photos.length} 张</span>
          </div>
          <ol className="debug-photo-list">
            {photos.map((photo, index) => (
              <li className="debug-photo-item" key={photo.id}>
                <button
                  className={index === currentIndex ? 'debug-photo-button is-active' : 'debug-photo-button'}
                  type="button"
                  title={`${index + 1}. ${photo.fileName}`}
                  aria-label={`第 ${index + 1} 张，${photo.fileName}`}
                  onBlur={() => setDebugPreviewIndex(null)}
                  onFocus={() => setDebugPreviewIndex(index)}
                  onMouseEnter={() => setDebugPreviewIndex(index)}
                  onMouseLeave={() => setDebugPreviewIndex(null)}
                >
                  <span className="debug-photo-index">{index + 1}</span>
                  <span className="debug-photo-name">{photo.fileName}</span>
                  <span className="debug-photo-date">{formatDate(photo.takenAt)}</span>
                </button>
              </li>
            ))}
          </ol>
          {debugPreviewPhoto && (
            <aside className="debug-photo-preview" aria-hidden="true">
              <img src={debugPreviewPhoto.imageUrl} alt="" />
              <strong>{debugPreviewPhoto.fileName}</strong>
              <small>{formatDateTime(debugPreviewPhoto.takenAt)}</small>
            </aside>
          )}
        </section>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
