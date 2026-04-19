import { usePlayerStore } from '../../store/playerStore.ts';
import { toRoman } from '../Cosmic/utils.ts';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const play = usePlayerStore((s) => s.play);

  if (!queueOpen || queue.length === 0) return null;

  return (
    <div className="absolute right-4 bottom-full mb-0 w-[340px] max-h-[420px] overflow-y-auto
                    bg-[rgba(11,13,16,0.96)] backdrop-blur-xl border border-[var(--line2)]
                    border-b-0 shadow-2xl z-50">
      <div className="px-5 py-3 border-b border-[var(--line)] sticky top-0 bg-[rgba(11,13,16,0.96)] backdrop-blur-xl">
        <h3 className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase">
          Up Next · {queue.length} bodies
        </h3>
      </div>

      <ul>
        {queue.map((track, i) => {
          const isCurrent = i === queueIndex;
          return (
            <li
              key={`${track.id}-${i}`}
              onClick={() => play(track, queue, i)}
              className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors hair-row
                ${isCurrent ? 'bg-[rgba(255,255,255,0.04)]' : ''}`}
            >
              <span className={`font-serif italic text-[12px] w-8 text-right shrink-0 ${isCurrent ? 'text-[var(--rose)]' : 'text-[var(--mute)]'}`}>
                {isCurrent ? '◉' : toRoman(i + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-serif text-[13px] truncate ${isCurrent ? 'text-[var(--ink)]' : 'text-[var(--ink2)]'}`}>{track.title}</p>
                <p className="font-mono-jb text-[9px] tracking-[1.5px] text-[var(--mute)] uppercase truncate">{track.artistName}</p>
              </div>
              <span className="font-mono-jb text-[10px] text-[var(--mute)] tabular-nums shrink-0">
                {formatDuration(track.durationSeconds)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
