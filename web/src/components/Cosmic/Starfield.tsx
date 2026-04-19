import { useEffect, useMemo, useState } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  delay: number;
  color?: string;
}

interface StarfieldProps {
  /** When true, hide the layer (used for "plain" / reduced-motion mode). */
  plain?: boolean;
  /** When true, react to mouse parallax. Defaults to true. */
  parallax?: boolean;
}

function makeStars(count: number, rRange: [number, number], oRange: [number, number]): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    r: Math.random() * (rRange[1] - rRange[0]) + rRange[0],
    o: Math.random() * (oRange[1] - oRange[0]) + oRange[0],
    delay: Math.random() * 3,
  }));
}

export default function Starfield({ plain = false, parallax = true }: StarfieldProps) {
  const back  = useMemo(() => makeStars(55, [0.2, 0.8], [0.08, 0.43]), []);
  const mid   = useMemo(() => makeStars(24, [0.3, 1.1], [0.20, 0.55]), []);
  const front = useMemo<Star[]>(() => Array.from({ length: 8 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    r: Math.random() * 1.1 + 0.7,
    o: 0.55,
    delay: Math.random() * 3,
    color: Math.random() > 0.7 ? '#d9b25a' : '#ebe6d8',
  })), []);

  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => {
    if (!parallax) return;
    function onMove(e: MouseEvent) {
      setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [parallax]);

  if (plain) return null;

  const mx = (mouse.x - 0.5);
  const my = (mouse.y - 0.5);

  return (
    <div className="starfield" aria-hidden>
      <div className="parallax-layer" style={{ transform: `translate(${mx * -6}px, ${my * -6}px)` }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {back.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.3} fill="#ebe6d8" opacity={s.o}
              className="star-twinkle" style={{ animationDelay: `${s.delay}s` }} />
          ))}
        </svg>
      </div>
      <div className="parallax-layer" style={{ transform: `translate(${mx * -14}px, ${my * -14}px)` }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {mid.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.3} fill="#ebe6d8" opacity={s.o}
              className="star-twinkle" style={{ animationDelay: `${s.delay}s` }} />
          ))}
        </svg>
      </div>
      <div className="parallax-layer" style={{ transform: `translate(${mx * -28}px, ${my * -28}px)` }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {front.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.3} fill={s.color ?? '#ebe6d8'} opacity={s.o}
              className="star-twinkle" style={{ animationDelay: `${s.delay}s` }} />
          ))}
        </svg>
      </div>
    </div>
  );
}
