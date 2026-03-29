import { useAuthStore } from '../store/authStore.ts';

const BASE_URL = '/api/v1';

export interface UploadFileResult {
  id?: string;
  title?: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
  format?: string;
  error?: string;
  filename: string;
}

export interface UploadResponse {
  results: UploadFileResult[];
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/** Per-file metadata override sent as JSON in the "metadata" form field. */
export interface MetadataOverride {
  filename: string;
  title?: string;
  artist?: string;
  album?: string;
  track_number?: number;
}

export interface UploadOptions {
  files: File[];
  metadata?: MetadataOverride[];
  /** Map from original audio filename to cover art File. */
  coverArtFiles?: Map<string, File>;
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Ensure the access token is fresh. If it expires within 30 seconds,
 * trigger a refresh before returning.
 */
async function ensureFreshToken(): Promise<string | null> {
  const state = useAuthStore.getState();
  let { accessToken } = state;
  if (!accessToken) return null;

  // Check if token expires soon (within 30s).
  try {
    const payload = accessToken.split('.')[1];
    if (payload) {
      const decoded = JSON.parse(atob(payload));
      const exp = decoded.exp as number | undefined;
      if (exp && exp - Math.floor(Date.now() / 1000) < 30) {
        const refreshed = await state.refresh();
        if (refreshed) {
          accessToken = useAuthStore.getState().accessToken;
        }
      }
    }
  } catch {
    // If parsing fails, use the token as-is.
  }

  return accessToken;
}

/**
 * Send files via XHR with progress tracking.
 * Returns the XHR so the caller can abort or retry.
 */
function doUpload(
  options: {
    files: File[];
    metadata?: MetadataOverride[];
    coverArtFiles?: Map<string, File>;
  },
  token: string,
  onProgress?: (progress: UploadProgress) => void,
): { promise: Promise<UploadResponse>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<UploadResponse>((resolve, reject) => {
    const formData = new FormData();
    for (const file of options.files) {
      formData.append('files', file);
    }

    // Append metadata JSON if provided
    if (options.metadata && options.metadata.length > 0) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    // Append cover art files as coverart_<filename>
    if (options.coverArtFiles) {
      for (const [filename, coverFile] of options.coverArtFiles) {
        formData.append(`coverart_${filename}`, coverFile);
      }
    }

    xhr.open('POST', `${BASE_URL}/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadResponse;
          resolve(data);
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        reject(Object.assign(new Error(xhr.responseText || `Upload failed with status ${xhr.status}`), { status: xhr.status }));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}

/**
 * Upload audio files via multipart/form-data.
 * Ensures a fresh JWT before sending. On 401, refreshes the token and retries once.
 *
 * Accepts either the legacy (files, onProgress) signature or the new UploadOptions object.
 */
export function uploadFiles(
  filesOrOptions: File[] | UploadOptions,
  onProgress?: (progress: UploadProgress) => void,
): { promise: Promise<UploadResponse>; abort: () => void } {
  // Normalize arguments: support both old (File[], onProgress) and new (UploadOptions) signatures
  const options: UploadOptions = Array.isArray(filesOrOptions)
    ? { files: filesOrOptions, onProgress }
    : filesOrOptions;

  const progressCallback = options.onProgress ?? onProgress;

  let currentAbort: (() => void) | null = null;
  let aborted = false;

  const uploadPayload = {
    files: options.files,
    metadata: options.metadata,
    coverArtFiles: options.coverArtFiles,
  };

  const promise = (async (): Promise<UploadResponse> => {
    const token = await ensureFreshToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const first = doUpload(uploadPayload, token, progressCallback);
    currentAbort = first.abort;
    if (aborted) { first.abort(); }

    try {
      return await first.promise;
    } catch (err: unknown) {
      // On 401, refresh token and retry once.
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        const refreshed = await useAuthStore.getState().refresh();
        if (!refreshed) throw new Error('Authentication expired, please log in again');

        const newToken = useAuthStore.getState().accessToken;
        if (!newToken) throw new Error('Not authenticated');

        const retry = doUpload(uploadPayload, newToken, progressCallback);
        currentAbort = retry.abort;
        if (aborted) { retry.abort(); }
        return await retry.promise;
      }
      throw err;
    }
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      currentAbort?.();
    },
  };
}
