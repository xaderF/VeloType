import { useState, useCallback, useEffect, useRef } from 'react';
import { TypingState } from '@/types/game';
import { calculateWPM, calculateAccuracy, RoundStats } from '@/utils/scoring';

interface UseTypingEngineProps {
  text: string;
  isActive: boolean;
  onComplete?: (stats: RoundStats) => void;
  timeLimit?: number; // in seconds
}

export function useTypingEngine({
  text,
  isActive,
  onComplete,
  timeLimit = 30,
}: UseTypingEngineProps) {
  const [state, setState] = useState<TypingState>({
    text,
    currentIndex: 0,
    errors: 0,
    correctChars: 0,
    startTime: null,
    endTime: null,
    isComplete: false,
  });

  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasStarted = useRef(false);

  // Reset when text changes
  useEffect(() => {
    setState({
      text,
      currentIndex: 0,
      errors: 0,
      correctChars: 0,
      startTime: null,
      endTime: null,
      isComplete: false,
    });
    setTimeRemaining(timeLimit);
    hasStarted.current = false;
  }, [text, timeLimit]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || state.isComplete) return;
    if (!hasStarted.current) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Time's up - complete the round
          const endTime = Date.now();
          const timeElapsed = state.startTime 
            ? (endTime - state.startTime) / 1000 
            : timeLimit;
          
          const stats: RoundStats = {
            wpm: calculateWPM(state.correctChars, timeElapsed),
            accuracy: calculateAccuracy(state.correctChars, state.currentIndex),
            errors: state.errors,
            charactersTyped: state.currentIndex,
            correctCharacters: state.correctChars,
          };

          setState((s) => ({ ...s, isComplete: true, endTime }));
          onComplete?.(stats);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, state.isComplete, state.startTime, state.correctChars, state.currentIndex, state.errors, timeLimit, onComplete]);

  // Focus input when active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isActive || state.isComplete) return;

      // Start timer on first keypress
      if (!hasStarted.current) {
        hasStarted.current = true;
        setState((s) => ({ ...s, startTime: Date.now() }));
      }

      const { key } = e;
      const currentChar = text[state.currentIndex];

      // Handle backspace
      if (key === 'Backspace') {
        if (state.currentIndex > 0) {
          setState((s) => ({
            ...s,
            currentIndex: s.currentIndex - 1,
          }));
        }
        return;
      }

      // Ignore modifier keys and special keys
      if (key.length !== 1) return;

      const isCorrect = key === currentChar;

      setState((s) => {
        const newIndex = s.currentIndex + 1;
        const newCorrectChars = isCorrect ? s.correctChars + 1 : s.correctChars;
        const newErrors = isCorrect ? s.errors : s.errors + 1;
        const isComplete = newIndex >= text.length;

        if (isComplete) {
          const endTime = Date.now();
          const timeElapsed = s.startTime 
            ? (endTime - s.startTime) / 1000 
            : 0;

          const stats: RoundStats = {
            wpm: calculateWPM(newCorrectChars, timeElapsed),
            accuracy: calculateAccuracy(newCorrectChars, newIndex),
            errors: newErrors,
            charactersTyped: newIndex,
            correctCharacters: newCorrectChars,
          };

          setTimeout(() => onComplete?.(stats), 0);

          return {
            ...s,
            currentIndex: newIndex,
            correctChars: newCorrectChars,
            errors: newErrors,
            isComplete: true,
            endTime,
          };
        }

        return {
          ...s,
          currentIndex: newIndex,
          correctChars: newCorrectChars,
          errors: newErrors,
        };
      });
    },
    [isActive, state.currentIndex, state.isComplete, text, onComplete]
  );

  const getCurrentStats = useCallback((): Partial<RoundStats> => {
    const timeElapsed = state.startTime 
      ? (Date.now() - state.startTime) / 1000 
      : 0;

    return {
      wpm: calculateWPM(state.correctChars, timeElapsed),
      accuracy: calculateAccuracy(state.correctChars, state.currentIndex),
      errors: state.errors,
      charactersTyped: state.currentIndex,
      correctCharacters: state.correctChars,
    };
  }, [state]);

  const reset = useCallback(() => {
    setState({
      text,
      currentIndex: 0,
      errors: 0,
      correctChars: 0,
      startTime: null,
      endTime: null,
      isComplete: false,
    });
    setTimeRemaining(timeLimit);
    hasStarted.current = false;
  }, [text, timeLimit]);

  return {
    state,
    timeRemaining,
    inputRef,
    handleKeyDown,
    getCurrentStats,
    reset,
    progress: (state.currentIndex / text.length) * 100,
  };
}
