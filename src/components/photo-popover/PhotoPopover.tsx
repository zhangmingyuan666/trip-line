import { formatDateTime } from '../../core/photo/format';
import type { PhotoPoint } from '../../core/photo/types';
import type { PhotoPopoverPlacement, PhotoPreviewStyle } from './types';

type PhotoPopoverProps = {
  photo: PhotoPoint;
  placement: PhotoPopoverPlacement;
  state: 'entering' | 'leaving';
  style: PhotoPreviewStyle;
  onAnimationEnd?: () => void;
};

export function PhotoPopover({ photo, placement, state, style, onAnimationEnd }: PhotoPopoverProps) {
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
