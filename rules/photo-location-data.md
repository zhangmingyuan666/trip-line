# Photo Location Data Rules

## Scope

These rules apply to photo metadata extraction, reverse geocoding, API usage, local caches, and generated photo manifests in this project.

## API Calls

- Never call reverse geocoding APIs from `npm run dev`, `npm run build`, or `npm run generate:photos`.
- Reverse geocoding must only run through the explicit script:

```bash
npm run geocode:photos
```

- `npm run geocode:photos` must require a configured provider before making network requests.
- Use `LOCATION_LIMIT=1` for smoke tests before any batch request.
- Batch geocoding requires explicit user confirmation because it can consume paid quota.
- Do not refresh existing cache entries unless the user explicitly asks for it and `LOCATION_FORCE=1` is set.

## Caching

- Reverse geocoding results must be cached by rounded coordinate key:

```text
lat.toFixed(6),lng.toFixed(6)
```

- Cache entries are provider-specific. A coordinate already cached for `amap` must not be requested from `amap` again by default.
- The cache file is local generated data:

```text
src/generated/location-cache.json
```

- Generated photo manifests must not read this cache or merge reverse-geocoded addresses into frontend data.
- Do not embed raw provider responses or normalized provider responses into the frontend manifest. Keep reverse-geocoding results only in the ignored cache for local debugging.

## Secrets

- API keys must live in local config files under:

```text
config/
```

- `config/` must stay in `.gitignore`.
- Do not hardcode API keys in source files, generated manifests, README examples, commits, or command aliases.
- Local config may be loaded by scripts, but shell environment variables should remain able to override config values for one-off runs.

## Providers

- Supported providers are `amap`, `geoapify`, and `nominatim`.
- Prefer `amap` for China mainland, Hong Kong, and Macau POI quality.
- Normalize provider responses into this common shape before writing the local cache:

```ts
type PhotoResolvedLocation = {
  provider: string;
  providerPlaceId: string | null;
  name: string | null;
  poi: string | null;
  address: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  queriedAt: string;
};
```

- Provider fields can have inconsistent types, especially in Hong Kong/Macau results. Normalize empty arrays and empty strings to `null` before writing frontend-facing data.

## Photo Metadata And Manifests

- Generated photo manifests must be written to ignored local generated data:

```text
src/generated/photoManifest.ts
```

- Do not commit generated photo manifests.
- Do not generate or commit `src/photoManifest.ts`.
- Do not embed full EXIF, reverse-geocoded addresses, POI names, provider IDs, source file paths, file sizes, modified times, camera metadata, or API provider details in a frontend manifest.
- Keep only the minimum fields required for playback and rendering:

```ts
id
fileName
takenAt
lat
lng
fileType
rawUrl
```

- Exact GPS coordinates and timestamps are still private data. They may exist in ignored local generated files for the app to render the route, but must not be committed.
- If a photo lacks GPS or taken time, skip it rather than guessing.

## Git Hygiene

- Commit source code, scripts, and docs only.
- Do not commit `config/`, `src/generated/`, `photos/`, or API caches.
- If a privacy-bearing generated file is accidentally committed, remove it from the current tree and rewrite Git history before pushing.
- When the worktree has unrelated user changes, stage only the files required for the current task.
