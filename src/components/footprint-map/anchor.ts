import { Map as MapLibreMap } from 'maplibre-gl';
import { interpolateNumber } from '../../core/map/geometry';

export type ScreenAnchor = {
  x: number;
  y: number;
};

export type AnchorPlacement = 'left' | 'right';

export function stabilizeProjectedAnchor(
  point: ScreenAnchor,
  map: MapLibreMap,
  previousAnchor: ScreenAnchor | null,
): ScreenAnchor {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return point;

  const padding = Math.min(32, Math.max(18, Math.min(width, height) * 0.04));
  const targetAnchor = isPointInsideViewport(point, width, height, padding)
    ? point
    : projectPointToViewportEdge(point, width, height, padding);

  if (!previousAnchor) return targetAnchor;

  const distance = Math.hypot(targetAnchor.x - previousAnchor.x, targetAnchor.y - previousAnchor.y);
  if (distance < 1.4) return previousAnchor;

  const isTargetVisible = isPointInsideViewport(point, width, height, padding * 1.35);
  if (isTargetVisible) return targetAnchor;

  return {
    x: interpolateNumber(previousAnchor.x, targetAnchor.x, 0.18),
    y: interpolateNumber(previousAnchor.y, targetAnchor.y, 0.18),
  };
}

function isPointInsideViewport(point: ScreenAnchor, width: number, height: number, padding: number): boolean {
  return point.x >= padding && point.x <= width - padding && point.y >= padding && point.y <= height - padding;
}

function projectPointToViewportEdge(point: ScreenAnchor, width: number, height: number, padding: number): ScreenAnchor {
  const minX = padding;
  const maxX = Math.max(minX, width - padding);
  const minY = padding;
  const maxY = Math.max(minY, height - padding);
  const centerX = width / 2;
  const centerY = height / 2;
  const deltaX = point.x - centerX;
  const deltaY = point.y - centerY;
  let scale = Number.POSITIVE_INFINITY;

  if (deltaX > 0) scale = Math.min(scale, (maxX - centerX) / deltaX);
  if (deltaX < 0) scale = Math.min(scale, (minX - centerX) / deltaX);
  if (deltaY > 0) scale = Math.min(scale, (maxY - centerY) / deltaY);
  if (deltaY < 0) scale = Math.min(scale, (minY - centerY) / deltaY);

  if (!Number.isFinite(scale) || scale < 0) {
    return {
      x: Math.min(maxX, Math.max(minX, point.x)),
      y: Math.min(maxY, Math.max(minY, point.y)),
    };
  }

  return {
    x: Math.min(maxX, Math.max(minX, centerX + deltaX * scale)),
    y: Math.min(maxY, Math.max(minY, centerY + deltaY * scale)),
  };
}

export function getIncomingRoutePopoverPlacement(
  map: MapLibreMap,
  coordinates: Array<[number, number]>,
  targetIndex: number,
): AnchorPlacement | undefined {
  const targetCoordinate = coordinates[targetIndex];
  const routeCoordinate = coordinates[targetIndex - 1] ?? coordinates[targetIndex + 1];
  if (!targetCoordinate || !routeCoordinate) return undefined;

  const targetPoint = map.project(targetCoordinate);
  const routePoint = map.project(routeCoordinate);
  const horizontalDelta = targetPoint.x - routePoint.x;
  if (Math.abs(horizontalDelta) < 8) return undefined;

  return horizontalDelta > 0 ? 'right' : 'left';
}
