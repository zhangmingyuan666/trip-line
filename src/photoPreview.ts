import heic2any from 'heic2any';

export async function createPreviewUrl(rawUrl: string, fileType: string): Promise<string> {
  if (!isHeic(rawUrl, fileType)) {
    return rawUrl;
  }

  const response = await fetch(rawUrl);
  if (!response.ok) {
    throw new Error(`Failed to load HEIC image: ${response.status}`);
  }

  const blob = await response.blob();
  const converted = await heic2any({
    blob,
    toType: 'image/jpeg',
    quality: 0.86,
  });
  const previewBlob = Array.isArray(converted) ? converted[0] : converted;
  return URL.createObjectURL(previewBlob);
}

export function isHeic(rawUrl: string, fileType: string): boolean {
  const lowerUrl = rawUrl.toLowerCase();
  return (
    fileType === 'image/heic' ||
    fileType === 'image/heif' ||
    lowerUrl.includes('.heic') ||
    lowerUrl.includes('.heif')
  );
}
