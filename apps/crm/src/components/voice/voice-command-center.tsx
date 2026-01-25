'use client';

// Voice Command Center - Main UI Component
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  VolumeX,
  Settings,
  History,
  HelpCircle,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { useVoice } from './voice-provider';
import { Waveform } from './waveform';
import { getSuggestions } from './intent-parser';
import './voice.css';

const errorMessages: Record<string, string> = {
  'not-supported': 'Voice commands are not supported in this browser. Try Chrome or Edge.',
  'permission-denied': 'Microphone access was denied. Please enable it in your browser settings.',
  'no-speech': 'No speech detected. Please try again.',
  'network-error': 'Network error. Please check your connection.',
  'aborted': 'Voice input was cancelled.',
  'audio-capture': 'Could not capture audio. Check your microphone.',
  'service-not-allowed': 'Speech service not allowed. Please try again.',
};

const responseIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  question: MessageSquare,
  result: CheckCircle2,
};

export function VoiceCommandCenter() {
  const {
    state,
    startListening,
    stopListening,
    toggleListening,
    cancelCommand,
    toggleOpen,
    executeCommand,
    updateSettings,
    speak,
    stopSpeaking,
  } = useVoice();

  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state.isOpen]);

  // Auto-start listening when panel opens (if hold mode)
  useEffect(() => {
    if (state.isOpen && state.settings.activationMethod === 'toggle' && !state.isListening && !state.isProcessing) {
      // Don't auto-start, let user click
    }
  }, [state.isOpen]);

  // Handle manual input submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    await executeCommand(manualInput.trim());
    setManualInput('');
  };

  // Handle quick action click
  const handleQuickAction = (action: string) => {
    if (action.startsWith('navigate:')) {
      const path = action.replace('navigate:', '');
      window.location.href = path;
    } else if (action === 'retry') {
      startListening();
    } else if (action.startsWith('search:')) {
      const query = action.replace('search:', '');
      executeCommand(`search ${query}`);
    } else {
      executeCommand(action);
    }
  };

  // Get suggestions for current context
  const suggestions = getSuggestions(state.context);

  const displayTranscript = state.transcript || state.interimTranscript;
  const ResponseIcon = state.response ? responseIcons[state.response.type] : null;

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        className="voice-fab"
        onClick={toggleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Voice Commands"
        title="Voice Commands (Ctrl+Space)"
      >
        <Mic className="voice-fab-icon" />
        <span className="voice-fab-pulse" />
      </motion.button>

      {/* Voice Command Panel */}
      <AnimatePresence>
        {state.isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="voice-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleOpen}
            />

            {/* Main Panel */}
            <motion.div
              ref={panelRef}
              className="voice-panel"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Voice Command Center"
            >
              {/* Header */}
              <div className="voice-header">
                <div className="voice-header-left">
                  <div className="voice-title">
                    <Mic className="voice-title-icon" />
                    <span>Voice Command Center</span>
                  </div>
                  <span className="voice-shortcut">
                    <kbd>Ctrl</kbd>+<kbd>Space</kbd>
                  </span>
                </div>
                <div className="voice-header-right">
                  <button
                    className="voice-header-btn"
                    onClick={() => setShowHelp(!showHelp)}
                    title="Help"
                  >
                    <HelpCircle size={18} />
                  </button>
                  <button
                    className="voice-header-btn"
                    onClick={() => setShowHistory(!showHistory)}
                    title="History"
                  >
                    <History size={18} />
                  </button>
                  <button
                    className="voice-header-btn"
                    onClick={() => updateSettings({ speakResponses: !state.settings.speakResponses })}
                    title={state.settings.speakResponses ? 'Mute responses' : 'Speak responses'}
                  >
                    {state.settings.speakResponses ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                  <button
                    className="voice-header-btn close"
                    onClick={toggleOpen}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="voice-content">
                {/* Waveform Visualization */}
                <div className="voice-waveform-container">
                  <Waveform isActive={state.isListening} />

                  {/* Status Text */}
                  <div className="voice-status">
                    {state.isListening && !state.isProcessing && (
                      <span className="voice-status-listening">
                        <span className="voice-status-dot listening" />
                        Listening...
                      </span>
                    )}
                    {state.isProcessing && (
                      <span className="voice-status-processing">
                        <Loader2 className="voice-status-spinner" />
                        Processing...
                      </span>
                    )}
                    {!state.isListening && !state.isProcessing && !state.error && (
                      <span className="voice-status-ready">
                        Click the mic or press Space to speak
                      </span>
                    )}
                  </div>
                </div>

                {/* Transcript Display */}
                {displayTranscript && (
                  <motion.div
                    className="voice-transcript"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <span className="voice-transcript-label">You said:</span>
                    <p className="voice-transcript-text">
                      "{displayTranscript}"
                      {state.interimTranscript && <span className="interim">...</span>}
                    </p>
                    {state.confidence > 0 && (
                      <span className="voice-confidence">
                        {Math.round(state.confidence * 100)}% confidence
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Error Display */}
                {state.error && (
                  <motion.div
                    className="voice-error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <AlertCircle className="voice-error-icon" />
                    <span>{errorMessages[state.error] || 'An error occurred'}</span>
                  </motion.div>
                )}

                {/* Response Display */}
                {state.response && (
                  <motion.div
                    className={`voice-response voice-response-${state.response.type}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {ResponseIcon && <ResponseIcon className="voice-response-icon" />}
                    <div className="voice-response-content">
                      <p className="voice-response-message">{state.response.message}</p>

                      {/* Quick Actions */}
                      {state.response.actions && state.response.actions.length > 0 && (
                        <div className="voice-quick-actions">
                          {state.response.actions.map((action, i) => (
                            <button
                              key={i}
                              className="voice-quick-action"
                              onClick={() => handleQuickAction(action.action)}
                            >
                              {action.label}
                              <ChevronRight size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Help Panel */}
                <AnimatePresence>
                  {showHelp && (
                    <motion.div
                      className="voice-help"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <h4>Example Commands</h4>
                      <div className="voice-help-grid">
                        <div className="voice-help-category">
                          <span className="category-label">Navigation</span>
                          <ul>
                            <li>"Show me leads"</li>
                            <li>"Go to pipeline"</li>
                            <li>"Open calendar"</li>
                          </ul>
                        </div>
                        <div className="voice-help-category">
                          <span className="category-label">Queries</span>
                          <ul>
                            <li>"How many deals this week?"</li>
                            <li>"What's my pipeline worth?"</li>
                            <li>"Show today's summary"</li>
                          </ul>
                        </div>
                        <div className="voice-help-category">
                          <span className="category-label">Actions</span>
                          <ul>
                            <li>"Create a task for tomorrow"</li>
                            <li>"Call John Smith"</li>
                            <li>"Schedule a meeting"</li>
                          </ul>
                        </div>
                        <div className="voice-help-category">
                          <span className="category-label">Control</span>
                          <ul>
                            <li>"Switch to dark mode"</li>
                            <li>"Open terminal"</li>
                            <li>"Search for Acme"</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* History Panel */}
                <AnimatePresence>
                  {showHistory && state.history.length > 0 && (
                    <motion.div
                      className="voice-history"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <h4>Recent Commands</h4>
                      <div className="voice-history-list">
                        {state.history.slice(0, 5).map((item, i) => (
                          <button
                            key={i}
                            className="voice-history-item"
                            onClick={() => executeCommand(item.transcript)}
                          >
                            <span className="history-transcript">"{item.transcript}"</span>
                            <span className={`history-type history-type-${item.response.type}`}>
                              {item.response.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Suggestions */}
                {!state.response && !state.isListening && !showHelp && !showHistory && (
                  <div className="voice-suggestions">
                    <span className="voice-suggestions-label">Try saying:</span>
                    <div className="voice-suggestions-list">
                      {suggestions.slice(0, 4).map((suggestion, i) => (
                        <button
                          key={i}
                          className="voice-suggestion"
                          onClick={() => executeCommand(suggestion)}
                        >
                          "{suggestion}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer / Input Area */}
              <div className="voice-footer">
                {/* Manual Text Input */}
                <form className="voice-manual-input" onSubmit={handleManualSubmit}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Or type a command..."
                    className="voice-text-input"
                    disabled={state.isProcessing}
                  />
                </form>

                {/* Mic Button */}
                <button
                  className={`voice-mic-btn ${state.isListening ? 'listening' : ''} ${state.isProcessing ? 'processing' : ''}`}
                  onClick={state.isListening ? stopListening : startListening}
                  disabled={state.isProcessing || !state.isSupported}
                  aria-label={state.isListening ? 'Stop listening' : 'Start listening'}
                >
                  {state.isProcessing ? (
                    <Loader2 className="voice-mic-icon spinning" />
                  ) : state.isListening ? (
                    <MicOff className="voice-mic-icon" />
                  ) : (
                    <Mic className="voice-mic-icon" />
                  )}
                  <span className="voice-mic-ring" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default VoiceCommandCenter;
