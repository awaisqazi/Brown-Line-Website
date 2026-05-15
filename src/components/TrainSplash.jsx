import React, { useEffect, useRef, useState } from 'react';

const APPROACH_MS = 1800;
const MIN_DURATION_MS = 2000;
const MAX_DURATION_MS = 6000;
const EXIT_MS = 900;

const TrainSplash = () => {
  const [phase, setPhase] = useState('approach'); // 'approach' | 'idle' | 'exit' | 'gone'
  const startedAtRef = useRef(0);
  const exitScheduledRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = performance.now();
    document.body.classList.add('splash-active');

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finish = () => {
      document.documentElement.classList.add('splash-done');
      document.body.classList.remove('splash-active');
      setPhase('gone');
    };

    if (prefersReducedMotion) {
      const t = window.setTimeout(finish, 200);
      return () => {
        window.clearTimeout(t);
        document.body.classList.remove('splash-active');
      };
    }

    const approachTimer = window.setTimeout(() => {
      setPhase((p) => (p === 'approach' ? 'idle' : p));
    }, APPROACH_MS);

    const scheduleExit = () => {
      if (exitScheduledRef.current) return;
      exitScheduledRef.current = true;
      const elapsed = performance.now() - startedAtRef.current;
      const wait = Math.max(0, MIN_DURATION_MS - elapsed);
      window.setTimeout(() => {
        setPhase('exit');
        window.setTimeout(finish, EXIT_MS);
      }, wait);
    };

    const onLoad = () => scheduleExit();
    if (document.readyState === 'complete') {
      scheduleExit();
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }
    const safety = window.setTimeout(scheduleExit, MAX_DURATION_MS);

    return () => {
      window.clearTimeout(approachTimer);
      window.clearTimeout(safety);
      window.removeEventListener('load', onLoad);
      document.body.classList.remove('splash-active');
    };
  }, []);

  const dismiss = () => {
    if (phase === 'exit' || phase === 'gone') return;
    exitScheduledRef.current = true;
    setPhase('exit');
    window.setTimeout(() => {
      document.documentElement.classList.add('splash-done');
      document.body.classList.remove('splash-active');
      setPhase('gone');
    }, EXIT_MS);
  };

  if (phase === 'gone') return null;

  const trainAnimClass =
    phase === 'approach'
      ? 'animate-train-approach'
      : phase === 'exit'
      ? 'animate-train-zoom-off'
      : 'animate-train-idle';

  const isExiting = phase === 'exit';

  return (
    <div
      className={`train-splash-root fixed inset-0 z-50 bg-[#FAF1EC] flex flex-col items-center justify-center overflow-hidden px-6 transition-opacity ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        transitionDuration: `${EXIT_MS}ms`,
        transitionTimingFunction: 'cubic-bezier(0.7, 0, 0.84, 0)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-label="The Brown Line intro"
      aria-live="polite"
    >
      {/* Lo-fi 70s grain overlay */}
      <div
        className="absolute inset-0 opacity-10 mix-blend-multiply pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Train tracks — converging rails with ties scrolling toward camera */}
      <div
        className="absolute inset-x-0 top-1/2 bottom-0 overflow-hidden pointer-events-none z-0"
        aria-hidden="true"
      >
        {/* Rails: SVG lines that converge to a vanishing point at the horizon */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Outer brown rails */}
          <line x1="49" y1="0" x2="-6" y2="100" stroke="#642713" strokeWidth="4" opacity="0.55" vectorEffect="non-scaling-stroke" />
          <line x1="51" y1="0" x2="106" y2="100" stroke="#642713" strokeWidth="4" opacity="0.55" vectorEffect="non-scaling-stroke" />
          {/* Steel sheen highlight on top of each rail */}
          <line x1="49.4" y1="0" x2="-5" y2="100" stroke="#FAF1EC" strokeWidth="1.2" opacity="0.45" vectorEffect="non-scaling-stroke" />
          <line x1="50.6" y1="0" x2="105" y2="100" stroke="#FAF1EC" strokeWidth="1.2" opacity="0.45" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Railroad ties (sleepers) scrolling from horizon to foreground */}
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={isExiting ? 'splash-tie-warp' : 'splash-tie'}
            style={{ animationDelay: `${-(i * 1.6) / 8}s` }}
          />
        ))}
      </div>

      {/* Approaching/idle/exiting train container */}
      <div className={`relative z-10 flex flex-col items-center w-full ${trainAnimClass}`}>
        {/* Train SVG */}
        <svg
          viewBox="0 0 400 400"
          className="w-[78vw] sm:w-full sm:max-w-md md:max-w-lg max-h-[70vh] drop-shadow-xl md:drop-shadow-2xl animate-rumble mx-auto"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Body */}
          <rect x="50" y="40" width="300" height="320" rx="40" fill="#642713" />

          {/* Chrome trim */}
          <rect x="60" y="50" width="280" height="300" rx="30" fill="none" stroke="#FAF1EC" strokeWidth="4" strokeOpacity="0.3" />

          {/* LED marquee frame */}
          <rect x="80" y="70" width="240" height="40" rx="8" fill="#111" />
          <rect x="80" y="70" width="240" height="40" rx="8" fill="none" stroke="#333" strokeWidth="2" />

          {/* Scrolling marquee text */}
          <foreignObject x="85" y="75" width="230" height="30">
            <div className="w-full h-full overflow-hidden flex items-center bg-[#111]">
              <div className="animate-marquee whitespace-nowrap text-[#FFBC29] font-mono text-lg uppercase font-bold tracking-widest drop-shadow-[0_0_8px_rgba(255,188,41,0.8)]">
                NEXT STOP: THE BROWN LINE &bull; A CHICAGO CULTURAL NEWSLETTER &bull; ALL ABOARD &bull;
              </div>
            </div>
          </foreignObject>

          {/* Windshield */}
          <rect x="70" y="130" width="260" height="130" rx="20" fill="#FAF1EC" fillOpacity="0.15" />
          <rect x="70" y="130" width="260" height="130" rx="20" fill="none" stroke="#FAF1EC" strokeWidth="2" strokeOpacity="0.5" />

          {/* Glare */}
          <path d="M 80 140 Q 200 130 320 180 L 320 150 Q 200 120 80 130 Z" fill="#FAF1EC" fillOpacity="0.1" />

          {/* Headlights */}
          <circle cx="110" cy="290" r="18" fill="#FAF1EC" className="animate-pulse drop-shadow-[0_0_15px_rgba(250,241,236,0.8)]" />
          <circle cx="290" cy="290" r="18" fill="#FAF1EC" className="animate-pulse drop-shadow-[0_0_15px_rgba(250,241,236,0.8)]" />

          {/* Grill */}
          <rect x="160" y="280" width="80" height="20" rx="5" fill="#111" fillOpacity="0.5" />
          <line x1="170" y1="290" x2="230" y2="290" stroke="#642713" strokeWidth="3" />

          {/* Rainbow bumper. design.md palette. */}
          <rect x="50" y="330" width="300" height="8" fill="#F79CD0" />
          <rect x="50" y="338" width="300" height="8" fill="#5BC3FF" />
          <rect x="50" y="346" width="300" height="8" fill="#90D393" />
          <rect x="50" y="354" width="300" height="8" fill="#FFBC29" />
          <rect x="50" y="362" width="300" height="8" fill="#F35A0F" />
        </svg>
      </div>

      {/* Loading indicator — visible while the page is still pulling in */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-20 font-body text-[10px] md:text-xs uppercase tracking-[0.3em] text-[#642713]/70 flex items-center gap-2 transition-opacity duration-300 ${
          phase === 'idle' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ top: 'max(1.5rem, env(safe-area-inset-top))' }}
        aria-hidden="true"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F35A0F] animate-pulse" />
        Now boarding
      </div>

      {/* Skip affordance */}
      <button
        type="button"
        onClick={dismiss}
        style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        className="absolute left-1/2 -translate-x-1/2 z-20 font-body text-xs uppercase tracking-widest text-[#642713]/60 hover:text-[#642713] focus-visible:text-[#642713] focus:outline-none focus-visible:underline decoration-[#5BC3FF] decoration-2 underline-offset-4 px-3 py-2 min-h-[44px] flex items-center"
      >
        Skip intro &rarr;
      </button>

      <style>{`
        @keyframes train-approach {
          0%   { transform: scale(0.1) translateY(-25vh); opacity: 0; filter: blur(8px); }
          30%  { opacity: 1; filter: blur(4px); }
          100% { transform: scale(1) translateY(0); filter: blur(0px); opacity: 1; }
        }
        .animate-train-approach {
          animation: train-approach 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity, filter;
        }

        @keyframes train-idle {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        .animate-train-idle {
          animation: train-idle 2.6s ease-in-out infinite;
          will-change: transform;
        }

        @keyframes train-zoom-off {
          0%   { transform: scale(1) translateY(0); filter: blur(0px); opacity: 1; }
          40%  { transform: scale(1.4) translateY(-3vh); filter: blur(3px); opacity: 1; }
          100% { transform: scale(7) translateY(-25vh); filter: blur(18px); opacity: 0; }
        }
        .animate-train-zoom-off {
          animation: train-zoom-off ${EXIT_MS}ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
          will-change: transform, opacity, filter;
        }

        @keyframes rumble {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25%      { transform: translate(-1px, 1px) rotate(-0.5deg); }
          50%      { transform: translate(1px, -1px) rotate(0.5deg); }
          75%      { transform: translate(-1px, -1px) rotate(0deg); }
        }
        .animate-rumble {
          animation: rumble 0.5s ease-in-out infinite;
          animation-delay: 1.8s;
        }

        @keyframes marquee {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          padding-left: 100%;
          animation: marquee 12s linear infinite;
        }

        .splash-tie,
        .splash-tie-warp {
          position: absolute;
          left: 50%;
          background: #642713;
          border-radius: 2px;
          pointer-events: none;
          will-change: top, width, height, margin-left, opacity;
        }
        .splash-tie {
          animation: splash-tie-move 1.6s linear infinite;
        }
        .splash-tie-warp {
          animation: splash-tie-move 0.45s linear infinite;
        }
        @keyframes splash-tie-move {
          0%   { top: 0%;   width: 2%;   height: 2px;  margin-left: -1%;  opacity: 0; }
          8%   { opacity: 0.5; }
          100% { top: 100%; width: 110%; height: 18px; margin-left: -55%; opacity: 0.55; }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-train-approach,
          .animate-train-idle,
          .animate-train-zoom-off,
          .animate-rumble,
          .animate-marquee,
          .splash-tie,
          .splash-tie-warp {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TrainSplash;
