import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import exifr from 'exifr';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const photosDir = path.join(rootDir, 'photos');
const outputFile = path.join(rootDir, 'src', 'photoManifest.ts');
const generatedPreviewDir = path.join(rootDir, 'src', 'generated', 'photo-previews');
const supportedExtensions = new Set(['.heic', '.heif', '.jpg', '.jpeg', '.png', '.tif', '.tiff']);

const summary = {
  total: 0,
  imported: 0,
  skippedNoGps: 0,
  skippedNoDate: 0,
  failed: 0,
};

async function main() {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.mkdir(generatedPreviewDir, { recursive: true });

  let files = [];
  try {
    files = await collectPhotoFiles(photosDir);
  } catch {
    await writeManifest([]);
    console.log('photos directory not found; generated an empty manifest.');
    return;
  }

  summary.total = files.length;

  const photos = [];
  for (const filePath of files) {
    try {
      const metadata = await exifr.parse(filePath, {
        gps: true,
        translateValues: true,
        reviveValues: true,
        pick: [
          'latitude',
          'longitude',
          'GPSLatitude',
          'GPSLongitude',
          'DateTimeOriginal',
          'CreateDate',
          'ModifyDate',
          'DateTimeDigitized',
        ],
      });

      const lat = metadata?.latitude ?? metadata?.GPSLatitude;
      const lng = metadata?.longitude ?? metadata?.GPSLongitude;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        summary.skippedNoGps += 1;
        continue;
      }

      const takenAt = normalizeDate(
        metadata?.DateTimeOriginal ??
          metadata?.CreateDate ??
          metadata?.DateTimeDigitized ??
          metadata?.ModifyDate,
      );

      if (!takenAt) {
        summary.skippedNoDate += 1;
        continue;
      }

      const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
      const preview = await ensureBrowserPreview(filePath, relativePath);
      photos.push({
        id: `${relativePath}-${takenAt.toISOString()}`,
        fileName: path.basename(filePath),
        relativePath,
        previewPath: preview.relativePath,
        takenAt: takenAt.toISOString(),
        lat,
        lng,
        fileType: preview.fileType,
      });
      summary.imported += 1;
    } catch {
      summary.failed += 1;
    }
  }

  photos.sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
  await writeManifest(photos);
  console.log(
    `generated ${photos.length} photo points from ${summary.total} files; no gps: ${summary.skippedNoGps}, no date: ${summary.skippedNoDate}, failed: ${summary.failed}.`,
  );
}

async function ensureBrowserPreview(filePath, relativePath) {
  if (!isHeic(filePath)) {
    return {
      relativePath,
      fileType: inferType(filePath),
    };
  }

  const previewFileName = `${safeBaseName(relativePath)}.jpg`;
  const previewPath = path.join(generatedPreviewDir, previewFileName);
  const shouldConvert = await isPreviewStale(filePath, previewPath);

  if (shouldConvert) {
    await execFileAsync('sips', ['-s', 'format', 'jpeg', filePath, '--out', previewPath]);
  }

  return {
    relativePath: path.relative(rootDir, previewPath).split(path.sep).join('/'),
    fileType: 'image/jpeg',
  };
}

async function isPreviewStale(sourcePath, previewPath) {
  try {
    const [sourceStat, previewStat] = await Promise.all([fs.stat(sourcePath), fs.stat(previewPath)]);
    return previewStat.mtimeMs < sourceStat.mtimeMs;
  } catch {
    return true;
  }
}

async function collectPhotoFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPhotoFiles(entryPath)));
    } else if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function writeManifest(photos) {
  const items = photos
    .map((photo) => {
      const assetPath = `../${photo.previewPath}`;
      return `  {
    id: ${JSON.stringify(photo.id)},
    fileName: ${JSON.stringify(photo.fileName)},
    takenAt: ${JSON.stringify(photo.takenAt)},
    lat: ${photo.lat},
    lng: ${photo.lng},
    fileType: ${JSON.stringify(photo.fileType)},
    rawUrl: new URL(${JSON.stringify(assetPath)}, import.meta.url).href,
  }`;
    })
    .join(',\n');

  const source = `export type PhotoManifestItem = {
  id: string;
  fileName: string;
  takenAt: string;
  lat: number;
  lng: number;
  fileType: string;
  rawUrl: string;
};

export const photoManifest: PhotoManifestItem[] = [
${items}
];
`;

  await fs.writeFile(outputFile, source);
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.heic') return 'image/heic';
  if (extension === '.heif') return 'image/heif';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.tif' || extension === '.tiff') return 'image/tiff';
  return 'image/*';
}

function isHeic(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.heic' || extension === '.heif';
}

function safeBaseName(relativePath) {
  const parsed = path.parse(relativePath);
  return path.join(parsed.dir, parsed.name).split(path.sep).join('__').replace(/[^a-zA-Z0-9._-]/g, '_');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
