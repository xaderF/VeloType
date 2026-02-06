import { buildMetrics, computeRawWpm } from './metrics';
import { generateText } from './text';
import { TypingAction, TypingOptions, TypingState } from './types';

const SAMPLE_INTERVAL_MS = 1000;
const MAX_SAMPLES = 240;

export function createTypingState(target: string, options: TypingOptions): TypingState {
  return {
    target,
    typed: '',
    cursor: 0,
    status: 'idle',
    startedAtMs: null,
    endedAtMs: null,
    mode: options.mode,
    limit: options.limit,
    errors: 0,
    samples: [],
    lastSampleMs: null,
  };
}

function finalizeIfComplete(state: TypingState, nowMs: number): TypingState {
  if (state.status === 'finished') return state;

  const shouldFinishText = state.mode === 'text' && state.cursor >= state.target.length;
  const shouldFinishTime =
    state.mode === 'time' &&
    state.startedAtMs !== null &&
    nowMs - state.startedAtMs >= state.limit * 1000;

  if (!shouldFinishText && !shouldFinishTime) return state;

  const endedAtMs = shouldFinishTime && state.startedAtMs !== null
    ? state.startedAtMs + state.limit * 1000
    : nowMs;

  return {
    ...state,
    status: 'finished',
    endedAtMs,
  };
}

function addSample(state: TypingState, nowMs: number): TypingState {
  if (state.status !== 'running' || state.startedAtMs === null) return state;

  const lastSampleMs = state.lastSampleMs ?? state.startedAtMs;
  if (nowMs - lastSampleMs < SAMPLE_INTERVAL_MS) return state;

  const elapsedMs = nowMs - state.startedAtMs;
  const sample = computeRawWpm(state.typed.length, elapsedMs);
  const samples = [...state.samples, sample].slice(-MAX_SAMPLES);

  return {
    ...state,
    samples,
    lastSampleMs: nowMs,
  };
}

export function typingReducer(state: TypingState, action: TypingAction): TypingState {
  switch (action.type) {
    case 'INIT': {
      const { seed, options } = action.payload;
      const target = generateText({
        seed,
        length: options.length ?? Math.max(200, options.limit * 8),
        difficulty: options.difficulty,
      });
      return createTypingState(target, options);
    }

    case 'RESET': {
      const target = action.payload?.target ?? state.target;
      const options: TypingOptions = action.payload?.options ?? {
        mode: state.mode,
        limit: state.limit,
      };
      return createTypingState(target, options);
    }

    case 'TYPE_CHAR': {
      if (state.status === 'finished') return state;
      if (action.payload.char.length !== 1) return state;

      const nowMs = action.payload.nowMs;
      const startedAtMs = state.startedAtMs ?? nowMs;
      const status = state.status === 'idle' ? 'running' : state.status;

      const isCorrect = state.target[state.cursor] === action.payload.char;
      const typed = `${state.typed}${action.payload.char}`;
      const cursor = state.cursor + 1;
      const errors = isCorrect ? state.errors : state.errors + 1;

      const updated: TypingState = {
        ...state,
        typed,
        cursor,
        errors,
        status,
        startedAtMs,
        endedAtMs: null,
      };

      const sampled = addSample(updated, nowMs);
      return finalizeIfComplete(sampled, nowMs);
    }

    case 'BACKSPACE': {
      if (state.status === 'finished') return state;
      if (state.cursor === 0) return state;
      const nowMs = action.payload.nowMs;
      const removedChar = state.typed[state.cursor - 1];
      const wasError = removedChar !== state.target[state.cursor - 1];
      const typed = state.typed.slice(0, -1);
      const cursor = state.cursor - 1;
      const errors = wasError ? Math.max(0, state.errors - 1) : state.errors;

      const updated: TypingState = {
        ...state,
        typed,
        cursor,
        errors,
      };

      return addSample(updated, nowMs);
    }

    case 'TICK': {
      const nowMs = action.payload.nowMs;
      const sampled = addSample(state, nowMs);
      return finalizeIfComplete(sampled, nowMs);
    }

    case 'FINISH': {
      if (state.status === 'finished') return state;
      return {
        ...state,
        status: 'finished',
        endedAtMs: action.payload.nowMs,
      };
    }

    default:
      return state;
  }
}

export function computeMetricsSnapshot(state: TypingState, nowMs: number) {
  return buildMetrics(state, nowMs);
}
