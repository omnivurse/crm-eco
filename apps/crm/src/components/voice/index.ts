// Voice Command Center - Main Exports

export { VoiceProvider, useVoice, useVoiceOptional } from './voice-provider';
export { VoiceCommandCenter } from './voice-command-center';
export { Waveform, SimpleWaveform } from './waveform';
export { parseIntent, getSuggestions } from './intent-parser';
export { executeIntent } from './action-executor';

// Re-export types
export type {
  IntentCategory,
  Intent,
  VoiceError,
  VoiceResponse,
  QuickAction,
  VoiceSettings,
  VoiceContext,
  Entity,
  VoiceAction,
  VoiceState,
  VoiceContextValue,
  VoicePattern,
} from './types';
