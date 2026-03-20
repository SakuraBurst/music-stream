import { usePlayerStore } from '../../store/playerStore.ts';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const play = usePlayerStore((s) => s.play);

  if (!queueOpen || queue.length === 0) return null;

  function handleClick(index: number) {
    const track = queue[index];
    play(track, queue, index);
  }

  return (
    <div className="absolute right-0 bottom-full mb-0 w-80 max-h-96 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-t-lg shadow-xl z-50">
      <div className="px-4 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-100">Queue</h3>
        <p className="text-xs text-zinc-500">{queue.length} tracks</p>
      </div>

      <ul>
        {queue.map((track, i) => {
          const isCurrent = i === queueIndex;
          return (
            <li
              key={`${track.id}-${i}`}
              onClick={() => handleClick(i)}
              className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                isCurrent
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs w-5 text-right shrink-0 tabular-nums">
                {isCurrent ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 inline text-white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{track.title}</p>
                <p className="text-xs text-zinc-500 truncate">{track.artistName}</p>
              </div>
              <span className="text-xs text-zinc-600 tabular-nums shrink-0">
                {formatDuration(track.durationSeconds)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
