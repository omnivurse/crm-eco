'use client';

import { useState, useEffect, useMemo } from 'react';

function TwoPathsScene() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Generate random positions only after mount to avoid hydration mismatch
  const stars = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 50,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 3,
    }));
  }, [mounted]);

  const embers = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 35,
      delay: Math.random() * 7,
      duration: 3 + Math.random() * 4,
      size: 2 + Math.random() * 4,
    }));
  }, [mounted]);

  const sparkles = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: 60 + Math.random() * 35,
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 3,
      size: 2 + Math.random() * 3,
    }));
  }, [mounted]);

  const rays = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      rotation: i * 45,
    }));
  }, [mounted]);

  return (
    <div
      className="two-paths-scene relative w-full h-full overflow-hidden"
      aria-hidden="true"
    >
      {/* Sky gradient */}
      <div className="two-paths-sky absolute inset-0" />

      {/* Stars */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="two-paths-twinkle absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}

      {/* SVG Landscape */}
      <svg
        className="absolute bottom-0 left-0 w-full h-[70%]"
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        {/* Mountains silhouette */}
        <path
          d="M0 350 L80 200 L160 300 L250 150 L340 280 L400 180 L460 260 L540 120 L620 240 L700 160 L800 300 L800 500 L0 500Z"
          fill="#1a1a2e"
          opacity="0.7"
        />
        <path
          d="M0 380 L100 280 L200 340 L300 250 L400 320 L500 230 L600 310 L700 260 L800 350 L800 500 L0 500Z"
          fill="#16213e"
          opacity="0.8"
        />

        {/* Ground */}
        <rect x="0" y="400" width="800" height="100" fill="#0f0f1a" />

        {/* Left road (broad, going to destruction) */}
        <path
          d="M200 500 L180 480 L140 440 L100 400 L60 360 L30 320"
          stroke="#3a3a3a"
          strokeWidth="40"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M200 500 L180 480 L140 440 L100 400 L60 360 L30 320"
          stroke="#555"
          strokeWidth="2"
          strokeDasharray="8 12"
          opacity="0.4"
        />

        {/* Right road (narrow, going to the gate) */}
        <path
          d="M500 500 L520 470 L560 430 L600 380 L640 330 L670 280 L690 230"
          stroke="#4a4a2a"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M500 500 L520 470 L560 430 L600 380 L640 330 L670 280 L690 230"
          stroke="#c9a84c"
          strokeWidth="1"
          strokeDasharray="4 8"
          opacity="0.5"
        />

        {/* Left side: city buildings silhouette */}
        <rect x="20" y="300" width="30" height="100" fill="#1a1a2e" />
        <rect x="55" y="320" width="25" height="80" fill="#1a1a2e" />
        <rect x="85" y="280" width="35" height="120" fill="#1a1a2e" />
        <rect x="125" y="310" width="20" height="90" fill="#1a1a2e" />
        <rect x="150" y="290" width="28" height="110" fill="#1a1a2e" />

        {/* Building windows (faint) */}
        <rect x="30" y="310" width="4" height="4" fill="#ff6b6b" opacity="0.4" />
        <rect x="36" y="310" width="4" height="4" fill="#ffa500" opacity="0.3" />
        <rect x="30" y="320" width="4" height="4" fill="#ff6b6b" opacity="0.3" />
        <rect x="36" y="330" width="4" height="4" fill="#ffa500" opacity="0.4" />
        <rect x="95" y="290" width="4" height="4" fill="#ff6b6b" opacity="0.4" />
        <rect x="105" y="290" width="4" height="4" fill="#ffa500" opacity="0.3" />
        <rect x="95" y="300" width="4" height="4" fill="#ff6b6b" opacity="0.3" />
        <rect x="105" y="310" width="4" height="4" fill="#ffa500" opacity="0.4" />
        <rect x="155" y="300" width="4" height="4" fill="#ff6b6b" opacity="0.4" />
        <rect x="165" y="300" width="4" height="4" fill="#ffa500" opacity="0.3" />
        <rect x="155" y="310" width="4" height="4" fill="#ff6b6b" opacity="0.3" />
        <rect x="165" y="320" width="4" height="4" fill="#ffa500" opacity="0.4" />

        {/* Right side: trees */}
        <g opacity="0.7">
          {/* Tree 1 */}
          <rect x="620" y="360" width="6" height="40" fill="#3d2b1f" />
          <ellipse cx="623" cy="345" rx="18" ry="25" fill="#1a3a1a" />
          {/* Tree 2 */}
          <rect x="660" y="340" width="5" height="35" fill="#3d2b1f" />
          <ellipse cx="662" cy="325" rx="15" ry="22" fill="#1a4a1a" />
          {/* Tree 3 */}
          <rect x="700" y="330" width="6" height="40" fill="#3d2b1f" />
          <ellipse cx="703" cy="315" rx="20" ry="28" fill="#1a3a1a" />
          {/* Tree 4 */}
          <rect x="740" y="350" width="5" height="30" fill="#3d2b1f" />
          <ellipse cx="742" cy="338" rx="14" ry="20" fill="#1a4a1a" />
        </g>

        {/* Golden Gate arch (top-right area) */}
        <g className="two-paths-gate-glow">
          {/* Gate pillars */}
          <rect x="670" y="170" width="10" height="80" fill="#c9a84c" opacity="0.8" />
          <rect x="720" y="170" width="10" height="80" fill="#c9a84c" opacity="0.8" />
          {/* Gate arch */}
          <path
            d="M670 175 Q695 120 730 175"
            stroke="#c9a84c"
            strokeWidth="8"
            fill="none"
            opacity="0.9"
          />
          {/* Gate inner glow */}
          <path
            d="M675 250 Q695 160 725 250"
            fill="url(#gateGlow)"
            opacity="0.4"
          />
          {/* Gate decorative cross */}
          <line x1="700" y1="135" x2="700" y2="155" stroke="#ffd700" strokeWidth="3" opacity="0.7" />
          <line x1="690" y1="145" x2="710" y2="145" stroke="#ffd700" strokeWidth="3" opacity="0.7" />
        </g>

        {/* Gradient definitions */}
        <defs>
          <radialGradient id="gateGlow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ffd700" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Neon signs (left side) */}
      <div
        className="two-paths-neon-flicker absolute text-red-500 font-bold text-sm tracking-widest"
        style={{ left: '8%', top: '52%', textShadow: '0 0 10px #ff4444, 0 0 20px #ff4444, 0 0 40px #ff0000' }}
      >
        CASINO
      </div>
      <div
        className="two-paths-neon-flicker-alt absolute text-orange-400 font-bold text-xs tracking-widest"
        style={{ left: '15%', top: '56%', textShadow: '0 0 8px #ff8800, 0 0 16px #ff6600, 0 0 30px #ff4400' }}
      >
        BAR
      </div>

      {/* Ember particles (left side, rising) */}
      {embers.map((ember) => (
        <div
          key={`ember-${ember.id}`}
          className="two-paths-ember-rise absolute rounded-full"
          style={{
            left: `${ember.left}%`,
            bottom: '20%',
            width: ember.size,
            height: ember.size,
            animationDelay: `${ember.delay}s`,
            animationDuration: `${ember.duration}s`,
            background: `radial-gradient(circle, #ff6b35, #ff4500)`,
            boxShadow: '0 0 6px 2px rgba(255,69,0,0.5)',
          }}
        />
      ))}

      {/* Golden sparkles (right side, floating) */}
      {sparkles.map((sparkle) => (
        <div
          key={`sparkle-${sparkle.id}`}
          className="two-paths-sparkle-float absolute rounded-full"
          style={{
            left: `${sparkle.left}%`,
            bottom: '30%',
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: `${sparkle.delay}s`,
            animationDuration: `${sparkle.duration}s`,
            background: `radial-gradient(circle, #ffd700, #fff8dc)`,
            boxShadow: '0 0 8px 3px rgba(255,215,0,0.4)',
          }}
        />
      ))}

      {/* Light rays around the gate */}
      <div
        className="two-paths-rays-rotate absolute"
        style={{
          right: '5%',
          top: '15%',
          width: 200,
          height: 200,
          transformOrigin: 'center center',
        }}
      >
        {rays.map((ray) => (
          <div
            key={`ray-${ray.id}`}
            className="absolute left-1/2 top-1/2"
            style={{
              width: 2,
              height: 100,
              background: 'linear-gradient(to bottom, rgba(255,215,0,0.3), transparent)',
              transformOrigin: 'top center',
              transform: `rotate(${ray.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* Tagline */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/30 text-sm tracking-[0.3em] uppercase font-light">
          Choose your path wisely
        </p>
      </div>
    </div>
  );
}

export default TwoPathsScene;
