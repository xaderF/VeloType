import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { RoundStats } from '@/utils/scoring';
import {
  TypingMode,
  createTypingState,
  typingReducer,
  buildMetrics,
} from '@/game/engine';

interface UseTypingEngineProps {
  text: string;
  isActive: boolean;
  mode?: TypingMode;
  onComplete?: (stats: RoundStats) => void;
  timeLimit?: number; // in seconds
}

export function useTypingEngine({
  text,
  isActive,
  mode = 'time',
  onComplete,
  timeLimit = 30,
}: UseTypingEngineProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasReported = useRef(false);

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
    const interval = setInterval(() => {
      dispatch({ type: 'TICK', payload: { nowMs: Date.now() } });
    }, 500);

    return () => clearInterval(interval);
  }, [isActive, state.status]);

  // Focus input when active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Notify completion exactly once
  useEffect(() => {
    if (state.status !== 'finished' || hasReported.current) return;
    hasReported.current = true;
    const metrics = buildMetrics(state, Date.now());
    const stats: RoundStats = {
      wpm: metrics.wpm,
      rawWpm: metrics.rawWpm,
      accuracy: metrics.accuracy,
      consistency: metrics.consistency,
      errors: metrics.errors,
      charactersTyped: metrics.totalTyped,
      correctCharacters: metrics.correctChars,
    };
    onComplete?.(stats);
  }, [state, onComplete]);

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
