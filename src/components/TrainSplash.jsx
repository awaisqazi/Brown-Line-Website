import React, { useEffect, useRef, useState } from 'react';

const APPROACH_MS = 1800;
const MIN_DURATION_MS = 2500; // Slightly longer to enjoy the animation
const MAX_DURATION_MS = 6000;
const EXIT_MS = 900; // Cinematic zoom-off for the automatic exit
const EXIT_FAST_MS = 220; // Manual skips must feel instant
const AUDIO_SEQUENCE_FALLBACK_MS = 7000;
const BASE_URL = import.meta.env.BASE_URL || '/';

const assetPath = (path) => `${BASE_URL}${path.replace(/^\/+/, '')}`;

// Persist that the intro has been seen so returning visitors (and anyone opening
// a shared link a second time) never hit the gate again. Read in Layout.astro's
// inline <head> script, which adds `splash-done` before the splash can paint.
const rememberIntroSeen = () => {
  try {
    localStorage.setItem('brownLineIntroSeen', '1');
  } catch (_) {}
};

// --- Synthesized & High-Fidelity CTA Audio Engine ---
class CTATrainAudio {
  constructor() {
    this.ctx = null;
    this.humNode = null;
    this.isMuted = true;
    this.ctaDing = null;
    this.welcomeAboard = null;
    this.welcomeSource = null;
    this.welcomeGainNode = null;
    this.isFadingOut = false;
    this.onWelcomeEnded = null;
    this.welcomeStarted = false;
    this.sequenceFallbackTimer = null;
    this.hasCompletedSequence = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }

    // Initialize HTML5 Audio elements
    try {
      if (!this.ctaDing) {
        this.ctaDing = new Audio(assetPath('audio/cta-ding.mp3'));
        this.ctaDing.crossOrigin = 'anonymous';
        this.ctaDing.preload = 'auto';
        
        // Listen to timeupdate to blend the two tracks smoothly near the end of CTA Ding
        this.ctaDing.addEventListener('timeupdate', () => {
          const duration = this.ctaDing.duration;
          const currentTime = this.ctaDing.currentTime;
          if (duration && (duration - currentTime <= 0.4) && !this.welcomeStarted && !this.isMuted) {
            this.welcomeStarted = true;
            this.playWelcomeAboard();
          }
        });

        // Safety fallback listener
        this.ctaDing.addEventListener('ended', () => {
          if (!this.welcomeStarted && !this.isMuted) {
            this.welcomeStarted = true;
            this.playWelcomeAboard();
          }
        });
      }
      if (!this.welcomeAboard) {
        this.welcomeAboard = new Audio(assetPath('audio/welcome-aboard.mp3'));
        this.welcomeAboard.crossOrigin = 'anonymous';
        this.welcomeAboard.preload = 'auto';
        
        // Listen to timeupdate to trigger fade out before the very end of Welcome Aboard
        this.welcomeAboard.addEventListener('timeupdate', () => {
          const duration = this.welcomeAboard.duration;
          const currentTime = this.welcomeAboard.currentTime;
          if (duration && (duration - currentTime <= 1.5) && !this.isFadingOut && !this.isMuted) {
            this.isFadingOut = true;
            this.fadeAudio(this.welcomeAboard, this.welcomeAboard.volume, 0, 1500, () => {
              this.welcomeAboard.pause();
              this.finishSequence();
            });
          }
        });

        // Backup ended listener
        this.welcomeAboard.addEventListener('ended', () => {
          if (this.onWelcomeEnded && !this.isFadingOut && !this.isMuted) {
            this.finishSequence();
          }
        });
      }

      // Route Welcome Aboard through Web Audio gain node for high-fidelity amplification
      if (this.ctx && !this.welcomeGainNode && this.welcomeAboard) {
        try {
          this.welcomeSource = this.ctx.createMediaElementSource(this.welcomeAboard);
          this.welcomeGainNode = this.ctx.createGain();
          this.welcomeGainNode.gain.setValueAtTime(1.8, this.ctx.currentTime); // Modest boost; 3.5x clipped audibly on full-scale sources
          this.welcomeSource.connect(this.welcomeGainNode);
          this.welcomeGainNode.connect(this.ctx.destination);
        } catch (err) {
          console.error("Web Audio routing failed for Welcome Aboard", err);
        }
      }
    } catch (err) {
      console.error("Failed to initialize HTML5 Audio elements", err);
    }
  }

  playSwitchClick() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.015);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) { }
  }

  startHum() {
    if (!this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.humNode) return;

      const now = this.ctx.currentTime;

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(55, now);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(110, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(7.5, now);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.03, now);

      const gainHum = this.ctx.createGain();
      gainHum.gain.setValueAtTime(0.04, now); // Softened from 0.1 to keep voice dominant and prevent cluttering frequencies

      lfo.connect(lfoGain);
      lfoGain.connect(gainHum.gain);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainHum);
      gainHum.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);

      this.humNode = { osc1, osc2, lfo, gain: gainHum };
    } catch (e) {
      console.error("Failed to start engine hum", e);
    }
  }

  stopHum(immediate = false) {
    if (this.humNode) {
      try {
        const { osc1, osc2, lfo, gain } = this.humNode;
        if (this.ctx) {
          if (immediate) {
            try {
              gain.gain.setValueAtTime(0, this.ctx.currentTime);
              osc1.stop();
              osc2.stop();
              lfo.stop();
            } catch (err) { }
          } else {
            const now = this.ctx.currentTime;
            osc1.frequency.exponentialRampToValueAtTime(20, now + 0.8);
            osc2.frequency.exponentialRampToValueAtTime(40, now + 0.8);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            setTimeout(() => {
              try {
                osc1.stop();
                osc2.stop();
                lfo.stop();
              } catch (err) { }
            }, 900);
          }
        }
      } catch (e) { }
      this.humNode = null;
    }
  }

  playChime() {
    if (!this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;

      const oscDing = this.ctx.createOscillator();
      const subDing = this.ctx.createOscillator();
      const gainDing = this.ctx.createGain();

      oscDing.type = 'triangle';
      oscDing.frequency.setValueAtTime(830.61, now);
      subDing.type = 'sine';
      subDing.frequency.setValueAtTime(415.3, now);

      gainDing.gain.setValueAtTime(0.18, now);
      gainDing.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      oscDing.connect(gainDing);
      subDing.connect(gainDing);
      gainDing.connect(this.ctx.destination);

      oscDing.start(now);
      subDing.start(now);
      oscDing.stop(now + 0.5);
      subDing.stop(now + 0.5);

      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        try {
          const nowDong = this.ctx.currentTime;
          const oscDong = this.ctx.createOscillator();
          const subDong = this.ctx.createOscillator();
          const gainDong = this.ctx.createGain();

          oscDong.type = 'triangle';
          oscDong.frequency.setValueAtTime(659.25, nowDong);
          subDong.type = 'sine';
          subDong.frequency.setValueAtTime(329.63, nowDong);

          gainDong.gain.setValueAtTime(0.18, nowDong);
          gainDong.gain.exponentialRampToValueAtTime(0.001, nowDong + 0.55);

          oscDong.connect(gainDong);
          subDong.connect(gainDong);
          gainDong.connect(this.ctx.destination);

          oscDong.start(nowDong);
          subDong.start(nowDong);
          oscDong.stop(nowDong + 0.6);
          subDong.stop(nowDong + 0.6);
        } catch (err) { }
      }, 380);

    } catch (e) {
      console.error("Failed to play doors closing chime", e);
    }
  }

  playSequence() {
    if (this.isMuted) return;
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.stopSequence();
    this.hasCompletedSequence = false;
    this.welcomeStarted = false;
    this.scheduleSequenceFallback();
    if (this.ctaDing) {
      this.ctaDing.volume = 0.45; // Reduced chime volume slightly so the voice shines and commands attention
      this.ctaDing.currentTime = 0;
      this.ctaDing.play().catch(err => {
        console.warn("Failed to play CTA Ding:", err);
        if (!this.isMuted) {
          this.finishSequence();
        }
      });
    } else {
      this.finishSequence();
    }
  }

  playWelcomeAboard() {
    if (this.isMuted || !this.welcomeAboard) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isFadingOut = false;
    this.welcomeAboard.volume = 0.0;
    this.welcomeAboard.currentTime = 0;
    this.welcomeAboard.play().then(() => {
      this.fadeAudio(this.welcomeAboard, 0, 1.0, 800); // 800ms fade-in to full volume (1.0), will be amplified by welcomeGainNode
    }).catch(err => {
      console.warn("Failed to play Welcome Aboard:", err);
      if (!this.isMuted) {
        this.finishSequence();
      }
    });
  }

  scheduleSequenceFallback() {
    this.clearSequenceFallback();
    this.sequenceFallbackTimer = window.setTimeout(() => {
      if (!this.isMuted) {
        this.finishSequence();
      }
    }, AUDIO_SEQUENCE_FALLBACK_MS);
  }

  clearSequenceFallback() {
    if (this.sequenceFallbackTimer) {
      window.clearTimeout(this.sequenceFallbackTimer);
      this.sequenceFallbackTimer = null;
    }
  }

  finishSequence() {
    if (this.hasCompletedSequence) return;
    this.hasCompletedSequence = true;
    this.clearSequenceFallback();
    if (this.onWelcomeEnded) {
      this.onWelcomeEnded();
    }
  }

  fadeAudio(audio, startVol, endVol, durationMs, onComplete) {
    if (!audio) return;
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      audio.volume = startVol + (endVol - startVol) * progress;

      if (progress < 1) {
        audio.fadeFrameId = requestAnimationFrame(tick);
      } else {
        if (onComplete) onComplete();
      }
    };

    if (audio.fadeFrameId) {
      cancelAnimationFrame(audio.fadeFrameId);
    }
    audio.fadeFrameId = requestAnimationFrame(tick);
  }

  fadeOutAndStop(durationMs = 800) {
    const activeAudios = [];
    if (this.ctaDing && !this.ctaDing.paused) activeAudios.push(this.ctaDing);
    if (this.welcomeAboard && !this.welcomeAboard.paused) activeAudios.push(this.welcomeAboard);

    if (activeAudios.length === 0) return;

    activeAudios.forEach(audio => {
      if (audio.fadeFrameId) {
        cancelAnimationFrame(audio.fadeFrameId);
      }

      const startTime = performance.now();
      const startVol = audio.volume;

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        audio.volume = startVol * (1 - progress);

        if (progress < 1) {
          audio.fadeFrameId = requestAnimationFrame(tick);
        } else {
          audio.pause();
          audio.currentTime = 0;
        }
      };
      audio.fadeFrameId = requestAnimationFrame(tick);
    });
  }

  stopSequence() {
    this.clearSequenceFallback();
    if (this.ctaDing) {
      if (this.ctaDing.fadeFrameId) {
        cancelAnimationFrame(this.ctaDing.fadeFrameId);
      }
      this.ctaDing.pause();
      this.ctaDing.currentTime = 0;
    }
    if (this.welcomeAboard) {
      if (this.welcomeAboard.fadeFrameId) {
        cancelAnimationFrame(this.welcomeAboard.fadeFrameId);
      }
      this.welcomeAboard.pause();
      this.welcomeAboard.currentTime = 0;
    }
    this.isFadingOut = false;
    this.welcomeStarted = false;
  }
}

const TrainSplash = () => {
  // Returning visitors already have html.splash-done set by Layout's inline head
  // script; skip straight to 'gone' so no timers, audio, or key handlers attach.
  const [phase, setPhase] = useState(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('splash-done')
      ? 'gone'
      : 'approach'
  ); // 'approach' | 'idle' | 'exit' | 'gone'
  const [isMuted, setIsMuted] = useState(true);
  const [isFastExit, setIsFastExit] = useState(false);
  const [nextStop, setNextStop] = useState('THE PLATFORM');
  const startedAtRef = useRef(0);
  const exitScheduledRef = useRef(false);
  const audioRef = useRef(null);
  const dismissRef = useRef(null);
  const rootRef = useRef(null);
  const exitTimeoutRef = useRef(null);
  const safetyTimeoutRef = useRef(null);
  const audioExitTimeoutRef = useRef(null);
  const isAudioActiveRef = useRef(false);
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
    startedAtRef.current = performance.now();
    document.body.classList.add('splash-active');

    // React is driving the splash now, so cancel the pure-CSS no-JS failsafe
    // (it would otherwise fade the overlay mid-audio at the 9s mark).
    if (rootRef.current) rootRef.current.classList.add('splash-hydrated');

    // Move focus into the dialog so keyboard and screen-reader users interact
    // with the gate instead of the page behind it.
    if (rootRef.current) rootRef.current.focus({ preventScroll: true });

    // Initialize Audio Instance
    const audioInstance = new CTATrainAudio();
    audioInstance.onWelcomeEnded = () => {
      clearAudioExitTimeout();
      isAudioActiveRef.current = false;
      if (dismissRef.current) {
        dismissRef.current(false); // Audio finished naturally: keep the cinematic exit
      }
    };
    audioRef.current = audioInstance;

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

    const approachTimer = window.setTimeout(() => {
      setPhase((p) => (p === 'approach' ? 'idle' : p));
    }, APPROACH_MS);

    const scheduleExit = () => {
      if (exitScheduledRef.current) return;
      if (isAudioActiveRef.current) return; // Keep splash active if audio is playing

      exitScheduledRef.current = true;
      const elapsed = performance.now() - startedAtRef.current;
      const wait = Math.max(0, MIN_DURATION_MS - elapsed);
      
      exitTimeoutRef.current = window.setTimeout(() => {
        if (phaseRef.current === 'exit' || phaseRef.current === 'gone') return;
        setPhase('exit');
        if (audioRef.current) {
          audioRef.current.stopHum();
          audioRef.current.playChime();
        }
        window.setTimeout(finish, EXIT_MS);
      }, wait);
    };

    const onLoad = () => scheduleExit();
    if (document.readyState === 'complete') {
      scheduleExit();
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }
    
    safetyTimeoutRef.current = window.setTimeout(scheduleExit, MAX_DURATION_MS);

    return () => {
      window.clearTimeout(approachTimer);
      if (exitTimeoutRef.current) window.clearTimeout(exitTimeoutRef.current);
      if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current);
      if (audioExitTimeoutRef.current) window.clearTimeout(audioExitTimeoutRef.current);
      window.removeEventListener('load', onLoad);
      document.body.classList.remove('splash-active');
      if (audioRef.current) {
        audioRef.current.stopHum();
        audioRef.current.stopSequence();
      }
    };
  }, []);

  const clearAudioExitTimeout = () => {
    if (audioExitTimeoutRef.current) {
      window.clearTimeout(audioExitTimeoutRef.current);
      audioExitTimeoutRef.current = null;
    }
  };

  // Manual skips (tap, button, Space, B, Escape) exit near-instantly; the
  // automatic timeline keeps the slower cinematic zoom-off.
  const dismiss = (fast = true) => {
    if (phase === 'exit' || phase === 'gone') return;
    clearAudioExitTimeout();
    // Cancel any pending auto-exit so it cannot re-trigger after this dismissal.
    if (exitTimeoutRef.current) {
      window.clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    exitScheduledRef.current = true;
    isAudioActiveRef.current = false;

    setIsFastExit(fast);
    setPhase('exit');
    if (audioRef.current) {
      audioRef.current.stopHum(true); // Cut engine hum immediately
      audioRef.current.stopSequence(); // Cut chimes and voice announcements immediately
    }

    rememberIntroSeen();
    // Unlock page scroll right away on manual skips.
    if (fast) document.body.classList.remove('splash-active');
    window.setTimeout(() => {
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

  const toggleSound = (e) => {
    if (e) {
      e.stopPropagation(); // Prevents tap-to-skip from triggering when clicking Audio Toggle
    }
    if (!audioRef.current) return;
    audioRef.current.init();

    const nextMuted = !isMuted;
    audioRef.current.isMuted = nextMuted;
    setIsMuted(nextMuted);

    audioRef.current.playSwitchClick();

    if (!nextMuted) {
      isAudioActiveRef.current = true;
      clearAudioExitTimeout();
      audioExitTimeoutRef.current = window.setTimeout(() => {
        audioExitTimeoutRef.current = null;
        if (!isAudioActiveRef.current) return;
        isAudioActiveRef.current = false;
        if (dismissRef.current) {
          dismissRef.current(false); // Watchdog exit, not a user action
        }
      }, AUDIO_SEQUENCE_FALLBACK_MS);
      // Clear any pending auto-exit timers so they don't cut off our audio
      if (exitTimeoutRef.current) {
        window.clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      if (safetyTimeoutRef.current) {
        window.clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      if (phase === 'approach' || phase === 'idle') {
        audioRef.current.startHum();
      }
      audioRef.current.playSequence();
    } else {
      clearAudioExitTimeout();
      isAudioActiveRef.current = false;
      audioRef.current.stopHum();
      audioRef.current.stopSequence();
      
      // If we muted it and the page is loaded (or exit was already scheduled), dismiss
      if (document.readyState === 'complete' || exitScheduledRef.current) {
        dismiss();
      }
    }
  };

  if (phase === 'gone') return null;

  const trainAnimClass =
    phase === 'approach'
      ? 'animate-train-approach'
      : phase === 'exit'
        ? isFastExit
          ? 'animate-train-idle'
          : 'animate-train-zoom-off'
        : 'animate-train-idle';

  const isExiting = phase === 'exit';
  const isIdle = phase === 'idle';
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
        transitionTimingFunction: isFastExit ? 'ease-out' : 'cubic-bezier(0.7, 0, 0.84, 0)',
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

      {/* Speed lines (gorgeously flowing down during approach and exit) */}
      <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 ${isIdle ? 'opacity-0' : 'opacity-[0.22]'}`}>
        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-[#642713] animate-speed-line-1" />
        <div className="absolute right-1/4 top-0 bottom-0 w-[2px] bg-[#642713] animate-speed-line-2" />
        <div className="absolute left-10 top-0 bottom-0 w-px bg-[#642713] animate-speed-line-3" />
        <div className="absolute right-12 top-0 bottom-0 w-[1.5px] bg-[#642713] animate-speed-line-4" />
      </div>

      {/* --- Unified Header Row: Next Stop indicator and Audio Switch --- */}
      <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] inset-x-6 z-[10000] flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-3 sm:gap-4 pointer-events-none">

        {/* Dynamic Destination Board Loader Notice */}
        <div
          className={`flex items-center gap-2.5 transition-opacity duration-300 self-center sm:self-start ${phase === 'idle' ? 'opacity-100' : 'opacity-0'
            }`}
          style={{
            fontFamily: "'Montserrat', sans-serif"
          }}
          aria-hidden="true"
        >
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F35A0F] animate-pulse shadow-[0_0_8px_#F35A0F]" />
          <span className="text-[11px] md:text-xs font-bold uppercase tracking-[0.25em] text-[#642713] whitespace-nowrap">
            {`NEXT STOP: ${nextStop}`}
          </span>
        </div>

        {/* Retro Dashboard Audio Toggle & Silent Switch Warning */}
        <div className="flex flex-col items-center sm:items-end pointer-events-auto">
          <button
            onClick={toggleSound}
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border-2 border-[#642713] bg-[#FAF1EC] shadow-[3px_3px_0px_#642713] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#642713] active:translate-y-[2px] active:shadow-[0px_0px_0px_#642713] transition-all duration-100 cursor-pointer"
            title={isMuted ? "Unmute system chimes & traction hum" : "Mute station audio"}
          >
            <div className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isMuted ? 'bg-[#F35A0F]' : 'bg-[#90D393]'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isMuted ? 'bg-[#F35A0F]' : 'bg-[#90D393]'}`} />
            </div>
            <span className="font-mono text-[10px] font-bold tracking-wider text-[#642713] uppercase">
              AUDIO: {isMuted ? 'OFF' : 'ON'}
            </span>
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] stroke-[#642713] fill-none stroke-2" aria-hidden="true">
              {isMuted ? (
                <path d="M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6 M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07 M19.07 4.93a10 10 0 0 1 0 14.14" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>

          {/* iOS silent/vibrate switch hardware hint */}
          {!isMuted && (
            <span className="font-mono text-[8px] text-[#642713]/60 text-center sm:text-right uppercase tracking-wider mt-1.5 select-none pointer-events-none max-w-[150px] leading-tight">
              Muted if phone is on silent
            </span>
          )}
        </div>
      </div>

      {/* --- Elevated Railway Environment ("L" Tracks) --- */}
      <div className="absolute inset-x-0 top-1/2 bottom-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#411b0e" />
              <stop offset="50%" stopColor="#8d3a1f" />
              <stop offset="100%" stopColor="#411b0e" />
            </linearGradient>
          </defs>
          {/* Steel support base frame shadow */}
          <polygon points="45,0 55,0 90,100 10,100" fill="#642713" fillOpacity="0.04" />

          {/* Catwalk platform boundary perspective lines */}
          <line x1="41" y1="0" x2="-35" y2="100" stroke="#642713" strokeWidth="2.5" opacity="0.3" vectorEffect="non-scaling-stroke" />
          <line x1="59" y1="0" x2="135" y2="100" stroke="#642713" strokeWidth="2.5" opacity="0.3" vectorEffect="non-scaling-stroke" />

          {/* Wood platform walk-plank textures */}
          <line x1="43" y1="0" x2="-25" y2="100" stroke="#642713" strokeWidth="1" strokeDasharray="10 5" opacity="0.12" vectorEffect="non-scaling-stroke" />
          <line x1="57" y1="0" x2="125" y2="100" stroke="#642713" strokeWidth="1" strokeDasharray="10 5" opacity="0.12" vectorEffect="non-scaling-stroke" />

          {/* Tracks Bed Wood Girders boundary */}
          <line x1="45" y1="0" x2="-25" y2="100" stroke="#642713" strokeWidth="4" strokeOpacity="0.3" vectorEffect="non-scaling-stroke" />
          <line x1="55" y1="0" x2="125" y2="100" stroke="#642713" strokeWidth="4" strokeOpacity="0.3" vectorEffect="non-scaling-stroke" />

          {/* Main Elevated Steel Rails */}
          <line x1="48.2" y1="0" x2="-2" y2="100" stroke="url(#railGrad)" strokeWidth="6" vectorEffect="non-scaling-stroke" />
          <line x1="51.8" y1="0" x2="102" y2="100" stroke="url(#railGrad)" strokeWidth="6" vectorEffect="non-scaling-stroke" />

          {/* Bright Third Rail representing CTA power delivery */}
          <line x1="44.5" y1="0" x2="-22" y2="100" stroke="#FFBC29" strokeWidth="2.5" opacity="0.8" vectorEffect="non-scaling-stroke" />

          {/* Steel sheen highlights */}
          <line x1="48.5" y1="0" x2="-1.4" y2="100" stroke="#FAF1EC" strokeWidth="1.5" opacity="0.6" vectorEffect="non-scaling-stroke" />
          <line x1="51.5" y1="0" x2="101.4" y2="100" stroke="#FAF1EC" strokeWidth="1.5" opacity="0.6" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Railroad ties (wooden sleepers) scrolling past */}
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className={isExiting ? 'splash-tie-warp' : 'splash-tie'}
            style={{ animationDelay: `${-(i * 1.6) / 9}s` }}
          />
        ))}
      </div>

      {/* --- Detailed CTA Train --- */}
      <div className={`relative z-20 flex flex-col items-center w-full ${trainAnimClass}`}>

        {/* Soft, Blur-Filtered Volumetric Headlight Beams (anchored to the low sealed-beam lamps) */}
        <div className="absolute top-[300px] inset-x-0 w-[400px] h-[300px] mx-auto pointer-events-none overflow-visible hidden sm:block">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" aria-hidden="true">
            <defs>
              <filter id="beamBlur">
                <feGaussianBlur stdDeviation="15" />
              </filter>
              <linearGradient id="beamGlowLeft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFF6DE" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#FFECB8" stopOpacity="0.13" />
                <stop offset="100%" stopColor="#FFECB8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="beamGlowRight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFF6DE" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#FFECB8" stopOpacity="0.13" />
                <stop offset="100%" stopColor="#FFECB8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Volumetric cone glows from the inboard white headlights */}
            <polygon points="124,5 -11,300 229,300" fill="url(#beamGlowLeft)" filter="url(#beamBlur)" className="animate-ambient-glare" />
            <polygon points="276,5 171,300 411,300" fill="url(#beamGlowRight)" filter="url(#beamBlur)" className="animate-ambient-glare" />
          </svg>
        </div>

        {/* Train Illustration SVG: a CTA Brown Line railcar seen head-on, drawn
            from platform reference photos (cars 3323 and 3426 signed for Kimball).
            Key geometry: smooth gray-stainless face, taller than wide; a center
            emergency door with its own window, safety chains, and the car number
            painted on the door; two windshields flanking the door; a small amber
            destination sign top-center with an amber run-number box to its right;
            a row of colored marker lenses along the top; paired round lamps low
            on each side (red taillight outboard, white headlight inboard); ribbed
            anticlimber and coupler at the sill. The front face is smooth; fluting
            lives on the car sides, so none is drawn head-on. */}
        <svg
          viewBox="0 0 400 400"
          className="w-[70vw] sm:w-full sm:max-w-[380px] md:max-w-[400px] max-h-[66vh] drop-shadow-[0_25px_35px_rgba(43,33,24,0.35)] animate-rumble mx-auto"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Brushed stainless, lit from above */}
            <linearGradient id="stainless" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EDF0F2" />
              <stop offset="30%" stopColor="#D9DDE0" />
              <stop offset="70%" stopColor="#C7CCD0" />
              <stop offset="100%" stopColor="#AEB4B9" />
            </linearGradient>
            {/* Horizontal sheen laid over the stainless */}
            <linearGradient id="stainless-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.05" />
              <stop offset="72%" stopColor="#FFFFFF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            {/* Windshield glass */}
            <linearGradient id="glass-reflection" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1C2833" stopOpacity="0.97" />
              <stop offset="35%" stopColor="#2E4053" stopOpacity="0.95" />
              <stop offset="65%" stopColor="#1A5276" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#141C24" stopOpacity="0.97" />
            </linearGradient>
            {/* White sealed-beam headlight */}
            <radialGradient id="sealed-beam" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#FFF7E2" />
              <stop offset="85%" stopColor="#E8DBB8" />
              <stop offset="100%" stopColor="#9C9482" />
            </radialGradient>
            {/* Red marker lamp */}
            <radialGradient id="marker-red" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#FF7B6B" />
              <stop offset="55%" stopColor="#D8342A" />
              <stop offset="100%" stopColor="#7E140F" />
            </radialGradient>
            {/* Continuous stainless fluting: dense horizontal corrugation */}
            <pattern id="fluting" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#D4D9DC" />
              <rect y="0" width="6" height="2" fill="#E9EDEF" />
              <rect y="4" width="6" height="1.6" fill="#A9B0B6" />
            </pattern>
            {/* LED dot matrix for the destination sign */}
            <pattern id="dot-grid" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#0A0C0E" fillOpacity="0.7" />
            </pattern>
          </defs>

          {/* Low-profile roof HVAC, set back so only a sliver shows over the arc */}
          <rect x="146" y="24" width="108" height="14" rx="5" fill="#565D63" />
          <rect x="146" y="24" width="108" height="5" rx="2.5" fill="#6C737A" />

          {/* Shallow smooth roof arc */}
          <path d="M 76 46 Q 200 20 324 46 L 324 52 L 76 52 Z" fill="#C2C8CC" stroke="#2B2118" strokeWidth="3" strokeLinejoin="round" />

          {/* Car face: taller than wide, gentle top shoulders, near-square bottom corners */}
          <path
            d="M 76 60 Q 76 46 90 46 L 310 46 Q 324 46 324 60 L 324 334 Q 324 340 318 340 L 82 340 Q 76 340 76 334 Z"
            fill="url(#stainless)"
          />
          <path
            d="M 76 60 Q 76 46 90 46 L 310 46 Q 324 46 324 60 L 324 334 Q 324 340 318 340 L 82 340 Q 76 340 76 334 Z"
            fill="url(#stainless-sheen)"
          />

          {/* Black window masking band across the upper face */}
          <rect x="88" y="56" width="224" height="98" rx="9" fill="#171B1F" />
          <rect x="88" y="56" width="224" height="98" rx="9" fill="none" stroke="#0C0E10" strokeWidth="1.5" />

          {/* Small amber destination sign, top-center above the door */}
          <rect x="164" y="62" width="72" height="26" rx="3" fill="#08090B" stroke="#2E343A" strokeWidth="1.5" />
          <rect x="166" y="64" width="68" height="22" rx="2" fill="#140F02" />
          <rect x="166" y="64" width="68" height="22" rx="2" fill="url(#dot-grid)" />
          <text
            x="200"
            y="75.5"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFBC29"
            fontFamily="ui-monospace, 'Courier New', Courier, monospace"
            fontSize={nextStop.length > 10 ? '7.5' : '9.5'}
            fontWeight="900"
            textLength={nextStop.length > 10 ? '62' : undefined}
            lengthAdjust="spacingAndGlyphs"
            style={{ letterSpacing: '0.5px', filter: 'drop-shadow(0 0 3px rgba(255,188,41,0.95))' }}
          >
            {nextStop}
          </text>

          {/* Amber run-number box above the right windshield */}
          <rect x="266" y="64" width="34" height="20" rx="2.5" fill="#08090B" stroke="#2E343A" strokeWidth="1.5" />
          <text
            x="283"
            y="74.5"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFBC29"
            fontFamily="ui-monospace, 'Courier New', Courier, monospace"
            fontSize="10"
            fontWeight="900"
            style={{ filter: 'drop-shadow(0 0 2.5px rgba(255,188,41,0.85))' }}
          >
            417
          </text>

          {/* Colored marker lenses along the top of the band */}
          <g>
            <circle cx="106" cy="74" r="4.5" fill="#B6231B" stroke="#33383D" strokeWidth="1.5" />
            <circle cx="121" cy="74" r="4.5" fill="#E8901A" stroke="#33383D" strokeWidth="1.5" />
            <circle cx="136" cy="74" r="4.5" fill="#3E8E4B" stroke="#33383D" strokeWidth="1.5" />
            <circle cx="243" cy="74" r="4.5" fill="#2E5E8F" stroke="#33383D" strokeWidth="1.5" />
            <circle cx="256" cy="74" r="4.5" fill="#B6231B" stroke="#33383D" strokeWidth="1.5" />
          </g>

          {/* Two windshields flanking the center door */}
          <g>
            <rect x="96" y="96" width="68" height="54" rx="3.5" fill="url(#glass-reflection)" stroke="#3A4046" strokeWidth="2" />
            <rect x="236" y="96" width="68" height="54" rx="3.5" fill="url(#glass-reflection)" stroke="#3A4046" strokeWidth="2" />

            {/* Operator silhouette behind the LEFT glass */}
            <g opacity="0.9">
              <circle cx="130" cy="123" r="7.5" fill="#0E1317" />
              <path d="M 117 150 C 117 132, 143 132, 143 150 Z" fill="#0E1317" />
            </g>

            {/* Wiper on the operator's glass, parked at an angle */}
            <line x1="103" y1="148" x2="122" y2="108" stroke="#0B0D0F" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="103" y1="148" x2="108" y2="142" stroke="#0B0D0F" strokeWidth="4" strokeLinecap="round" />

            {/* Glass glare streaks */}
            <path d="M 102 99 L 120 99 L 106 147 L 99 147 Z" fill="#FAF1EC" fillOpacity="0.09" />
            <path d="M 242 99 L 262 99 L 246 147 L 239 147 Z" fill="#FAF1EC" fillOpacity="0.09" />
            <path d="M 288 99 L 298 99 L 290 147 L 284 147 Z" fill="#FAF1EC" fillOpacity="0.05" />
          </g>

          {/* Center emergency door: window in the band, panel continuing below,
              safety chains, and the car number painted on the door */}
          <g>
            {/* Door window, slightly narrower than the windshields */}
            <rect x="182" y="96" width="36" height="54" rx="3" fill="url(#glass-reflection)" stroke="#3A4046" strokeWidth="2" />
            <path d="M 186 99 L 196 99 L 188 147 L 184 147 Z" fill="#FAF1EC" fillOpacity="0.07" />

            {/* Door panel below the band, a shade darker than the face */}
            <rect x="176" y="154" width="48" height="100" fill="#C3C8CC" stroke="#9AA1A7" strokeWidth="1.5" />
            <rect x="180" y="154" width="40" height="100" fill="url(#stainless-sheen)" opacity="0.6" />

            {/* Safety chains slung across the doorway */}
            <path d="M 177 170 Q 200 181 223 170" fill="none" stroke="#4A5158" strokeWidth="2.5" strokeDasharray="3 2.5" strokeLinecap="round" />
            <path d="M 177 184 Q 200 195 223 184" fill="none" stroke="#4A5158" strokeWidth="2.5" strokeDasharray="3 2.5" strokeLinecap="round" />

            {/* Car number on the door */}
            <text
              x="200"
              y="222"
              textAnchor="middle"
              fill="#3B4046"
              fontFamily="'Montserrat', system-ui, sans-serif"
              fontSize="13"
              fontWeight="700"
              style={{ letterSpacing: '2px' }}
            >
              3323
            </text>
          </g>

          {/* Face panel seams (the front is smooth; fluting is only on the sides) */}
          <line x1="79" y1="254" x2="321" y2="254" stroke="#9AA1A7" strokeWidth="1.5" opacity="0.55" />
          <line x1="79" y1="286" x2="321" y2="286" stroke="#9AA1A7" strokeWidth="1" opacity="0.35" />

          {/* Paired round lamps low on each side: red taillight outboard,
              white headlight inboard, each in a metal trim ring */}
          <g>
            <circle cx="101" cy="302" r="9.5" fill="#2E3338" stroke="#4A5158" strokeWidth="1.5" />
            <circle cx="101" cy="302" r="7" fill="url(#marker-red)" stroke="#1E2225" strokeWidth="1.5" />
            <circle cx="124" cy="302" r="9.5" fill="#2E3338" stroke="#4A5158" strokeWidth="1.5" />
            <circle cx="124" cy="302" r="7" fill="url(#sealed-beam)" stroke="#1E2225" strokeWidth="1.5" />

            <circle cx="276" cy="302" r="9.5" fill="#2E3338" stroke="#4A5158" strokeWidth="1.5" />
            <circle cx="276" cy="302" r="7" fill="url(#sealed-beam)" stroke="#1E2225" strokeWidth="1.5" />
            <circle cx="299" cy="302" r="9.5" fill="#2E3338" stroke="#4A5158" strokeWidth="1.5" />
            <circle cx="299" cy="302" r="7" fill="url(#marker-red)" stroke="#1E2225" strokeWidth="1.5" />

            {/* Soft halos on the white headlights only */}
            <circle cx="124" cy="302" r="16" fill="#FFF6DE" fillOpacity="0.3" style={{ filter: 'blur(3px)' }} className="animate-pulse" />
            <circle cx="276" cy="302" r="16" fill="#FFF6DE" fillOpacity="0.3" style={{ filter: 'blur(3px)' }} className="animate-pulse" />
            {/* Dimmer red glow on the taillights */}
            <circle cx="101" cy="302" r="12" fill="#D8342A" fillOpacity="0.22" style={{ filter: 'blur(2.5px)' }} />
            <circle cx="299" cy="302" r="12" fill="#D8342A" fillOpacity="0.22" style={{ filter: 'blur(2.5px)' }} />
          </g>

          {/* Face outline */}
          <path
            d="M 76 60 Q 76 46 90 46 L 310 46 Q 324 46 324 60 L 324 334 Q 324 340 318 340 L 82 340 Q 76 340 76 334 Z"
            fill="none"
            stroke="#2B2118"
            strokeWidth="3.5"
          />

          {/* Full-width ribbed anticlimber across the sill */}
          <rect x="72" y="340" width="256" height="15" rx="2" fill="#1A1E22" stroke="#0D0F11" strokeWidth="1.5" />
          <line x1="74" y1="344.5" x2="326" y2="344.5" stroke="#3D444B" strokeWidth="2" />
          <line x1="74" y1="349.5" x2="326" y2="349.5" stroke="#3D444B" strokeWidth="2" />

          {/* Coupler head with shank and air hoses */}
          <rect x="192" y="355" width="16" height="13" fill="#23272B" stroke="#0D0F11" strokeWidth="1.5" />
          <path d="M 184 368 L 216 368 L 211 381 L 189 381 Z" fill="#1A1E22" stroke="#0D0F11" strokeWidth="1.5" />
          <path d="M 184 357 C 176 366, 174 372, 175 382" fill="none" stroke="#14171A" strokeWidth="3" strokeLinecap="round" />
          <path d="M 216 357 C 224 366, 226 372, 225 382" fill="none" stroke="#14171A" strokeWidth="3" strokeLinecap="round" />
        </svg>

        {/* Dynamic Sparks on Third-Rail Contact Shoes */}
        {(phase === 'approach' || phase === 'exit' || phase === 'idle') && (
          <div className="absolute bottom-8 inset-x-0 w-[320px] mx-auto flex justify-between px-2 pointer-events-none">
            <div className="relative h-6 w-12 flex items-center justify-center">
              <div className="spark spark-1 bg-[#5BC3FF] absolute" style={{ left: '10%', animationDelay: '0.1s' }} />
              <div className="spark spark-2 bg-[#FAF1EC] absolute" style={{ left: '30%', animationDelay: '0.3s' }} />
              <div className="spark spark-3 bg-[#5BC3FF] absolute" style={{ left: '50%', animationDelay: '0.2s' }} />
            </div>
            <div className="relative h-6 w-12 flex items-center justify-center">
              <div className="spark spark-1 bg-[#5BC3FF] absolute" style={{ right: '10%', animationDelay: '0.15s' }} />
              <div className="spark spark-2 bg-[#FAF1EC] absolute" style={{ right: '30%', animationDelay: '0.05s' }} />
              <div className="spark spark-3 bg-[#5BC3FF] absolute" style={{ right: '50%', animationDelay: '0.25s' }} />
            </div>
          </div>
        )}
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

      {/* --- High-end Editorial CSS Animations --- */}
      <style>{`
        /* Fail-safe: the splash normally dismisses via JS (this component
           unmounts well before 9s). But if the script never hydrates (blocked,
           slow, or errored), this pure-CSS animation fades the overlay out and
           drops pointer-events so a visitor is never permanently trapped. It is
           present in the server-rendered HTML, so it works with no JS at all. */
        .train-splash-root {
          animation: splash-failsafe-hide 0.6s ease 9s forwards;
        }
        /* Once React hydrates it owns dismissal (including audio playback that can
           run past 9s), so the failsafe is cancelled. */
        .train-splash-root.splash-hydrated {
          animation: none;
        }
        @keyframes splash-failsafe-hide {
          to { opacity: 0; visibility: hidden; pointer-events: none; }
        }

        /* Elevated sleepers zooming down on perspective plane */
        .splash-tie,
        .splash-tie-warp {
          position: absolute;
          left: 50%;
          background: #2b120a;
          border-radius: 1px;
          border-top: 1px solid #642713;
          pointer-events: none;
          will-change: top, width, height, margin-left, opacity;
        }
        .splash-tie {
          animation: splash-tie-move 1.6s linear infinite;
        }
        .splash-tie-warp {
          animation: splash-tie-move 0.3s linear infinite; /* Increased speeds for snappy exit */
        }
        @keyframes splash-tie-move {
          0%   { top: 0%;   width: 2%;   height: 2px;  margin-left: -1%;  opacity: 0; }
          12%  { opacity: 0.65; }
          100% { top: 100%; width: 130%; height: 26px; margin-left: -65%; opacity: 0.85; }
        }

        /* Speed lines falling down in background overlay */
        @keyframes speed-line {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .animate-speed-line-1 { animation: speed-line 0.8s linear infinite; }
        .animate-speed-line-2 { animation: speed-line 1.2s linear infinite 0.3s; }
        .animate-speed-line-3 { animation: speed-line 0.6s linear infinite 0.1s; }
        .animate-speed-line-4 { animation: speed-line 0.9s linear infinite 0.5s; }

        /* Sparks */
        .spark {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          box-shadow: 0 0 8px #5BC3FF, 0 0 16px #FAF1EC;
          opacity: 0;
          animation: contact-spark 0.28s linear infinite;
          will-change: transform, opacity;
        }
        @keyframes contact-spark {
          0% { transform: translate(0, 0) scale(0.1); opacity: 0; }
          25% { transform: translate(-4px, -4px) scale(1.2); opacity: 0.95; }
          50% { transform: translate(6px, -1px) scale(0.6); opacity: 0.8; }
          75% { transform: translate(-2px, 3px) scale(1); opacity: 0.4; }
          100% { transform: translate(0, 0) scale(0.1); opacity: 0; }
        }

        /* Ambient Headlight vibration cone */
        @keyframes ambient-glare-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.85; }
          50%      { transform: translate(1px, -1px) rotate(0.4deg); opacity: 0.95; }
        }
        .animate-ambient-glare {
          animation: ambient-glare-shake 0.12s ease-in-out infinite;
        }

        /* Train motions */
        @keyframes train-approach {
          0%   { transform: scale(0.04) translateY(-28vh); opacity: 0; filter: blur(10px); }
          25%  { opacity: 1; filter: blur(5px); }
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
          animation: train-idle 2.4s ease-in-out infinite;
          will-change: transform;
        }

        @keyframes train-zoom-off {
          0%   { transform: scale(1) translateY(0); filter: blur(0px); opacity: 1; }
          30%  { transform: scale(1.3) translateY(-1vh); filter: blur(2px); opacity: 1; }
          100% { transform: scale(8) translateY(-18vh); filter: blur(24px); opacity: 0; }
        }
        .animate-train-zoom-off {
          animation: train-zoom-off ${EXIT_MS}ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
          will-change: transform, opacity, filter;
        }

        @keyframes rumble {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25%      { transform: translate(-0.8px, 0.8px) rotate(-0.2deg); }
          50%      { transform: translate(0.8px, -0.8px) rotate(0.2deg); }
          75%      { transform: translate(-0.8px, -0.8px) rotate(0deg); }
        }
        .animate-rumble {
          animation: rumble 0.12s ease-in-out infinite;
          animation-delay: 1.2s;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-train-approach,
          .animate-train-idle,
          .animate-train-zoom-off,
          .animate-rumble,
          .splash-tie,
          .splash-tie-warp,
          .spark,
          .animate-ambient-glare,
          [class*=animate-speed-line] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TrainSplash;
