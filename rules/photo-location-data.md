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

- Generated photo manifests may read this cache and merge a normalized, frontend-safe subset into `metadata.derived.location` and `metadata.derived.locationProviders`.
- Do not embed raw provider responses into the frontend manifest. Keep raw responses only in the ignored cache for debugging.

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
- Normalize provider responses into this common shape before exposing them to application code:

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

## Photo Metadata

- Preserve full serializable EXIF metadata under `metadata.exif` when generating `src/photoManifest.ts`.
- Keep derived fields stable and easy to consume:

```ts
metadata.derived.takenAt
metadata.derived.latitude
metadata.derived.longitude
metadata.derived.location
```

- If a photo lacks GPS or taken time, skip it rather than guessing.

## Git Hygiene

- Commit source code, scripts, docs, and generated `src/photoManifest.ts` when it is part of the app behavior.
- Do not commit `config/`, `src/generated/`, `photos/`, or API caches.
- When the worktree has unrelated user changes, stage only the files required for the current task.
