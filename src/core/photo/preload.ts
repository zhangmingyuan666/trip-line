import type { PhotoPoint } from './types';

export function preloadUpcomingPhotos(photos: PhotoPoint[], currentIndex: number, lookaheadCount: number) {
  if (typeof window === 'undefined') return;

  photos.slice(currentIndex + 1, currentIndex + 1 + lookaheadCount).forEach((photo) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = photo.imageUrl;
  });
}
