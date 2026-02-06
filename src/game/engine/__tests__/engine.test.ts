import { describe, expect, it } from 'vitest';
import { buildMetrics, generateText, createTypingState, typingReducer, TypingState } from '@/game/engine';

const baseOptions = { mode: 'text' as const, limit: 60 };

describe('engine determinism', () => {
  it('same seed yields identical text', () => {
    const textA = generateText({ seed: 'seed-123', length: 180 });
    const textB = generateText({ seed: 'seed-123', length: 180 });
    const textC = generateText({ seed: 'other', length: 180 });

    expect(textA).toBe(textB);
    expect(textA).not.toBe(textC);
  });
});

describe('typing reducer', () => {
  it('advances cursor and typed string', () => {
    const now = Date.now();
    const initial = createTypingState('abc', baseOptions);

    const next = typingReducer(initial, {
      type: 'TYPE_CHAR',
      payload: { char: 'a', nowMs: now },
    });

    expect(next.cursor).toBe(1);
    expect(next.typed).toBe('a');
    expect(next.status).toBe('running');
    expect(next.startedAtMs).not.toBeNull();
  });

  it('backspace works and never underflows', () => {
    const now = Date.now();
    const initial = createTypingState('abc', baseOptions);
    const typedOnce = typingReducer(initial, {
      type: 'TYPE_CHAR',
      payload: { char: 'x', nowMs: now },
    });

    const backspaced = typingReducer(typedOnce, {
      type: 'BACKSPACE',
      payload: { nowMs: now + 1 },
    });

    const doubleBackspaced = typingReducer(backspaced, {
      type: 'BACKSPACE',
      payload: { nowMs: now + 2 },
    });

    expect(backspaced.cursor).toBe(0);
    expect(backspaced.errors).toBe(0);
    expect(doubleBackspaced.cursor).toBe(0);
  });

  it('time mode finishes exactly at limit', () => {
    const start = 1_000;
    const options = { mode: 'time' as const, limit: 1 };
    let state = createTypingState('abcd', options);

    state = typingReducer(state, {
      type: 'TYPE_CHAR',
      payload: { char: 'a', nowMs: start },
    });

    state = typingReducer(state, {
      type: 'TICK',
      payload: { nowMs: start + 1000 },
    });

    expect(state.status).toBe('finished');
    expect(state.endedAtMs).toBe(start + 1000);
  });
});

describe('metrics', () => {
  it('computes accuracy and wpm correctly', () => {
    const state: TypingState = {
      ...createTypingState('hello world', baseOptions),
      typed: 'hello worlx',
      cursor: 11,
      errors: 1,
      startedAtMs: 0,
      endedAtMs: 60_000,
      status: 'finished',
    };

    const metrics = buildMetrics(state, 60_000);
    expect(metrics.correctChars).toBe(10);
    expect(metrics.totalTyped).toBe(11);
    expect(metrics.errors).toBe(1);
    expect(metrics.accuracy).toBeCloseTo(10 / 11);
    expect(metrics.wpm).toBeCloseTo((10 / 5) / 1); // one minute elapsed
    expect(metrics.rawWpm).toBeCloseTo((11 / 5) / 1);
  });

  it('consistency is stable on constant speed', () => {
    const state: TypingState = {
      ...createTypingState('aaaaa', baseOptions),
      typed: 'aaaaa',
      cursor: 5,
      errors: 0,
      startedAtMs: 0,
      endedAtMs: 50_000,
      status: 'finished',
      samples: [50, 50, 50, 50, 50],
      lastSampleMs: 50_000,
    };

    const metrics = buildMetrics(state, 50_000);
    expect(metrics.consistency).toBeCloseTo(1);
  });
});
