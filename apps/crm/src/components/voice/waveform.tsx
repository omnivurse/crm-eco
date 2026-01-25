'use client';

// Waveform Visualization Component
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface WaveformProps {
  isActive: boolean;
  barCount?: number;
  color?: string;
  activeColor?: string;
}

export function Waveform({
  isActive,
  barCount = 32,
  color = 'rgba(100, 116, 139, 0.3)',
  activeColor = 'rgba(20, 184, 166, 0.8)',
}: WaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(0.1));
  const animationRef = useRef<number>();
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isActive) {
      // Reset bars when not active
      setBars(Array(barCount).fill(0.1));

      // Clean up audio context and stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    // Create audio context and analyzer for real visualization
    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyzer = audioContext.createAnalyser();

        analyzer.fftSize = barCount * 4;
        analyzer.smoothingTimeConstant = 0.7;

        source.connect(analyzer);
        analyzerRef.current = analyzer;
        dataArrayRef.current = new Uint8Array(analyzer.frequencyBinCount) as Uint8Array<ArrayBuffer>;

        const animate = () => {
          if (!analyzerRef.current || !dataArrayRef.current) return;

          analyzerRef.current.getByteFrequencyData(dataArrayRef.current);

          const newBars: number[] = [];
          const step = Math.floor(dataArrayRef.current.length / barCount);

          for (let i = 0; i < barCount; i++) {
            const index = i * step;
            const value = dataArrayRef.current[index] / 255;
            // Apply some smoothing and minimum height
            newBars.push(Math.max(0.1, value * 0.9 + 0.1));
          }

          setBars(newBars);
          animationRef.current = requestAnimationFrame(animate);
        };

        animate();
      } catch (error) {
        // Fall back to simulated animation if mic access fails
        simulateWaveform();
      }
    };

    // Simulated waveform animation as fallback
    const simulateWaveform = () => {
      const animate = () => {
        setBars(prev => prev.map((_, i) => {
          // Create a wave-like pattern
          const time = Date.now() / 100;
          const wave = Math.sin(time + i * 0.3) * 0.3 + 0.5;
          const noise = Math.random() * 0.2;
          return Math.max(0.15, Math.min(1, wave + noise));
        }));
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    };

    setupAudio();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, barCount]);

  return (
    <div className="waveform-container">
      <div className="waveform">
        {bars.map((height, i) => (
          <motion.div
            key={i}
            className="waveform-bar"
            animate={{
              scaleY: isActive ? height : 0.1,
              backgroundColor: isActive ? activeColor : color,
            }}
            transition={{
              scaleY: { duration: 0.1, ease: 'easeOut' },
              backgroundColor: { duration: 0.3 },
            }}
            style={{
              transformOrigin: 'center',
            }}
          />
        ))}
      </div>

      {/* Glow effect when active */}
      {isActive && (
        <div className="waveform-glow" />
      )}
    </div>
  );
}

// Simplified version without audio analysis
export function SimpleWaveform({ isActive }: { isActive: boolean }) {
  const barCount = 5;

  return (
    <div className="simple-waveform">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className="simple-waveform-bar"
          animate={{
            scaleY: isActive ? [0.3, 1, 0.3] : 0.3,
          }}
          transition={{
            duration: 0.6,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export default Waveform;
