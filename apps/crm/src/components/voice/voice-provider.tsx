'use client';

// Voice Provider - Voice Command Center State Management
import React, { createContext, useContext, useCallback, useReducer, useEffect, useRef } from 'react';
import type {
  VoiceContextValue,
  VoiceState,
  VoiceAction,
  VoiceSettings,
  VoiceContext as VoiceCtx,
  Entity,
  VoiceError,
  VoiceResponse
} from './types';
import { parseIntent, getSuggestions } from './intent-parser';
import { executeIntent } from './action-executor';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

const MAX_HISTORY = 50;

const defaultSettings: VoiceSettings = {
  enabled: true,
  language: 'en-US',
  speakResponses: true,
  showTranscript: true,
  activationMethod: 'toggle',
  continuousListening: false,
  confidenceThreshold: 0.7,
};

const defaultContext: VoiceCtx = {
  currentPage: '/crm',
  currentModule: 'crm',
  selectedRecord: null,
  recentEntities: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const initialState: VoiceState = {
  isSupported: false,
  isOpen: false,
  isListening: false,
  isProcessing: false,
  transcript: '',
  interimTranscript: '',
  confidence: 0,
  response: null,
  error: null,
  history: [],
  settings: defaultSettings,
  context: defaultContext,
};

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload, error: null };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload, interimTranscript: '' };
    case 'SET_INTERIM_TRANSCRIPT':
      return { ...state, interimTranscript: action.payload };
    case 'SET_RESPONSE':
      return { ...state, response: action.payload, isProcessing: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isListening: false, isProcessing: false };
    case 'SET_CONFIDENCE':
      return { ...state, confidence: action.payload };
    case 'TOGGLE_OPEN':
      return { ...state, isOpen: !state.isOpen };
    case 'SET_OPEN':
      return {
        ...state,
        isOpen: action.payload,
        // Reset state when closing
        ...(action.payload === false ? {
          isListening: false,
          isProcessing: false,
          transcript: '',
          interimTranscript: '',
          response: null,
          error: null,
        } : {})
      };
    case 'ADD_TO_HISTORY':
      return {
        ...state,
        history: [
          { ...action.payload, timestamp: new Date() },
          ...state.history,
        ].slice(0, MAX_HISTORY),
      };
    case 'CLEAR_HISTORY':
      return { ...state, history: [] };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_CONTEXT':
      return { ...state, context: { ...state.context, ...action.payload } };
    case 'ADD_ENTITY':
      const entities = [
        action.payload,
        ...state.context.recentEntities.filter(e => e.id !== action.payload.id),
      ].slice(0, 10);
      return { ...state, context: { ...state.context, recentEntities: entities } };
    case 'RESET':
      return {
        ...initialState,
        isSupported: state.isSupported,
        settings: state.settings,
        context: state.context,
        history: state.history,
      };
    default:
      return state;
  }
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

interface VoiceProviderProps {
  children: React.ReactNode;
  navigate?: (path: string) => void;
  supabase?: unknown;
  profile?: {
    id: string;
    organization_id: string;
  };
  openTerminal?: () => void;
  setTheme?: (theme: 'light' | 'dark') => void;
}

export function VoiceProvider({
  children,
  navigate,
  supabase,
  profile,
  openTerminal,
  setTheme,
}: VoiceProviderProps) {
  const [state, dispatch] = useReducer(voiceReducer, initialState);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Check for Web Speech API support
  useEffect(() => {
    const isSupported = typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    if (isSupported) {
      // Initialize recognition
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        recognitionRef.current = new SpeechRecognitionClass();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = state.settings.language;
        recognitionRef.current.maxAlternatives = 1;
      }

      // Initialize synthesis
      if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis;
      }
    }

    dispatch({ type: 'SET_LISTENING', payload: false });
    // Update initial state to reflect support
    if (isSupported !== state.isSupported) {
      // We'll handle this through a separate initialization
    }
  }, []);

  // Update recognition language when settings change
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = state.settings.language;
    }
  }, [state.settings.language]);

  // Set up recognition handlers
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onstart = () => {
      dispatch({ type: 'SET_LISTENING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          dispatch({ type: 'SET_CONFIDENCE', payload: result[0].confidence });
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (interimTranscript) {
        dispatch({ type: 'SET_INTERIM_TRANSCRIPT', payload: interimTranscript });
      }

      if (finalTranscript) {
        dispatch({ type: 'SET_TRANSCRIPT', payload: finalTranscript });
        // Process the command
        processCommand(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMap: Record<string, VoiceError> = {
        'not-allowed': 'permission-denied',
        'no-speech': 'no-speech',
        'network': 'network-error',
        'aborted': 'aborted',
        'audio-capture': 'audio-capture',
        'service-not-allowed': 'service-not-allowed',
      };

      const voiceError = errorMap[event.error] || 'network-error';
      dispatch({ type: 'SET_ERROR', payload: voiceError });
    };

    recognition.onend = () => {
      dispatch({ type: 'SET_LISTENING', payload: false });

      // If continuous listening is enabled and we're still open, restart
      if (state.settings.continuousListening && state.isOpen && !state.error) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Already started or not supported
          }
        }, 100);
      }
    };

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [state.settings.continuousListening, state.isOpen, state.error]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Space to toggle voice
      if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
        e.preventDefault();
        if (state.isOpen) {
          toggleListening();
        } else {
          dispatch({ type: 'SET_OPEN', payload: true });
        }
      }
      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        dispatch({ type: 'SET_OPEN', payload: false });
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen, state.isListening]);

  // Process voice command
  const processCommand = useCallback(async (transcript: string) => {
    dispatch({ type: 'SET_PROCESSING', payload: true });

    try {
      const intent = parseIntent(transcript, state.context);

      // Check confidence threshold
      if (intent.confidence < state.settings.confidenceThreshold) {
        const response: VoiceResponse = {
          type: 'error',
          message: `I'm not sure I understood. Did you say "${transcript}"?`,
          speak: true,
          actions: [
            { label: 'Try Again', action: 'retry' },
            { label: 'Search Instead', action: `search:${transcript}` },
          ],
        };
        dispatch({ type: 'SET_RESPONSE', payload: response });
        dispatch({ type: 'ADD_TO_HISTORY', payload: { transcript, response } });

        if (state.settings.speakResponses) {
          speak(response.message);
        }
        return;
      }

      const actionContext = {
        navigate: navigate || ((path: string) => {
          if (typeof window !== 'undefined') {
            window.location.href = path;
          }
        }),
        openTerminal: openTerminal || (() => {}),
        setTheme: setTheme || (() => {}),
        supabase,
        profile,
      };

      const response = await executeIntent(intent, actionContext, state.context);

      dispatch({ type: 'SET_RESPONSE', payload: response });
      dispatch({ type: 'ADD_TO_HISTORY', payload: { transcript, response } });

      if (state.settings.speakResponses && response.speak) {
        speak(response.message);
      }
    } catch (error) {
      const response: VoiceResponse = {
        type: 'error',
        message: 'Something went wrong processing your command.',
        speak: true,
      };
      dispatch({ type: 'SET_RESPONSE', payload: response });

      if (state.settings.speakResponses) {
        speak(response.message);
      }
    }
  }, [state.context, state.settings, navigate, openTerminal, setTheme, supabase, profile]);

  // Control functions
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      dispatch({ type: 'SET_ERROR', payload: 'not-supported' });
      return;
    }

    try {
      // Clear previous state
      dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
      dispatch({ type: 'SET_INTERIM_TRANSCRIPT', payload: '' });
      dispatch({ type: 'SET_RESPONSE', payload: null });
      dispatch({ type: 'SET_ERROR', payload: null });

      recognitionRef.current.start();
    } catch (error) {
      // May already be started
      console.warn('Speech recognition start error:', error);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // May not be started
      }
    }
    dispatch({ type: 'SET_LISTENING', payload: false });
  }, []);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  const cancelCommand = useCallback(() => {
    stopListening();
    dispatch({ type: 'SET_TRANSCRIPT', payload: '' });
    dispatch({ type: 'SET_INTERIM_TRANSCRIPT', payload: '' });
    dispatch({ type: 'SET_RESPONSE', payload: null });
    stopSpeaking();
  }, [stopListening]);

  const toggleOpen = useCallback(() => {
    const willOpen = !state.isOpen;
    dispatch({ type: 'SET_OPEN', payload: willOpen });

    if (!willOpen) {
      stopListening();
      stopSpeaking();
    }
  }, [state.isOpen, stopListening]);

  // Manual command execution
  const executeCommand = useCallback(async (text: string) => {
    dispatch({ type: 'SET_TRANSCRIPT', payload: text });
    await processCommand(text);
  }, [processCommand]);

  // Settings
  const updateSettings = useCallback((settings: Partial<VoiceSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  }, []);

  // Context updates
  const updateContext = useCallback((context: Partial<VoiceCtx>) => {
    dispatch({ type: 'SET_CONTEXT', payload: context });
  }, []);

  const addRecentEntity = useCallback((entity: Entity) => {
    dispatch({ type: 'ADD_ENTITY', payload: entity });
  }, []);

  // Speech synthesis
  const speak = useCallback((text: string) => {
    if (!synthRef.current || !state.settings.speakResponses) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.settings.language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    synthRef.current.speak(utterance);
  }, [state.settings.language, state.settings.speakResponses]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  }, []);

  // Check if supported on mount
  useEffect(() => {
    const isSupported = typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // We need to set isSupported in state - use a workaround since it's not in actions
    if (isSupported) {
      // The state will reflect support through the presence of recognitionRef
    }
  }, []);

  const value: VoiceContextValue = {
    state: {
      ...state,
      isSupported: !!recognitionRef.current || (typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)),
    },
    startListening,
    stopListening,
    toggleListening,
    cancelCommand,
    toggleOpen,
    executeCommand,
    updateSettings,
    updateContext,
    addRecentEntity,
    speak,
    stopSpeaking,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}

export function useVoiceOptional(): VoiceContextValue | null {
  return useContext(VoiceContext);
}
