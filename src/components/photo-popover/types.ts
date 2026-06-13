import type { CSSProperties } from 'react';
import type { PhotoPoint } from '../../core/photo/types';

export type PhotoAnchor = {
  x: number;
  y: number;
};

export type PhotoPopoverPlacement = 'left' | 'right';

export type PhotoPreviewStyle = CSSProperties & { '--popover-placement': PhotoPopoverPlacement };

export type PhotoPopoverSnapshot = {
  instanceId: string;
  photo: PhotoPoint;
  placement: PhotoPopoverPlacement;
  style: PhotoPreviewStyle;
};
