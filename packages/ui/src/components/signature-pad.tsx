'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';

export interface SignaturePadProps {
  onSignatureChange?: (dataUrl: string | null) => void;
  onSave?: (dataUrl: string) => void;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
  className?: string;
  showControls?: boolean;
  label?: string;
}

export function SignaturePad({
  onSignatureChange,
  onSave,
  width = 500,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  disabled = false,
  className,
  showControls = true,
  label = 'Sign here',
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasSignature, setHasSignature] = React.useState(false);
  const [canvasSize, setCanvasSize] = React.useState({ width, height });

  // Handle responsive sizing
  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newWidth = Math.min(width, containerWidth - 2);
        setCanvasSize({
          width: newWidth,
          height: Math.round((newWidth / width) * height),
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [width, height]);

  // Initialize canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set line style
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [canvasSize, backgroundColor, penColor]);

  const getEventPosition = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    e.preventDefault();
    setIsDrawing(true);

    const { x, y } = getEventPosition(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    e.preventDefault();
    const { x, y } = getEventPosition(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    if (!hasSignature) {
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange?.(dataUrl);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = penColor;

    setHasSignature(false);
    onSignatureChange?.(null);
  };

  const saveSignature = () => {
    if (!hasSignature) return;

    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave?.(dataUrl);
    }
  };

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg overflow-hidden',
          disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white',
          !disabled && 'cursor-crosshair'
        )}
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />
      </div>
      {!hasSignature && !disabled && (
        <p className="text-xs text-gray-500 mt-1 text-center">
          Draw your signature above
        </p>
      )}
      {showControls && (
        <div className="flex gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSignature}
            disabled={disabled || !hasSignature}
          >
            Clear
          </Button>
          {onSave && (
            <Button
              type="button"
              size="sm"
              onClick={saveSignature}
              disabled={disabled || !hasSignature}
            >
              Accept Signature
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Display a saved signature
 */
export interface SignatureDisplayProps {
  signatureData: string;
  className?: string;
  label?: string;
}

export function SignatureDisplay({
  signatureData,
  className,
  label = 'Signature',
}: SignatureDisplayProps) {
  return (
    <div className={cn('', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="border rounded-lg p-2 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signatureData}
          alt="Signature"
          className="max-w-full h-auto"
        />
      </div>
    </div>
  );
}
