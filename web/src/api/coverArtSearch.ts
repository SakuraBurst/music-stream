/**
 * Search MusicBrainz Cover Art Archive for album cover art.
 * Uses the MusicBrainz API to find a release, then fetches cover from the Cover Art Archive.
 */

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const COVERART_API = 'https://coverartarchive.org';
const USER_AGENT = 'Sonus/0.1.0 (https://github.com/sonus)';

/** Minimum interval between MusicBrainz API requests (ms). */
const MIN_REQUEST_INTERVAL = 1000;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal,
  });
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  score: number;
}

interface MusicBrainzSearchResponse {
  releases: MusicBrainzRelease[];
}

/**
 * Search for cover art by artist and album name.
 * Returns an object URL for the image, or null if not found.
 * The caller is responsible for revoking the URL when no longer needed.
 */
export async function searchCoverArt(
  artist: string,
  album: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!artist.trim() || !album.trim()) return null;

  try {
    // Step 1: Search MusicBrainz for the release
    const query = `artist:${encodeURIComponent(artist.trim())}+release:${encodeURIComponent(album.trim())}`;
    const searchUrl = `${MUSICBRAINZ_API}/release/?query=${query}&fmt=json&limit=1`;

    const searchResponse = await rateLimitedFetch(searchUrl, signal);
    if (!searchResponse.ok) return null;

    const searchData = (await searchResponse.json()) as MusicBrainzSearchResponse;
    if (!searchData.releases || searchData.releases.length === 0) return null;

    const mbid = searchData.releases[0].id;

    // Step 2: Fetch cover art from Cover Art Archive
    const coverUrl = `${COVERART_API}/release/${mbid}/front-250`;
    const coverResponse = await fetch(coverUrl, { signal });
    if (!coverResponse.ok) return null;

    const blob = await coverResponse.blob();
    return URL.createObjectURL(blob);
  } catch {
    // AbortError, network errors, etc.
    return null;
  }
}
