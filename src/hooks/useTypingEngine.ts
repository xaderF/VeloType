import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { RoundStats, WpmHistoryPoint } from '@/utils/scoring';
import {
  TypingMode,
  createTypingState,
  typingReducer,
  buildMetrics,
} from '@/game/engine';
import { computeWpm, computeRawWpm, countCorrectChars } from '@/game/engine/metrics';

interface UseTypingEngineProps {
  text: string;
  isActive: boolean;
  mode?: TypingMode;
  onComplete?: (stats: RoundStats) => void;
  timeLimit?: number; // in seconds
  /** When true, the timer won't start until the first keystroke (MonkeyType-style) */
  startOnFirstKeystroke?: boolean;
}

export function useTypingEngine({
  text,
  isActive,
  mode = 'time',
  onComplete,
  timeLimit = 30,
  startOnFirstKeystroke = false,
}: UseTypingEngineProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasReported = useRef(false);
  const wpmHistoryRef = useRef<WpmHistoryPoint[]>([]);
  const lastHistoryLen = useRef(0);

  const [state, dispatch] = useReducer(
    typingReducer,
    createTypingState(text, {
      mode,
      limit: timeLimit,
      length: text.length,
    })
  );

  // Reset when text or mode changes
  useEffect(() => {
    hasReported.current = false;
    wpmHistoryRef.current = [];
    lastHistoryLen.current = 0;
    dispatch({
      type: 'RESET',
      payload: {
        target: text,
        options: { mode, limit: timeLimit, length: text.length },
      },
    });
  }, [text, mode, timeLimit]);

  // Tick interval for time-based mode and consistency sampling
  useEffect(() => {
    if (!isActive || state.status === 'finished') return;
    if (startOnFirstKeystroke && mode === 'time' && state.startedAtMs === null) return;
    const interval = setInterval(() => {
      dispatch({ type: 'TICK', payload: { nowMs: Date.now() } });
    }, 500);

    return () => clearInterval(interval);
  }, [isActive, mode, startOnFirstKeystroke, state.startedAtMs, state.status]);

  // Start timed rounds immediately (without waiting for first keypress),
  // unless startOnFirstKeystroke is set (used by practice / free-type mode).
  useEffect(() => {
    if (startOnFirstKeystroke) return; // skip auto-start
    if (!isActive || mode !== 'time') return;
    if (state.status !== 'idle' || state.startedAtMs !== null) return;
    dispatch({ type: 'TICK', payload: { nowMs: Date.now() } });
  }, [isActive, mode, state.status, state.startedAtMs, startOnFirstKeystroke]);

  // Focus input when active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Collect per-second WPM history for charts
  useEffect(() => {
    if (state.samples.length > lastHistoryLen.current && state.startedAtMs !== null) {
      const second = state.samples.length;
      const elapsedMs = second * 1000;
      const correct = countCorrectChars(state.target, state.typed);
      const keystrokes = Math.max(state.totalKeystrokes, state.typed.length);
      const correctedErrors = Math.max(0, state.totalErrors - state.errors);
      const wpm = computeWpm(correct, elapsedMs) + Math.floor(correctedErrors / 3);
      const raw = computeRawWpm(keystrokes, elapsedMs);
      wpmHistoryRef.current = [
        ...wpmHistoryRef.current,
        { second, wpm: Math.round(wpm), raw: Math.round(raw), errors: state.errors },
      ];
      lastHistoryLen.current = state.samples.length;
    }
  }, [state.samples.length, state.target, state.typed, state.errors, state.startedAtMs, state.totalErrors, state.totalKeystrokes]);

  // Notify completion exactly once
  useEffect(() => {
    if (state.status !== 'finished' || hasReported.current) return;
    hasReported.current = true;
    const metrics = buildMetrics(state, Date.now());

    // In timed mode use the full time limit for final WPM (MonkeyType-style).
    // This prevents early submission from inflating WPM.
    const timeLimitMs = timeLimit * 1000;
    const finalWpmTime = mode === 'time' ? timeLimitMs : metrics.elapsedMs;

    const stats: RoundStats = {
      wpm: computeWpm(metrics.correctChars, finalWpmTime) + Math.floor(Math.max(0, metrics.totalErrors - metrics.errors) / 3),
      rawWpm: computeRawWpm(Math.max(metrics.totalTyped, metrics.totalKeystrokes), finalWpmTime),
      accuracy: metrics.accuracy,
      consistency: metrics.consistency,
      errors: metrics.errors,
      totalErrors: metrics.totalErrors,
      charactersTyped: metrics.totalTyped,
      correctCharacters: metrics.correctChars,
      wpmHistory: [...wpmHistoryRef.current],
    };
    onComplete?.(stats);
  }, [state, onComplete, mode, timeLimit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isActive || state.status === 'finished') return;

      const nowMs = Date.now();

      if (e.key === 'Backspace') {
        dispatch({ type: 'BACKSPACE', payload: { nowMs } });
        return;
      }

      if (e.key.length !== 1) return;
      dispatch({ type: 'TYPE_CHAR', payload: { char: e.key, nowMs } });
    },
    [isActive, state.status]
  );

  const metrics = useMemo(() => buildMetrics(state, Date.now()), [state]);

  const timeRemaining = useMemo(() => {
    if (state.mode !== 'time') return timeLimit;
    if (!state.startedAtMs) return timeLimit;
    const reference = state.endedAtMs ?? Date.now();
    const elapsedSeconds = Math.floor((reference - state.startedAtMs) / 1000);
    return Math.max(0, state.limit - elapsedSeconds);
  }, [state, timeLimit]);

  const reset = useCallback(() => {
    hasReported.current = false;
    dispatch({
      type: 'RESET',
      payload: {
        target: text,
        options: { mode, limit: timeLimit, length: text.length },
      },
    });
  }, [text, mode, timeLimit]);

  const progress = state.target.length
    ? (state.cursor / state.target.length) * 100
    : 0;

  return {
    state,
    timeRemaining,
    inputRef,
    handleKeyDown,
    metrics,
    reset,
    progress,
  };
}
