// useOnlineMatch.ts — React hook that manages the full online match lifecycle:
//   1. Connect to matchmaking WS → join queue → receive MATCH_FOUND
//   2. Connect to live match WS → join room → exchange progress/results
//   3. Expose opponent state & match results to the UI

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createMatchmakingSocket,
  createLiveMatchSocket,
  MatchFoundPayload,
  OpponentProgressPayload,
  MatchCompletePayload,
  MatchCompletePlayer,
  MatchStateRecoveryPayload,
  LatencyStats,
} from '@/services/socket';
import { generateText } from '@/game/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnlineMatchPhase =
  | 'idle'
  | 'queuing'
  | 'match_found'
  | 'countdown'
  | 'playing'
  | 'reconnecting'       // disconnected mid-match, auto-reconnecting
  | 'waiting_opponent'   // we submitted, waiting for them
  | 'complete';

export interface OpponentInfo {
  userId: string;
  username: string;
  rating: number;
}

export interface OpponentProgress {
  progressIndex: number;
  typedLength: number;
  mistakesCount: number;
  elapsedMs: number;
}

export interface OnlineMatchResult {
  matchId: string;
  myResult: MatchCompletePlayer;
  opponentResult: MatchCompletePlayer;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnlineMatch(authToken: string | null) {
  const [phase, setPhase] = useState<OnlineMatchPhase>('idle');
  const [queueTime, setQueueTime] = useState(0);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [matchConfig, setMatchConfig] = useState<MatchFoundPayload['config'] | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [targetText, setTargetText] = useState('');
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [opponentProgress, setOpponentProgress] = useState<OpponentProgress | null>(null);
  const [opponentFinished, setOpponentFinished] = useState(false);
  const [matchResult, setMatchResult] = useState<OnlineMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Latency & reconnect state
  const [latency, setLatency] = useState<LatencyStats | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const phaseBeforeDisconnectRef = useRef<OnlineMatchPhase | null>(null);

  // Refs for socket instances
  const mmSocketRef = useRef<ReturnType<typeof createMatchmakingSocket> | null>(null);
  const liveSocketRef = useRef<ReturnType<typeof createLiveMatchSocket> | null>(null);
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);
  const handleMatchFoundRef = useRef<(data: MatchFoundPayload) => void>(() => {});
  const startCountdownRef = useRef<(targetStartAt: number) => void>(() => {});
  const handleMatchCompleteRef = useRef<(data: MatchCompletePayload) => void>(() => {});
  const handleStateRecoveryRef = useRef<(data: MatchStateRecoveryPayload) => void>(() => {});
  // Track latest typed state for progress reporting
  const typedStateRef = useRef<{ typed: string; cursor: number; errors: number; startedAtMs: number | null }>({
    typed: '', cursor: 0, errors: 0, startedAtMs: null,
  });
  const progressIndexRef = useRef(0);
  const samplesRef = useRef<number[]>([]);

  // Cleanup helper
  const cleanup = useCallback(() => {
    mmSocketRef.current?.close();
    mmSocketRef.current = null;
    liveSocketRef.current?.close();
    liveSocketRef.current = null;
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    queueTimerRef.current = null;
    countdownTimerRef.current = null;
    progressIntervalRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // ------ Queue ------
  const joinQueue = useCallback(() => {
    if (!authToken) {
      setError('Must be logged in to play ranked');
      return;
    }

    setPhase('queuing');
    setQueueTime(0);
    setError(null);
    setMatchResult(null);
    setOpponentProgress(null);
    setOpponentFinished(false);

    queueTimerRef.current = setInterval(() => setQueueTime((t) => t + 1), 1000);

    const mm = createMatchmakingSocket({
      onQueued: (data) => {
        userIdRef.current = data.userId;
        setUserId(data.userId);
      },
      onMatchFound: (data) => {
        if (queueTimerRef.current) clearInterval(queueTimerRef.current);
        queueTimerRef.current = null;
        mmSocketRef.current?.close();
        mmSocketRef.current = null;
        handleMatchFoundRef.current(data);
      },
      onError: (msg) => setError(msg),
      onClose: () => {
        if (queueTimerRef.current) clearInterval(queueTimerRef.current);
        queueTimerRef.current = null;
      },
    });

    mm.joinQueue(authToken);
    mmSocketRef.current = mm;
  }, [authToken]);

  const cancelQueue = useCallback(() => {
    mmSocketRef.current?.leaveQueue();
    mmSocketRef.current?.close();
    mmSocketRef.current = null;
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    queueTimerRef.current = null;
    setPhase('idle');
    setQueueTime(0);
  }, []);

  // ------ Match found ------
  const handleMatchFound = useCallback((data: MatchFoundPayload) => {
    setMatchId(data.matchId);
    setSeed(data.seed);
    setMatchConfig(data.config);
    setStartAt(data.startAt);
    setPhase('match_found');

    // Identify opponent from the opponents map
    const myId = userIdRef.current;
    const opponentEntry = Object.entries(data.opponents).find(([id]) => id !== myId);
    if (opponentEntry) {
      setOpponent({ userId: opponentEntry[0], ...opponentEntry[1] });
    }

    // Generate target text from seed (deterministic – matches server)
    const text = generateText({
      seed: data.seed,
      length: data.config.length,
      difficulty: (data.config.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
      includePunctuation: data.config.includePunctuation,
    });
    setTargetText(text);

    // Connect to live match WS
    const live = createLiveMatchSocket({
      onJoined: () => {
        // Start countdown towards startAt
        startCountdownRef.current(data.startAt);
      },
      onOpponentJoined: () => { /* opponent connected */ },
      onOpponentLeft: () => {
        setOpponentProgress(null);
      },
      onOpponentProgress: (prog: OpponentProgressPayload) => {
        setOpponentProgress({
          progressIndex: prog.progressIndex,
          typedLength: prog.typedLength,
          mistakesCount: prog.mistakesCount,
          elapsedMs: prog.elapsedMs,
        });
      },
      onOpponentFinished: () => {
        setOpponentFinished(true);
      },
      onMatchComplete: (complete: MatchCompletePayload) => {
        handleMatchCompleteRef.current(complete);
      },
      onMatchStateRecovery: (recovery: MatchStateRecoveryPayload) => {
        handleStateRecoveryRef.current(recovery);
      },
      onLatencyUpdate: (stats: LatencyStats) => {
        setLatency(stats);
      },
      onReconnecting: (attempt: number) => {
        // Save current phase so we can restore it after reconnection
        setPhase((prev) => {
          if (prev !== 'reconnecting') {
            phaseBeforeDisconnectRef.current = prev;
          }
          return 'reconnecting';
        });
        setReconnectAttempt(attempt);
      },
      onReconnected: () => {
        // Restore the phase we were in before disconnect
        // (state recovery message will update as needed)
        const prevPhase = phaseBeforeDisconnectRef.current;
        if (prevPhase && prevPhase !== 'reconnecting') {
          setPhase(prevPhase);
        }
        setReconnectAttempt(0);
        phaseBeforeDisconnectRef.current = null;
      },
      onError: (msg) => setError(msg),
      onClose: () => { /* socket fully closed, no more reconnect attempts */ },
    });

    live.join(data.matchId, authToken!);
    liveSocketRef.current = live;
  }, [authToken]);

  useEffect(() => {
    handleMatchFoundRef.current = handleMatchFound;
  }, [handleMatchFound]);

  // ------ Countdown ------
  const startCountdown = useCallback((targetStartAt: number) => {
    setPhase('countdown');

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((targetStartAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setPhase('playing');
        startProgressReporting();
      } else {
        countdownTimerRef.current = setTimeout(tick, 200);
      }
    };
    tick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startCountdownRef.current = startCountdown;
  }, [startCountdown]);

  // ------ Progress reporting (every 1s while playing) ------
  const startProgressReporting = useCallback(() => {
    progressIndexRef.current = 0;
    samplesRef.current = [];

    progressIntervalRef.current = setInterval(() => {
      const ts = typedStateRef.current;
      const elapsedMs = ts.startedAtMs ? Date.now() - ts.startedAtMs : 0;

      liveSocketRef.current?.sendProgress(
        progressIndexRef.current,
        ts.cursor,
        ts.errors,
        elapsedMs,
      );

      // Store per-second sample for consistency
      samplesRef.current.push(ts.cursor);
      progressIndexRef.current += 1;
    }, 1000);
  }, []);

  // ------ Update typing state (called by typing engine) ------
  const updateTypingState = useCallback((typed: string, cursor: number, errors: number, startedAtMs: number | null) => {
    typedStateRef.current = { typed, cursor, errors, startedAtMs };
  }, []);

  // ------ Submit result ------
  const submitResult = useCallback((typed: string, totalErrors?: number, totalKeystrokes?: number) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    liveSocketRef.current?.sendResult(typed, samplesRef.current, totalErrors, totalKeystrokes);
    setPhase('waiting_opponent');
  }, []);

  // ------ Match complete ------
  const handleMatchComplete = useCallback((data: MatchCompletePayload) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const myId = userIdRef.current;
    const myResult = myId ? data.players[myId] : undefined;
    const oppResult = Object.entries(data.players).find(([id]) => id !== myId)?.[1];

    if (myResult && oppResult) {
      setMatchResult({
        matchId: data.matchId,
        myResult,
        opponentResult: oppResult,
      });
    }

    setPhase('complete');

    // Clean up live socket
    liveSocketRef.current?.close();
    liveSocketRef.current = null;
  }, []);

  useEffect(() => {
    handleMatchCompleteRef.current = handleMatchComplete;
  }, [handleMatchComplete]);

  // ------ State recovery on reconnect ------
  const handleStateRecovery = useCallback((data: MatchStateRecoveryPayload) => {
    // Restore opponent progress from the server's last known state
    const oppEntries = Object.entries(data.opponentProgress);
    if (oppEntries.length > 0) {
      const [, prog] = oppEntries[0];
      setOpponentProgress({
        progressIndex: prog.progressIndex,
        typedLength: prog.typedLength,
        mistakesCount: prog.mistakesCount,
        elapsedMs: prog.elapsedMs,
      });
    }

    // Restore opponent finished state
    if (data.opponentFinished.length > 0) {
      setOpponentFinished(true);
    }

    // If we're supposed to be playing but haven't started progress reporting,
    // resume it (e.g. reconnected during playing phase)
    if (phaseBeforeDisconnectRef.current === 'playing' && !progressIntervalRef.current) {
      startProgressReporting();
    }
  }, []);

  useEffect(() => {
    handleStateRecoveryRef.current = handleStateRecovery;
  }, [handleStateRecovery]);

  // ------ Reset ------
  const resetMatch = useCallback(() => {
    cleanup();
    setPhase('idle');
    setQueueTime(0);
    setMatchId(null);
    setSeed(null);
    setMatchConfig(null);
    setStartAt(null);
    setCountdown(3);
    setTargetText('');
    setOpponent(null);
    setOpponentProgress(null);
    setOpponentFinished(false);
    setMatchResult(null);
    setError(null);
    setLatency(null);
    setReconnectAttempt(0);
    phaseBeforeDisconnectRef.current = null;
    typedStateRef.current = { typed: '', cursor: 0, errors: 0, startedAtMs: null };
    progressIndexRef.current = 0;
    samplesRef.current = [];
  }, [cleanup]);

  return {
    // State
    phase,
    queueTime,
    matchId,
    userId,
    seed,
    matchConfig,
    startAt,
    countdown,
    targetText,
    opponent,
    opponentProgress,
    opponentFinished,
    matchResult,
    error,
    latency,
    reconnectAttempt,

    // Actions
    joinQueue,
    cancelQueue,
    updateTypingState,
    submitResult,
    resetMatch,
  };
}
