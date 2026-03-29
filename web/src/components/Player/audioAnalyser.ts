/**
 * Module-level singleton for Web Audio API analysis.
 *
 * CRITICAL: `createMediaElementSource()` can only be called ONCE per
 * <audio> element.  We therefore create the AudioContext, source node, and
 * AnalyserNode here at module scope so they persist across React
 * mount/unmount cycles.
 *
 * Call `initAudioAnalyser(audioElement)` once from PlayerProvider after
 * the <audio> element is available.  Components that need frequency data
 * call `getAnalyserNode()`.
 */

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let connectedElement: HTMLAudioElement | null = null;

/**
 * Lazily create the AudioContext + AnalyserNode and wire them to the
 * given <audio> element.  Safe to call multiple times — subsequent calls
 * with the same element are no-ops; calls with a *different* element are
 * ignored (createMediaElementSource can only be called once).
 *
 * Returns `true` if the analyser is ready, `false` on failure.
 */
export function initAudioAnalyser(audio: HTMLAudioElement): boolean {
  // Already wired to this element — nothing to do.
  if (connectedElement === audio && analyser) return true;

  // Already wired to a *different* element — can't re-create.
  if (connectedElement && connectedElement !== audio) return analyser !== null;

  try {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; // 128 frequency bins
    analyser.smoothingTimeConstant = 0.8;

    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    connectedElement = audio;
    return true;
  } catch {
    // AudioContext may not be available (old browser, restrictive env).
    audioCtx = null;
    analyser = null;
    sourceNode = null;
    return false;
  }
}

/**
 * Resume the AudioContext after a user gesture.  Browsers suspend
 * AudioContext created before interaction; call this on the first
 * play / click.
 */
export function resumeAudioContext(): void {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Best-effort — if it fails, visualizer just won't animate.
    });
  }
}

/**
 * Return the AnalyserNode if initialised, or `null`.
 */
export function getAnalyserNode(): AnalyserNode | null {
  return analyser;
}
