'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface DemoStep {
  title: string;
  description: string;
  highlight?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cursor?: {
    x: number;
    y: number;
  };
  action?: 'click' | 'type' | 'scroll' | 'hover';
  duration?: number;
}

interface AnimatedDemoProps {
  title: string;
  steps: DemoStep[];
  imageSrc?: string;
  videoSrc?: string;
  className?: string;
}

export function AnimatedDemo({
  title,
  steps,
  imageSrc,
  videoSrc,
  className,
}: AnimatedDemoProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });
  const [isClicking, setIsClicking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const step = steps[currentStep];

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, step?.duration || 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, currentStep, steps.length, step?.duration]);

  useEffect(() => {
    if (step?.cursor) {
      // Animate cursor to new position
      setCursorPosition(step.cursor);

      // Simulate click action
      if (step.action === 'click') {
        setTimeout(() => {
          setIsClicking(true);
          setTimeout(() => setIsClicking(false), 200);
        }, 500);
      }
    }
  }, [step]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    setCursorPosition({ x: 50, y: 50 });
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className={cn('rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700', className)}>
      {/* Demo Area */}
      <div className="relative bg-slate-900 aspect-video">
        {/* Background Image/Video */}
        {videoSrc ? (
          <video
            src={videoSrc}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            loop
            playsInline
          />
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* Placeholder Demo Screen */
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 p-6">
            <div className="h-full flex flex-col">
              {/* Mock Browser Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 bg-slate-700 rounded-full h-6 flex items-center px-3">
                  <span className="text-xs text-slate-400">crm.example.com</span>
                </div>
              </div>

              {/* Mock CRM Interface */}
              <div className="flex-1 bg-slate-800 rounded-lg overflow-hidden">
                <div className="h-10 bg-slate-700 flex items-center px-4 gap-4">
                  <div className="w-20 h-4 bg-teal-500 rounded animate-pulse" />
                  <div className="flex gap-3">
                    {['Contacts', 'Leads', 'Deals', 'Campaigns'].map((item, i) => (
                      <div key={i} className="w-16 h-3 bg-slate-600 rounded" />
                    ))}
                  </div>
                </div>
                <div className="p-4 grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-slate-700 rounded-lg p-3 space-y-2">
                      <div className="w-full h-3 bg-slate-600 rounded" />
                      <div className="w-3/4 h-2 bg-slate-600 rounded" />
                      <div className="w-1/2 h-2 bg-slate-600 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Highlight Overlay */}
        {step?.highlight && (
          <div
            className="absolute border-2 border-teal-400 rounded-lg transition-all duration-500 ease-out"
            style={{
              left: `${step.highlight.x}%`,
              top: `${step.highlight.y}%`,
              width: `${step.highlight.width}%`,
              height: `${step.highlight.height}%`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 20px rgba(45, 212, 191, 0.5)',
            }}
          >
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-400 rounded-full animate-ping" />
          </div>
        )}

        {/* Animated Cursor */}
        <div
          className={cn(
            'absolute w-6 h-6 transition-all duration-500 ease-out pointer-events-none z-10',
            isClicking && 'scale-75'
          )}
          style={{
            left: `${cursorPosition.x}%`,
            top: `${cursorPosition.y}%`,
            transform: 'translate(-10%, -10%)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full drop-shadow-lg">
            <path
              d="M5.5 3.21V20.79C5.5 21.56 6.41 21.99 7.01 21.47L10.77 18.13L14.46 22.22C14.85 22.66 15.52 22.66 15.91 22.22L17.39 20.53C17.78 20.09 17.78 19.42 17.39 18.98L13.7 14.89L18.69 14.04C19.51 13.91 19.84 12.94 19.26 12.36L7.26 0.36C6.68 -0.22 5.71 0.11 5.58 0.93L5.5 3.21Z"
              fill="white"
              stroke="black"
              strokeWidth="1"
            />
          </svg>
          {isClicking && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-teal-400/30 animate-ping" />
            </div>
          )}
        </div>

        {/* Step Progress */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-1">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={cn(
                'h-1 flex-1 rounded-full transition-all',
                index === currentStep
                  ? 'bg-teal-400'
                  : index < currentStep
                    ? 'bg-teal-400/50'
                    : 'bg-white/20'
              )}
            />
          ))}
        </div>
      </div>

      {/* Controls & Description */}
      <div className="bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePlayPause}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
              disabled={currentStep === steps.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm text-slate-500">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="font-semibold text-slate-900 dark:text-white">
            {step?.title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {step?.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Interactive Feature Card with hover animation
export function FeatureCard({
  icon,
  title,
  description,
  href,
  color = 'teal',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color?: 'teal' | 'violet' | 'blue' | 'amber' | 'emerald' | 'rose';
}) {
  const colorClasses = {
    teal: 'from-teal-500 to-emerald-500 group-hover:from-teal-400 group-hover:to-emerald-400',
    violet: 'from-violet-500 to-purple-500 group-hover:from-violet-400 group-hover:to-purple-400',
    blue: 'from-blue-500 to-cyan-500 group-hover:from-blue-400 group-hover:to-cyan-400',
    amber: 'from-amber-500 to-orange-500 group-hover:from-amber-400 group-hover:to-orange-400',
    emerald: 'from-emerald-500 to-green-500 group-hover:from-emerald-400 group-hover:to-green-400',
    rose: 'from-rose-500 to-pink-500 group-hover:from-rose-400 group-hover:to-pink-400',
  };

  return (
    <a
      href={href}
      className="group block p-6 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:shadow-lg hover:-translate-y-1"
    >
      <div className={cn(
        'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-4 transition-transform group-hover:scale-110',
        colorClasses[color]
      )}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
        {title}
      </h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm">
        {description}
      </p>
    </a>
  );
}

// Animated Step List
export function StepList({
  steps,
}: {
  steps: { title: string; description: string }[];
}) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div
          key={index}
          className="flex gap-4 animate-fade-in-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
            {index + 1}
          </div>
          <div className="flex-1 pb-4 border-b border-slate-200 dark:border-slate-700 last:border-0">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
              {step.title}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Quick Tip Component
export function QuickTip({
  title,
  children,
  type = 'tip',
}: {
  title: string;
  children: React.ReactNode;
  type?: 'tip' | 'warning' | 'info';
}) {
  const styles = {
    tip: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300',
    info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300',
  };

  const icons = {
    tip: '💡',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className={cn('p-4 rounded-xl border', styles[type])}>
      <div className="flex items-center gap-2 font-semibold mb-2">
        <span>{icons[type]}</span>
        {title}
      </div>
      <div className="text-sm opacity-90">
        {children}
      </div>
    </div>
  );
}
