// In-memory reimplementation of the three Supabase Storage buckets the app
// uses (profile-photos, stories, voice-notes). Uploaded blobs are kept only
// for the lifetime of the tab via URL.createObjectURL — there is no real
// network round trip, no persistence across reloads, and no server-side
// resizing/validation.
export interface StorageError {
  message: string;
  statusCode?: string;
  error?: string;
}

interface StoredObject {
  path: string;
  blob: Blob;
  objectUrl: string;
  createdAt: string;
  contentType: string;
}

const buckets = new Map<string, Map<string, StoredObject>>();

function bucketMap(bucket: string): Map<string, StoredObject> {
  let m = buckets.get(bucket);
  if (!m) {
    m = new Map();
    buckets.set(bucket, m);
  }
  return m;
}

function storageError(message: string, statusCode = '400'): StorageError {
  return { message, statusCode, error: message };
}

// jsdom (the vitest test environment) doesn't implement URL.createObjectURL —
// real browsers (dev/build/preview) always do. Fall back to a synthetic
// placeholder there instead of throwing, so unit tests that happen to touch
// storage don't crash.
function createObjectUrl(file: Blob, path: string): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }
  return `blob:mock-backend/${path}#${Date.now()}`;
}

function revokeObjectUrl(url: string): void {
  if (url.startsWith('blob:mock-backend/')) return; // synthetic fallback URL, nothing to revoke
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

class MockStorageBucket {
  constructor(private readonly bucket: string) {}

  async upload(path: string, file: Blob | File, options?: { contentType?: string; upsert?: boolean; cacheControl?: string }) {
    const objects = bucketMap(this.bucket);
    if (objects.has(path) && !options?.upsert) {
      return { data: null, error: storageError('The resource already exists', '409') };
    }
    const prior = objects.get(path);
    if (prior) revokeObjectUrl(prior.objectUrl);
    const objectUrl = createObjectUrl(file, `${this.bucket}/${path}`);
    objects.set(path, {
      path,
      blob: file,
      objectUrl,
      createdAt: new Date().toISOString(),
      contentType: options?.contentType ?? (file as File).type ?? 'application/octet-stream',
    });
    return {
      data: { path, id: path, fullPath: `${this.bucket}/${path}` },
      error: null,
    };
  }

  getPublicUrl(path: string) {
    const obj = bucketMap(this.bucket).get(path);
    return {
      data: { publicUrl: obj?.objectUrl ?? `blob:mock-backend/${this.bucket}/${path}` },
    };
  }

  async createSignedUrl(path: string, _expiresInSeconds: number) {
    const obj = bucketMap(this.bucket).get(path);
    if (!obj) {
      return { data: null, error: storageError('Object not found', '404') };
    }
    return { data: { signedUrl: obj.objectUrl, path }, error: null };
  }

  async list(prefix = '') {
    const objects = Array.from(bucketMap(this.bucket).values()).filter((o) => o.path.startsWith(prefix));
    const entries = objects.map((o) => {
      const rest = o.path.slice(prefix.length).replace(/^\//, '');
      const name = rest.split('/')[0] || rest;
      return {
        name,
        id: o.path,
        updated_at: o.createdAt,
        created_at: o.createdAt,
        last_accessed_at: o.createdAt,
        metadata: { size: o.blob.size, mimetype: o.contentType, cacheControl: 'max-age=3600' },
      };
    });
    // De-duplicate by name (real storage.list() returns one entry per immediate child).
    const seen = new Map<string, (typeof entries)[number]>();
    for (const e of entries) seen.set(e.name, e);
    return { data: Array.from(seen.values()), error: null };
  }

  async remove(paths: string[]) {
    const objects = bucketMap(this.bucket);
    const removed: { name: string }[] = [];
    for (const p of paths) {
      const obj = objects.get(p);
      if (obj) {
        revokeObjectUrl(obj.objectUrl);
        objects.delete(p);
        removed.push({ name: p });
      }
    }
    return { data: removed, error: null };
  }
}

export const mockStorage = {
  from(bucket: string): MockStorageBucket {
    return new MockStorageBucket(bucket);
  },
};
