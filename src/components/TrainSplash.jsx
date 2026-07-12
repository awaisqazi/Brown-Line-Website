import React, { useEffect, useRef, useState } from 'react';

const AUTO_DISMISS_MS = 1500; // Brief brand gate; fades on its own if the visitor doesn't act
const EXIT_MS = 500; // Gentle opacity fade for the automatic exit
const EXIT_FAST_MS = 220; // Manual skips feel near-instant
const WATCHDOG_MS = 7000; // Backstop so an engaged-then-abandoned gate still closes
const BASE_URL = import.meta.env.BASE_URL || '/';

// Persist that the intro has been seen so returning visitors (and anyone opening
// a shared link a second time) never hit the gate again. Read in Layout.astro's
// inline <head> script, which adds `splash-done` before the splash can paint.
const rememberIntroSeen = () => {
  try {
    localStorage.setItem('brownLineIntroSeen', '1');
  } catch (_) {}
};

const TrainSplash = () => {
  // Returning visitors already have html.splash-done set by Layout's inline head
  // script; skip straight to 'gone' so no timers or key handlers attach.
  const [phase, setPhase] = useState(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('splash-done')
      ? 'gone'
      : 'gate'
  ); // 'gate' | 'exit' | 'gone'
  const [isFastExit, setIsFastExit] = useState(false);
  const [nextStop, setNextStop] = useState('THE PLATFORM');
  const dismissRef = useRef(null);
  const rootRef = useRef(null);
  const exitTimeoutRef = useRef(null);
  const autoTimeoutRef = useRef(null);
  const watchdogTimeoutRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Universal next stop path detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rawPath = window.location.pathname.toLowerCase();
      const normalizedBase = BASE_URL.toLowerCase().replace(/\/+$/, '');
      let path = rawPath.replace(/\/+$/, '') || '/';

      if (normalizedBase && normalizedBase !== '/' && (path === normalizedBase || path.startsWith(`${normalizedBase}/`))) {
        path = path.slice(normalizedBase.length) || '/';
      }

      const segments = path.split('/').filter(Boolean);
      let routeName = segments[segments.length - 1] || '';

      if (routeName === 'index.html' && segments.length > 1) {
        routeName = segments[segments.length - 2];
      }

      const cleanRouteName = routeName
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ');

      if (!cleanRouteName || cleanRouteName === 'index') {
        setNextStop('HOME PLATFORM');
      } else if (cleanRouteName === 'about') {
        setNextStop('ABOUT THE LINE');
      } else if (cleanRouteName === 'events') {
        setNextStop('EVENTS');
      } else if (cleanRouteName === 'links') {
        setNextStop('THE DIRECTORY');
      } else if (cleanRouteName === 'standards') {
        setNextStop('EDITORIAL STANDARDS');
      } else {
        setNextStop(cleanRouteName.toUpperCase() || 'THE PLATFORM');
      }
    }
  }, []);

  useEffect(() => {
    if (phaseRef.current === 'gone') return undefined;
    document.body.classList.add('splash-active');

    // React is driving the splash now, so cancel the pure-CSS no-JS failsafe. It
    // can neither unlock scroll nor persist the "seen" flag, so it must not race
    // our exit; JS owns dismissal from here.
    if (rootRef.current) rootRef.current.classList.add('splash-hydrated');

    // Move focus into the dialog so keyboard and screen-reader users interact
    // with the gate instead of the page behind it.
    if (rootRef.current) rootRef.current.focus({ preventScroll: true });

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finish = () => {
      rememberIntroSeen();
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

    // A moving pointer means the visitor is engaging with the gate; cancel the
    // auto-dismiss so it never slides out from under a reach for "Enter".
    const markInteracted = () => {
      if (autoTimeoutRef.current) {
        window.clearTimeout(autoTimeoutRef.current);
        autoTimeoutRef.current = null;
      }
    };
    window.addEventListener('pointermove', markInteracted, { once: true });

    // Nothing to watch anymore: hold the gate briefly, then fade unless engaged.
    autoTimeoutRef.current = window.setTimeout(() => {
      autoTimeoutRef.current = null;
      if (dismissRef.current) dismissRef.current(false);
    }, AUTO_DISMISS_MS);

    // Backstop: close even an engaged-then-abandoned gate (the CSS failsafe is
    // switched off once hydrated and cannot unlock scroll on its own).
    watchdogTimeoutRef.current = window.setTimeout(() => {
      watchdogTimeoutRef.current = null;
      if (dismissRef.current) dismissRef.current(false);
    }, WATCHDOG_MS);

    return () => {
      window.removeEventListener('pointermove', markInteracted);
      if (autoTimeoutRef.current) window.clearTimeout(autoTimeoutRef.current);
      if (watchdogTimeoutRef.current) window.clearTimeout(watchdogTimeoutRef.current);
      if (exitTimeoutRef.current) window.clearTimeout(exitTimeoutRef.current);
      document.body.classList.remove('splash-active');
    };
  }, []);

  // Manual skips (tap, button, Space, B, Escape) exit near-instantly; the
  // automatic timeline keeps the gentler opacity fade.
  const dismiss = (fast = true) => {
    if (phase === 'exit' || phase === 'gone') return;
    // Cancel any pending auto-exit / watchdog so they cannot re-trigger.
    if (autoTimeoutRef.current) {
      window.clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
    if (watchdogTimeoutRef.current) {
      window.clearTimeout(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = null;
    }

    setIsFastExit(fast);
    setPhase('exit');

    rememberIntroSeen();
    // Unlock page scroll right away on manual skips.
    if (fast) document.body.classList.remove('splash-active');
    exitTimeoutRef.current = window.setTimeout(() => {
      document.documentElement.classList.add('splash-done');
      document.body.classList.remove('splash-active');
      setPhase('gone');
    }, fast ? EXIT_FAST_MS : EXIT_MS);
  };

  // Keep a mutable ref of dismiss for the keyboard listener to prevent closure staleness
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  // Keyboard shortcuts while the splash is visible: Space, B, or Escape skip.
  useEffect(() => {
    if (phase === 'exit' || phase === 'gone') return undefined;
    const handleKeyDown = (e) => {
      if (!['Space', 'KeyB', 'Escape'].includes(e.code)) return;

      const target = e.target;
      const isInteractiveTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName));

      if (isInteractiveTarget && e.code !== 'Escape') return;

      e.preventDefault(); // Prevent standard browser space-scrolling during the splash.
      if (dismissRef.current) {
        dismissRef.current(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [phase]);

  if (phase === 'gone') return null;

  const isExiting = phase === 'exit';
  const exitDurationMs = isFastExit ? EXIT_FAST_MS : EXIT_MS;

  return (
    <div
      ref={rootRef}
      onClick={() => dismiss(true)}
      tabIndex={-1}
      className={`train-splash-root fixed inset-0 z-[9999] bg-[#FAF1EC] flex flex-col items-center justify-center overflow-hidden px-6 transition-opacity cursor-pointer focus:outline-none ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      style={{
        transitionDuration: `${exitDurationMs}ms`,
        transitionTimingFunction: 'ease-out',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="The Brown Line intro"
      aria-live="polite"
    >
      {/* Background Enhancements: Elegant Gradient Transition */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAF1EC] to-[#EBE0D8] z-0" />

      {/* Retro tactile newsprint texture grain */}
      <div
        className="absolute inset-0 opacity-[0.15] mix-blend-multiply pointer-events-none z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* --- Wordmark + static destination sign --- */}
      <div className="relative z-20 flex flex-col items-center gap-6 sm:gap-8 w-full">

        {/* Wordmark / logo block */}
        <div
          className="flex flex-col items-center gap-1.5 select-none"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.4em] text-[#642713]/70">
            Now boarding
          </span>
          <span className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-[#642713]">
            The Brown Line
          </span>
        </div>

        {/* Static "NEXT STOP" destination board, styled like a transit sign
            (amber-on-walnut LED) now that the train's own board is gone. */}
        <div className="relative border-[3px] border-[#642713] bg-[#1C1300] px-6 py-3 rounded-md shadow-[4px_4px_0px_#642713]">
          <span
            className="font-mono text-sm sm:text-base font-black uppercase text-[#FFBC29]"
            style={{
              letterSpacing: '0.2em',
              textShadow: '0 0 6px rgba(255,188,41,0.75)',
            }}
          >
            {`NEXT STOP: ${nextStop}`}
          </span>
        </div>
      </div>

      {/* Boarding controls (master-doc copy): primary Enter button, helper line, small skip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 rounded-xl bg-[#FAF1EC]/80 px-5 pb-2.5 pt-3 backdrop-blur-sm"
        style={{
          bottom: 'max(1.4rem, env(safe-area-inset-bottom))',
          fontFamily: "'Montserrat', sans-serif"
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss(true);
          }}
          className="font-bold text-xs uppercase tracking-widest text-[#FAF1EC] bg-[#642713] border-2 border-[#642713] hover:bg-[#FAF1EC] hover:text-[#642713] active:translate-y-[2px] shadow-[4px_4px_0px_#2B120A] hover:shadow-[2px_2px_0px_#2B120A] active:shadow-[0px_0px_0px_#2B120A] px-6 py-3 rounded-lg min-h-[46px] flex items-center gap-2.5 transition-all duration-150 select-none cursor-pointer"
        >
          <span className="whitespace-nowrap">Enter the platform</span>
          <span aria-hidden="true" className="text-sm leading-none">&rarr;</span>
        </button>

        <p className="font-body text-[10px] md:text-[11px] uppercase tracking-[0.18em] text-[#642713]/70 select-none pointer-events-none">
          Press space or tap anywhere to continue.
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss(true);
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-[#642713]/80 underline decoration-dotted underline-offset-4 hover:text-[#642713] cursor-pointer select-none"
        >
          Skip intro (B)
        </button>
      </div>

      {/* --- Gate fail-safe + reduced-motion handling --- */}
      <style>{`
        /* Fail-safe: the splash normally dismisses via JS (this component
           unmounts well before 9s). But if the script never hydrates (blocked,
           slow, or errored), this pure-CSS animation fades the overlay out and
           drops pointer-events so a visitor is never permanently trapped. It is
           present in the server-rendered HTML, so it works with no JS at all. */
        .train-splash-root {
          animation: splash-failsafe-hide 0.6s ease 9s forwards;
        }
        /* Once React hydrates it owns dismissal (and can unlock scroll and persist
           the "seen" flag, which the CSS failsafe cannot), so it is cancelled. */
        .train-splash-root.splash-hydrated {
          animation: none;
        }
        @keyframes splash-failsafe-hide {
          to { opacity: 0; visibility: hidden; pointer-events: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          /* No-JS reduced-motion visitors are still freed, just without the fade. */
          .train-splash-root {
            animation-duration: 0.01s;
          }
        }
      `}</style>
    </div>
  );
};

export default TrainSplash;
