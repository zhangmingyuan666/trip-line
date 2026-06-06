import fs from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';

const rootDir = process.cwd();
const photosDir = path.join(rootDir, 'photos');
const locationEnvFile = path.join(rootDir, 'config', 'location.env');
const locationCacheFile = path.join(rootDir, 'src', 'generated', 'location-cache.json');
const supportedExtensions = new Set(['.heic', '.heif', '.jpg', '.jpeg', '.png', '.tif', '.tiff']);

await loadEnvFile(locationEnvFile);

const providerName = process.env.LOCATION_PROVIDER;
const limit = Number.parseInt(process.env.LOCATION_LIMIT ?? '', 10);
const shouldRefreshCachedLocations = process.env.LOCATION_FORCE === '1';

const providers = {
  nominatim: {
    delayMs: 1100,
    requiredEnv: [],
    request: reverseGeocodeWithNominatim,
  },
  amap: {
    delayMs: 250,
    requiredEnv: ['AMAP_WEB_SERVICE_KEY'],
    request: reverseGeocodeWithAmap,
  },
  geoapify: {
    delayMs: 250,
    requiredEnv: ['GEOAPIFY_API_KEY'],
    request: reverseGeocodeWithGeoapify,
  },
};

async function main() {
  if (!providerName) {
    throw new Error(
      `LOCATION_PROVIDER is required to call a reverse geocoding API. Use one of: ${Object.keys(providers).join(', ')}.`,
    );
  }

  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unsupported LOCATION_PROVIDER "${providerName}". Use one of: ${Object.keys(providers).join(', ')}.`);
  }

  for (const envName of provider.requiredEnv) {
    if (!process.env[envName]) {
      throw new Error(`${envName} is required for LOCATION_PROVIDER=${providerName}.`);
    }
  }

  await fs.mkdir(path.dirname(locationCacheFile), { recursive: true });
  const cache = await readJson(locationCacheFile, {});
  const photoCoordinates = await collectPhotoCoordinates();
  const uniqueCoordinates = dedupeCoordinates(photoCoordinates);
  const queuedCoordinates = Number.isFinite(limit) ? uniqueCoordinates.slice(0, limit) : uniqueCoordinates;

  let queried = 0;
  let skipped = 0;
  let failed = 0;

  for (const coordinate of queuedCoordinates) {
    const coordinateKey = getCoordinateKey(coordinate.lat, coordinate.lng);
    cache[coordinateKey] ??= {};

    if (cache[coordinateKey][providerName] && !shouldRefreshCachedLocations) {
      skipped += 1;
      continue;
    }

    try {
      const location = await provider.request(coordinate.lat, coordinate.lng);
      cache[coordinateKey][providerName] = {
        ...location,
        provider: providerName,
        queriedAt: new Date().toISOString(),
      };
      queried += 1;
      await writeJson(locationCacheFile, cache);
    } catch (error) {
      failed += 1;
      console.error(`failed ${providerName} ${coordinateKey}: ${error.message}`);
    }

    await sleep(provider.delayMs);
  }

  console.log(
    `reverse geocoded ${queried} coordinates with ${providerName}; skipped cache: ${skipped}, failed: ${failed}, total unique: ${uniqueCoordinates.length}.`,
  );
}

async function reverseGeocodeWithNominatim(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('accept-language', process.env.LOCATION_LANGUAGE ?? 'zh-CN,zh,en');
  if (process.env.NOMINATIM_EMAIL) {
    url.searchParams.set('email', process.env.NOMINATIM_EMAIL);
  }

  const data = await fetchJson(url, {
    headers: {
      'User-Agent': getUserAgent(),
    },
  });

  return normalizeLocation({
    providerPlaceId: data.place_id ? String(data.place_id) : null,
    name: data.name || data.namedetails?.name || null,
    poi: data.name || null,
    address: data.display_name || null,
    country: data.address?.country || null,
    province: data.address?.state || data.address?.province || null,
    city: data.address?.city || data.address?.town || data.address?.county || null,
    district: data.address?.city_district || data.address?.suburb || data.address?.borough || null,
    street: data.address?.road || data.address?.pedestrian || null,
    raw: data,
  });
}

async function reverseGeocodeWithAmap(lat, lng) {
  const url = new URL('https://restapi.amap.com/v3/geocode/regeo');
  url.searchParams.set('key', process.env.AMAP_WEB_SERVICE_KEY);
  url.searchParams.set('location', `${lng},${lat}`);
  url.searchParams.set('coordsys', 'gps');
  url.searchParams.set('extensions', 'all');
  url.searchParams.set('radius', process.env.AMAP_RADIUS ?? '200');
  url.searchParams.set('output', 'json');

  const data = await fetchJson(url);
  if (data.status !== '1') {
    throw new Error(data.info || 'Amap request failed');
  }

  const regeocode = data.regeocode ?? {};
  const component = regeocode.addressComponent ?? {};
  const firstAoi = Array.isArray(regeocode.aois) ? regeocode.aois[0] : null;
  const firstPoi = firstAoi ?? (Array.isArray(regeocode.pois) ? regeocode.pois[0] : null);

  return normalizeLocation({
    providerPlaceId: firstPoi?.id || null,
    name: firstPoi?.name || regeocode.formatted_address || null,
    poi: firstPoi?.name || null,
    address: regeocode.formatted_address || null,
    country: component.country || '中国',
    province: component.province || null,
    city: component.city || component.province || null,
    district: component.district || null,
    street: component.streetNumber?.street || null,
    raw: data,
  });
}

async function reverseGeocodeWithGeoapify(lat, lng) {
  const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.searchParams.set('apiKey', process.env.GEOAPIFY_API_KEY);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('lang', process.env.LOCATION_LANGUAGE ?? 'zh');
  url.searchParams.set('limit', '1');

  const data = await fetchJson(url);
  const feature = data.features?.[0];
  const props = feature?.properties ?? {};

  return normalizeLocation({
    providerPlaceId: props.place_id || props.datasource?.raw?.place_id || null,
    name: props.name || props.address_line1 || null,
    poi: props.name || null,
    address: props.formatted || null,
    country: props.country || null,
    province: props.state || null,
    city: props.city || props.county || null,
    district: props.district || props.suburb || null,
    street: props.street || null,
    raw: data,
  });
}

function normalizeLocation(location) {
  return {
    providerPlaceId: normalizeText(location.providerPlaceId),
    name: normalizeText(location.name),
    poi: normalizeText(location.poi),
    address: normalizeText(location.address),
    country: normalizeText(location.country),
    province: normalizeText(location.province),
    city: normalizeText(location.city),
    district: normalizeText(location.district),
    street: normalizeText(location.street),
    raw: location.raw,
  };
}

function normalizeText(value) {
  if (typeof value === 'string') return value || null;
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string' && item) ?? null;
  if (value == null) return null;
  return String(value);
}

async function collectPhotoCoordinates() {
  const files = await collectPhotoFiles(photosDir);
  const coordinates = [];

  for (const filePath of files) {
    const metadata = await exifr.parse(filePath, {
      gps: true,
      translateValues: true,
      reviveValues: true,
      pick: ['latitude', 'longitude', 'GPSLatitude', 'GPSLongitude'],
    });
    const lat = metadata?.latitude ?? metadata?.GPSLatitude;
    const lng = metadata?.longitude ?? metadata?.GPSLongitude;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      coordinates.push({ lat, lng });
    }
  }

  return coordinates;
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

function dedupeCoordinates(coordinates) {
  return Array.from(new Map(coordinates.map((coordinate) => [getCoordinateKey(coordinate.lat, coordinate.lng), coordinate])).values());
}

function getCoordinateKey(lat, lng) {
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadEnvFile(filePath) {
  let source;
  try {
    source = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] != null) continue;

    process.env[key] = unquoteEnvValue(value);
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getUserAgent() {
  const email = process.env.NOMINATIM_EMAIL ? ` (${process.env.NOMINATIM_EMAIL})` : '';
  return `anniversery-footprints/0.1${email}`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
