'use client';

// Terminal Window - Starship Command Center
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Maximize2, Terminal as TerminalIcon } from 'lucide-react';
import { useTerminal } from './terminal-provider';
import { CommandInput } from './command-input';
import { CommandOutput } from './command-output';
import './terminal.css';

export function TerminalWindow() {
  const { isOpen, close, currentPanel } = useTerminal();
  const windowRef = useRef<HTMLDivElement>(null);

  // Focus trap when terminal is open
  useEffect(() => {
    if (isOpen && windowRef.current) {
      const firstInput = windowRef.current.querySelector('input');
      firstInput?.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when terminal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="terminal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />

          {/* Terminal Window */}
          <motion.div
            ref={windowRef}
            className="terminal-window"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Command Center Terminal"
          >
            {/* Title Bar */}
            <div className="terminal-titlebar">
              <div className="titlebar-left">
                <div className="window-controls">
                  <button
                    className="window-btn close"
                    onClick={close}
                    aria-label="Close terminal"
                  >
                    <X size={10} />
                  </button>
                  <button className="window-btn minimize" aria-label="Minimize">
                    <Minus size={10} />
                  </button>
                  <button className="window-btn maximize" aria-label="Maximize">
                    <Maximize2 size={10} />
                  </button>
                </div>
                <div className="titlebar-title">
                  <TerminalIcon size={14} className="titlebar-icon" />
                  <span>STARSHIP COMMAND CENTER</span>
                </div>
              </div>
              <div className="titlebar-right">
                <span className="titlebar-status">
                  {currentPanel ? `◈ ${currentPanel.toUpperCase()}` : '◈ READY'}
                </span>
                <span className="titlebar-shortcut">
                  <kbd>Ctrl</kbd>+<kbd>K</kbd>
                </span>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="terminal-body">
              {/* Scanline effect overlay */}
              <div className="terminal-scanlines" />

              {/* Output Area */}
              <CommandOutput />

              {/* Input Area */}
              <CommandInput />
            </div>

            {/* Status Bar */}
            <div className="terminal-statusbar">
              <div className="statusbar-left">
                <span className="status-indicator online" />
                <span className="status-text">SYSTEMS ONLINE</span>
              </div>
              <div className="statusbar-center">
                <span className="status-module">
                  {currentPanel ? `MODULE: ${currentPanel.toUpperCase()}` : 'AWAITING INPUT'}
                </span>
              </div>
              <div className="statusbar-right">
                <span className="status-time">
                  {new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
