import React, { useEffect, useRef, useState } from 'react';

const APPROACH_MS = 1800;
const MIN_DURATION_MS = 2500; // Slightly longer to enjoy the animation
const MAX_DURATION_MS = 6000;
const EXIT_MS = 900; // Snappy, dynamic exit transition

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
        this.ctaDing = new Audio('/audio/CTA Ding.mov');
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
        this.welcomeAboard = new Audio('/audio/Welcome Aboard.mov');
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
              if (this.onWelcomeEnded) {
                this.onWelcomeEnded();
              }
            });
          }
        });

        // Backup ended listener
        this.welcomeAboard.addEventListener('ended', () => {
          if (this.onWelcomeEnded && !this.isFadingOut && !this.isMuted) {
            this.onWelcomeEnded();
          }
        });
      }

      // Route Welcome Aboard through Web Audio gain node for high-fidelity amplification
      if (this.ctx && !this.welcomeGainNode && this.welcomeAboard) {
        try {
          this.welcomeSource = this.ctx.createMediaElementSource(this.welcomeAboard);
          this.welcomeGainNode = this.ctx.createGain();
          this.welcomeGainNode.gain.setValueAtTime(3.5, this.ctx.currentTime); // High volume boost (+10.8dB) to make voice crystal clear and extremely rich
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
    this.welcomeStarted = false;
    if (this.ctaDing) {
      this.ctaDing.volume = 0.45; // Reduced chime volume slightly so the voice shines and commands attention
      this.ctaDing.currentTime = 0;
      this.ctaDing.play().catch(err => console.warn("Failed to play CTA Ding:", err));
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
    }).catch(err => console.warn("Failed to play Welcome Aboard:", err));
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
  const [phase, setPhase] = useState('approach'); // 'approach' | 'idle' | 'exit' | 'gone'
  const [isMuted, setIsMuted] = useState(true);
  const [nextStop, setNextStop] = useState('THE PLATFORM');
  const startedAtRef = useRef(0);
  const exitScheduledRef = useRef(false);
  const audioRef = useRef(null);
  const dismissRef = useRef(null);
  const exitTimeoutRef = useRef(null);
  const safetyTimeoutRef = useRef(null);
  const isAudioActiveRef = useRef(false);

  // Universal next stop path detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();

      if (path.includes('about')) {
        setNextStop('ABOUT THE LINE');
      } else if (path.includes('links')) {
        setNextStop('THE DIRECTORY');
      } else if (path.includes('standards')) {
        setNextStop('EDITORIAL STANDARDS');
      } else if (path === '/' || path === '/index.html' || path.endsWith('/')) {
        setNextStop('HOME PLATFORM');
      } else {
        const segments = path.split('/').filter(Boolean);
        if (segments.length > 0) {
          let lastSegment = segments[segments.length - 1];
          if (lastSegment === 'index.html' && segments.length > 1) {
            lastSegment = segments[segments.length - 2];
          }
          const cleanName = lastSegment.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ').toUpperCase();
          setNextStop(cleanName || 'THE PLATFORM');
        } else {
          setNextStop('THE PLATFORM');
        }
      }
    }
  }, []);

  useEffect(() => {
    startedAtRef.current = performance.now();
    document.body.classList.add('splash-active');

    // Initialize Audio Instance
    const audioInstance = new CTATrainAudio();
    audioInstance.onWelcomeEnded = () => {
      if (dismissRef.current) {
        dismissRef.current();
      }
    };
    audioRef.current = audioInstance;

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
      if (isAudioActiveRef.current) return; // Keep splash active if audio is playing

      exitScheduledRef.current = true;
      const elapsed = performance.now() - startedAtRef.current;
      const wait = Math.max(0, MIN_DURATION_MS - elapsed);
      
      exitTimeoutRef.current = window.setTimeout(() => {
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
      window.removeEventListener('load', onLoad);
      document.body.classList.remove('splash-active');
      if (audioRef.current) {
        audioRef.current.stopHum();
        audioRef.current.stopSequence();
      }
    };
  }, []);

  const dismiss = () => {
    if (phase === 'exit' || phase === 'gone') return;
    exitScheduledRef.current = true;

    setPhase('exit');
    if (audioRef.current) {
      audioRef.current.stopHum(true); // Cut engine hum immediately
      audioRef.current.stopSequence(); // Cut chimes and voice announcements immediately
    }

    window.setTimeout(() => {
      document.documentElement.classList.add('splash-done');
      document.body.classList.remove('splash-active');
      setPhase('gone');
    }, EXIT_MS);
  };

  // Keep a mutable ref of dismiss for the keyboard listener to prevent closure staleness
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  // Listen for Space Bar shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent standard browser space-scrolling
        if (dismissRef.current) {
          dismissRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
        ? 'animate-train-zoom-off'
        : 'animate-train-idle';

  const isExiting = phase === 'exit';
  const isIdle = phase === 'idle';

  return (
    <div
      onClick={dismiss}
      className={`train-splash-root fixed inset-0 z-[9999] bg-[#FAF1EC] flex flex-col items-center justify-center overflow-hidden px-6 transition-opacity cursor-pointer ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
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
            fontFamily: "'JT Modernism', 'Montserrat', sans-serif"
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
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 stroke-[#642713] fill-none stroke-2" aria-hidden="true">
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

        {/* Soft, Blur-Filtered Volumetric Headlight Beams */}
        <div className="absolute top-[280px] inset-x-0 w-[400px] h-[300px] mx-auto pointer-events-none overflow-visible hidden sm:block">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" aria-hidden="true">
            <defs>
              <filter id="beamBlur">
                <feGaussianBlur stdDeviation="15" />
              </filter>
              <linearGradient id="beamGlowLeft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFBC29" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#FFBC29" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#FFBC29" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="beamGlowRight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFBC29" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#FFBC29" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#FFBC29" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Volumetric cone glows */}
            <polygon points="105,5 -30,300 210,300" fill="url(#beamGlowLeft)" filter="url(#beamBlur)" className="animate-ambient-glare" />
            <polygon points="295,5 190,300 430,300" fill="url(#beamGlowRight)" filter="url(#beamBlur)" className="animate-ambient-glare" />
          </svg>
        </div>

        {/* Train Illustration SVG */}
        <svg
          viewBox="0 0 400 400"
          className="w-[82vw] sm:w-full sm:max-w-[420px] md:max-w-[460px] max-h-[66vh] drop-shadow-[0_25px_35px_rgba(100,39,19,0.35)] animate-rumble mx-auto"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Train body clip pattern to curve the bumper plates beautifully */}
            <clipPath id="trainBodyClip">
              <rect x="50" y="30" width="300" height="315" rx="38" />
            </clipPath>
            {/* Headlight inner bulb glow */}
            <radialGradient id="headlight-lens" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#FFF9E6" />
              <stop offset="75%" stopColor="#FFBC29" />
              <stop offset="100%" stopColor="#D4A017" />
            </radialGradient>
            {/* Metallic Brushed Steel panel shader */}
            <linearGradient id="metal-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#BDC3C7" />
              <stop offset="25%" stopColor="#E2E7EB" />
              <stop offset="50%" stopColor="#D5DBDB" />
              <stop offset="75%" stopColor="#E2E7EB" />
              <stop offset="100%" stopColor="#A6ACAF" />
            </linearGradient>
            {/* Window Glass reflection */}
            <linearGradient id="glass-reflection" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1C2833" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#2E4053" stopOpacity="0.95" />
              <stop offset="65%" stopColor="#1A5276" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1C2833" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Roof AC Unit */}
          <rect x="140" y="8" width="120" height="22" rx="6" fill="#171A1C" />
          <rect x="155" y="4" width="90" height="10" rx="4" fill="#2C3E50" />

          {/* Under-carriage bogie frame coupler */}
          <rect x="110" y="340" width="180" height="30" rx="8" fill="#171A1C" />
          <path d="M 170 350 L 190 380 L 210 380 L 230 350 Z" fill="#2C3E50" stroke="#111" strokeWidth="2" />
          <rect x="70" y="335" width="55" height="15" rx="4" fill="#1C2833" />
          <rect x="275" y="335" width="55" height="15" rx="4" fill="#1C2833" />

          {/* Core Train Body Structure (Stylized Metallic Silver Finish) */}
          <rect x="50" y="30" width="300" height="315" rx="38" fill="url(#metal-sheen)" />

          {/* Fluted corrugations detail lines on steel sides */}
          <line x1="56" y1="265" x2="344" y2="265" stroke="#95A5A6" strokeWidth="2" strokeDasharray="6 2" />
          <line x1="56" y1="271" x2="344" y2="271" stroke="#95A5A6" strokeWidth="2" strokeDasharray="6 2" />
          <line x1="56" y1="277" x2="344" y2="277" stroke="#95A5A6" strokeWidth="2" strokeDasharray="6 2" />
          <line x1="56" y1="318" x2="344" y2="318" stroke="#95A5A6" strokeWidth="2" />

          {/* Iconic CTA Station Marker Board Frame */}
          <rect x="62" y="42" width="276" height="295" rx="26" fill="none" stroke="#642713" strokeWidth="2" strokeOpacity="0.18" />

          {/* Bold Brand Brown Stripe running along the front */}
          <rect x="53" y="200" width="294" height="48" fill="#642713" />
          <line x1="53" y1="200" x2="347" y2="200" stroke="#FAF1EC" strokeWidth="1.5" />
          <line x1="53" y1="248" x2="347" y2="248" stroke="#FAF1EC" strokeWidth="1.5" />

          {/* CTA lowercase retro logo in cream */}
          <circle cx="200" cy="224" r="14" fill="none" stroke="#FAF1EC" strokeWidth="3" />
          <text
            x="200"
            y="228"
            textAnchor="middle"
            fill="#FAF1EC"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="11"
            fontWeight="900"
            letterSpacing="1"
          >
            cta
          </text>

          {/* LED Destination Board Marquee Frame */}
          <rect x="80" y="55" width="240" height="42" rx="8" fill="#111" stroke="#333" strokeWidth="2" />
          <rect x="83" y="58" width="234" height="36" rx="5" fill="#1C1300" />

          {/* Dotted LED marquee matrix pattern overlay */}
          <pattern id="dot-grid" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#111111" fillOpacity="0.75" />
          </pattern>
          <rect x="83" y="58" width="234" height="36" rx="5" fill="url(#dot-grid)" />

          {/* Glowing Destination notice on Matrix LED */}
          <text
            x="200"
            y="76"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFBC29"
            fontFamily="ui-monospace, 'Courier New', Courier, monospace"
            fontSize={nextStop.length > 15 ? "11.5" : "13.5"}
            fontWeight="900"
            textLength={nextStop.length > 15 ? "210" : "185"}
            lengthAdjust="spacingAndGlyphs"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(255,188,41,0.95))',
              letterSpacing: '1px'
            }}
          >
            {`TO ${nextStop}`}
          </text>

          {/* Split cab windows layout with driver silhouette */}
          <rect x="70" y="112" width="76" height="78" rx="8" fill="url(#glass-reflection)" stroke="#424949" strokeWidth="2" />
          <rect x="254" y="112" width="76" height="78" rx="8" fill="url(#glass-reflection)" stroke="#424949" strokeWidth="2" />

          <g>
            <rect x="156" y="112" width="88" height="78" rx="6" fill="url(#glass-reflection)" stroke="#424949" strokeWidth="2" />
            <circle cx="200" cy="145" r="30" fill="#FFBC29" fillOpacity="0.1" style={{ filter: 'blur(5px)' }} />
            <path d="M 190 190 C 190 162, 210 162, 210 190 Z" fill="#11161B" />
            <circle cx="200" cy="155" r="9" fill="#11161B" />
            <rect x="160" y="180" width="80" height="10" rx="2" fill="#0E1317" />
            <circle cx="170" cy="184" r="2" fill="#90D393" />
          </g>

          {/* Windshield Glossy Highlights */}
          <path d="M 76 116 L 115 116 L 85 186 L 76 186 Z" fill="#FAF1EC" fillOpacity="0.08" />
          <path d="M 260 116 L 295 116 L 265 186 L 260 186 Z" fill="#FAF1EC" fillOpacity="0.08" />

          {/* CTA grab rails */}
          <path d="M 62 110 L 62 195" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 338 110 L 338 195" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />

          {/* Bottom Dual Headlights */}
          <g>
            <circle cx="105" cy="285" r="20" fill="#424949" stroke="#5D6D7E" strokeWidth="1.5" />
            <circle cx="105" cy="285" r="15" fill="url(#headlight-lens)" />
            <circle cx="295" cy="285" r="20" fill="#424949" stroke="#5D6D7E" strokeWidth="1.5" />
            <circle cx="295" cy="285" r="15" fill="url(#headlight-lens)" />

            <circle cx="105" cy="285" r="35" fill="#FFBC29" fillOpacity="0.15" style={{ filter: 'blur(3px)' }} className="animate-pulse" />
            <circle cx="295" cy="285" r="35" fill="#FFBC29" fillOpacity="0.15" style={{ filter: 'blur(3px)' }} className="animate-pulse" />
          </g>

          {/* Grille vent */}
          <rect x="160" y="275" width="80" height="22" rx="4" fill="#1B2124" />
          <line x1="170" y1="281" x2="230" y2="281" stroke="#4D5656" strokeWidth="2" />
          <line x1="170" y1="286" x2="230" y2="286" stroke="#4D5656" strokeWidth="2" />
          <line x1="170" y1="291" x2="230" y2="291" stroke="#4D5656" strokeWidth="2" />

          {/* Bold Retro Chicago Bumper Plates (design.md colors) - Clipped beautifully with rounded bottom edges */}
          <g clipPath="url(#trainBodyClip)">
            <rect x="50" y="322" width="300" height="7" fill="#F79CD0" />
            <rect x="50" y="329" width="300" height="7" fill="#5BC3FF" />
            <rect x="50" y="336" width="300" height="7" fill="#90D393" />
            <rect x="50" y="343" width="300" height="7" fill="#FFBC29" />
            <rect x="50" y="350" width="300" height="7" fill="#F35A0F" />
          </g>

          {/* Crisp, overarching outline stroke of the train body drawn on top of the clipped layers */}
          <rect x="50" y="30" width="300" height="315" rx="38" fill="none" stroke="#642713" strokeWidth="6" />
        </svg>

        {/* Dynamic Sparks on Third-Rail Contact Shoes */}
        {(phase === 'approach' || phase === 'exit' || phase === 'idle') && (
          <div className="absolute bottom-8 inset-x-0 w-[420px] mx-auto flex justify-between px-2 pointer-events-none">
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

      {/* Skip affordance: Transit Station Sign with Keyboard space & Mobile Tap screen shortcut */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute left-1/2 -translate-x-1/2 z-30 font-bold text-xs uppercase tracking-widest text-[#FAF1EC] bg-[#642713] border-3 border-[#642713] hover:bg-[#FAF1EC] hover:text-[#642713] active:translate-y-[2px] shadow-[4px_4px_0px_#2B120A] hover:shadow-[2px_2px_0px_#2B120A] active:shadow-[0px_0px_0px_#2B120A] px-5 py-3 rounded-lg min-h-[46px] flex items-center gap-3 transition-all duration-150 select-none cursor-pointer"
        style={{
          bottom: 'max(1.8rem, env(safe-area-inset-bottom))',
          fontFamily: "'JT Modernism', 'Montserrat', sans-serif"
        }}
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#FAF1EC] text-[#642713] font-black text-[10px] tracking-normal">
          B
        </span>
        <span className="whitespace-nowrap">{`Skip to ${nextStop}`}</span>

        {/* Keyboard spacebar badge indicator */}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 ml-2.5 rounded text-[10px] bg-[#FAF1EC]/25 border border-[#FAF1EC]/30 font-mono tracking-normal lowercase opacity-85">
          space
        </span>

        {/* Mobile tap screen badge indicator */}
        <span className="inline-flex sm:hidden items-center gap-1.5 px-2 py-0.5 ml-1 rounded text-[10px] bg-[#FAF1EC]/25 border border-[#FAF1EC]/30 font-mono tracking-normal lowercase opacity-85">
          tap screen
        </span>
      </button>

      {/* --- High-end Editorial CSS Animations --- */}
      <style>{`
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
          [class*="animate-speed-line"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TrainSplash;