import type { PhotoAnchor, PhotoPopoverPlacement, PhotoPreviewStyle } from './types';

export function getAnchoredPhotoStyle(anchor: PhotoAnchor | null): PhotoPreviewStyle | undefined {
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
