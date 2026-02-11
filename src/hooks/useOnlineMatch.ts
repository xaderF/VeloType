// useOnlineMatch.ts — React hook that manages the full online match lifecycle.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchState, RoundResult } from '@/types/game';
import type { RoundStats } from '@/utils/scoring';
import {
  createMatchmakingSocket,
  createLiveMatchSocket,
  MatchFoundPayload,
  OpponentProgressPayload,
  MatchCompletePayload,
  MatchCompletePlayer,
  MatchStateRecoveryPayload,
  LatencyStats,
  RoundEndPayload,
} from '@/services/socket';
import { generateText } from '@/game/engine';
import { getRankFromRating } from '@/utils/scoring';

export type OnlineMatchPhase =
  | 'idle'
  | 'queuing'
  | 'match_found'
  | 'prepare'
  | 'countdown'
  | 'playing'
  | 'waiting_opponent'
  | 'round_end'
  | 'reconnecting'
  | 'complete';

export interface OpponentInfo {
  userId: string;
  username: string;
  rating: number | null;
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

function clampToDifficulty(value: string): 'easy' | 'medium' | 'hard' {
  if (value === 'easy' || value === 'hard') return value;
  return 'medium';
}

function applyLoadingCurve(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));

  // "Game-like" loading feel without the abrupt 0 -> 50% jump.
  // Slow initial movement, steadier mid, then a fast finish.
  if (p < 0.2) {
    const t = p / 0.2;
    return t * t * 0.12; // 0 -> 0.12
  }
  if (p < 0.82) {
    const t = (p - 0.2) / 0.62;
    return 0.12 + t * 0.72; // 0.12 -> 0.84
  }
  const tail = (p - 0.82) / 0.18;
  return 0.84 + tail * tail * 0.16; // 0.84 -> 1
}

function toRoundStats(player: {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  errors: number;
  totalTyped: number;
  correctChars: number;
}): RoundStats {
  return {
    wpm: player.wpm,
    rawWpm: player.rawWpm,
    accuracy: player.accuracy,
    consistency: player.consistency,
    errors: player.errors,
    totalErrors: player.errors,
    charactersTyped: player.totalTyped,
    correctCharacters: player.correctChars,
  };
}

export function useOnlineMatch(authToken: string | null) {
  const [phase, setPhase] = useState<OnlineMatchPhase>('idle');
  const [queueTime, setQueueTime] = useState(0);
  const [matchFoundProgress, setMatchFoundProgress] = useState<number | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [matchConfig, setMatchConfig] = useState<MatchFoundPayload['config'] | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [prepareSeconds, setPrepareSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [targetText, setTargetText] = useState('');
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [opponentProgress, setOpponentProgress] = useState<OpponentProgress | null>(null);
  const [opponentFinished, setOpponentFinished] = useState(false);
  const [matchResult, setMatchResult] = useState<OnlineMatchResult | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [drawVoteWindowOpen, setDrawVoteWindowOpen] = useState(false);
  const [drawVoteSelection, setDrawVoteSelection] = useState<'draw' | 'continue' | null>(null);
  const [overtimeActive, setOvertimeActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [latency, setLatency] = useState<LatencyStats | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const phaseBeforeDisconnectRef = useRef<OnlineMatchPhase | null>(null);

  const mmSocketRef = useRef<ReturnType<typeof createMatchmakingSocket> | null>(null);
  const liveSocketRef = useRef<ReturnType<typeof createLiveMatchSocket> | null>(null);
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundClockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchFoundStartedAtRef = useRef<number | null>(null);
  const localRoundStatsRef = useRef<Map<number, RoundStats>>(new Map());
  const forfeitPendingRef = useRef(false);
  const forfeitFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetMatchRef = useRef<() => void>(() => {});

  const userIdRef = useRef<string | null>(null);
  const phaseRef = useRef<OnlineMatchPhase>('idle');
  const seedRef = useRef<string | null>(null);
  const matchConfigRef = useRef<MatchFoundPayload['config'] | null>(null);

  const typedStateRef = useRef<{ typed: string; cursor: number; errors: number; startedAtMs: number | null }>({
    typed: '',
    cursor: 0,
    errors: 0,
    startedAtMs: null,
  });
  const progressIndexRef = useRef(0);
  const samplesRef = useRef<number[]>([]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    matchConfigRef.current = matchConfig;
  }, [matchConfig]);

  const stopProgressReporting = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const stopRoundClock = useCallback(() => {
    if (roundClockTimerRef.current) {
      clearInterval(roundClockTimerRef.current);
      roundClockTimerRef.current = null;
    }
  }, []);

  const stopTransitionTimers = useCallback(() => {
    if (preStartTimerRef.current) {
      clearTimeout(preStartTimerRef.current);
      preStartTimerRef.current = null;
    }
    if (roundTransitionTimerRef.current) {
      clearTimeout(roundTransitionTimerRef.current);
      roundTransitionTimerRef.current = null;
    }
  }, []);

  const clearForfeitPending = useCallback(() => {
    forfeitPendingRef.current = false;
    if (forfeitFallbackTimerRef.current) {
      clearTimeout(forfeitFallbackTimerRef.current);
      forfeitFallbackTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    mmSocketRef.current?.close();
    mmSocketRef.current = null;
    liveSocketRef.current?.close();
    liveSocketRef.current = null;

    if (queueTimerRef.current) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    }

    stopTransitionTimers();
    stopRoundClock();
    stopProgressReporting();
    clearForfeitPending();
  }, [clearForfeitPending, stopProgressReporting, stopRoundClock, stopTransitionTimers]);

  useEffect(() => cleanup, [cleanup]);

  const startRoundClock = useCallback((roundStartAt: number, roundSeconds: number) => {
    stopRoundClock();

    const roundEndAt = roundStartAt + roundSeconds * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((roundEndAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };

    tick();
    roundClockTimerRef.current = setInterval(tick, 200);
  }, [stopRoundClock]);

  const startProgressReporting = useCallback(() => {
    stopProgressReporting();

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

      samplesRef.current.push(ts.cursor);
      progressIndexRef.current += 1;
    }, 1000);
  }, [stopProgressReporting]);

  const startInitialTimeline = useCallback((targetStartAt: number, countdownSecondsForRound: number) => {
    stopTransitionTimers();

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetStartAt - now) / 1000));

      if (remaining > countdownSecondsForRound) {
        // Fill the loading bar across the full pre-countdown window.
        const foundAt = matchFoundStartedAtRef.current ?? now;
        const loadingEndAt = targetStartAt - countdownSecondsForRound * 1000;
        const loadingDurationMs = Math.max(1, loadingEndAt - foundAt);
        const linearProgress = Math.max(0, Math.min(1, (now - foundAt) / loadingDurationMs));
        setMatchFoundProgress(applyLoadingCurve(linearProgress));

        setPhase('prepare');
        setPrepareSeconds(Math.max(0, remaining - countdownSecondsForRound));
        preStartTimerRef.current = setTimeout(tick, 120);
        return;
      }

      if (remaining > 0) {
        setMatchFoundProgress(null);
        setPrepareSeconds(0);
        setCountdown(remaining);
        setPhase('countdown');
        preStartTimerRef.current = setTimeout(tick, 120);
        return;
      }

      setMatchFoundProgress(null);
      setPrepareSeconds(0);
      setCountdown(0);
      setPhase('playing');

      const roundSeconds = matchConfigRef.current?.limit ?? 30;
      startRoundClock(targetStartAt, roundSeconds);
      startProgressReporting();
    };

    tick();
  }, [startProgressReporting, startRoundClock, stopTransitionTimers]);

  const startBetweenRoundsTimeline = useCallback((nextRoundStartAt: number, countdownSecondsForRound: number) => {
    stopTransitionTimers();

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((nextRoundStartAt - Date.now()) / 1000));

      if (remaining > countdownSecondsForRound) {
        setPhase('round_end');
        setBreakSeconds(Math.max(0, remaining - countdownSecondsForRound));
        roundTransitionTimerRef.current = setTimeout(tick, 120);
        return;
      }

      if (remaining > 0) {
        setBreakSeconds(0);
        setCountdown(remaining);
        setPhase('countdown');
        roundTransitionTimerRef.current = setTimeout(tick, 120);
        return;
      }

      setCountdown(0);
      setBreakSeconds(0);
      setOpponentFinished(false);
      setOpponentProgress(null);
      typedStateRef.current = { typed: '', cursor: 0, errors: 0, startedAtMs: null };

      setPhase('playing');
      setMatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'typing',
        };
      });

      const roundSeconds = matchConfigRef.current?.limit ?? 30;
      startRoundClock(nextRoundStartAt, roundSeconds);
      startProgressReporting();
    };

    tick();
  }, [startProgressReporting, startRoundClock, stopTransitionTimers]);

  const buildRoundText = useCallback((baseSeed: string, roundNumber: number, config: MatchFoundPayload['config']) => {
    return generateText({
      seed: `${baseSeed}-${roundNumber}`,
      length: config.length,
      difficulty: clampToDifficulty(config.difficulty),
      includePunctuation: config.includePunctuation,
    });
  }, []);

  const applyRoundEnd = useCallback((payload: RoundEndPayload) => {
    const me = userIdRef.current;
    if (!me) return;

    const myPlayer = payload.players[me];
    const opponentEntry = Object.entries(payload.players).find(([id]) => id !== me);
    if (!myPlayer || !opponentEntry) return;

    const [opponentId, opponentPlayer] = opponentEntry;
    const winner: RoundResult['winner'] = payload.winner === me
      ? 'player'
      : payload.winner === opponentId
        ? 'opponent'
        : 'draw';

    const localRoundStats = localRoundStatsRef.current.get(payload.roundNumber);
    if (localRoundStats) {
      localRoundStatsRef.current.delete(payload.roundNumber);
    }

    const roundResult: RoundResult = {
      roundNumber: payload.roundNumber,
      playerStats: {
        ...toRoundStats(myPlayer),
        wpmHistory: localRoundStats?.wpmHistory,
      },
      opponentStats: toRoundStats(opponentPlayer),
      playerScore: myPlayer.score,
      opponentScore: opponentPlayer.score,
      winner,
      damageDealt: myPlayer.damageDealt,
      damageTaken: myPlayer.damageTaken,
    };

    setMatch((prev) => {
      if (!prev) return prev;

      const nextRound = payload.nextRoundStartAt ? payload.roundNumber + 1 : payload.roundNumber;
      const existingOpponent = prev.opponent;
      const displayMaxRounds = payload.nextRoundStartAt
        ? Math.max(prev.maxRounds, nextRound)
        : Math.max(prev.maxRounds, payload.roundNumber);

      return {
        ...prev,
        currentRound: nextRound,
        maxRounds: displayMaxRounds,
        roundResults: [...prev.roundResults, roundResult],
        status: payload.nextRoundStartAt ? 'round_end' : 'match_end',
        player: {
          ...prev.player,
          hp: myPlayer.hp,
        },
        opponent: {
          ...existingOpponent,
          id: opponentId,
          hp: opponentPlayer.hp,
        },
        winner: payload.nextRoundStartAt
          ? null
          : winner === 'draw'
            ? 'draw'
            : winner === 'player'
              ? 'player'
              : 'opponent',
      };
    });

    stopRoundClock();
    stopProgressReporting();

    setPhase('round_end');
    setDrawVoteWindowOpen(payload.drawWindowOpen);
    setOvertimeActive(payload.overtimeActive);
    setDrawVoteSelection(null);
    setOpponentFinished(false);
    setOpponentProgress(null);

    const baseSeed = seedRef.current;
    const cfg = matchConfigRef.current;

    if (payload.nextRoundStartAt && baseSeed && cfg) {
      const nextRound = payload.roundNumber + 1;
      setTargetText(buildRoundText(baseSeed, nextRound, cfg));
      startBetweenRoundsTimeline(payload.nextRoundStartAt, payload.countdownSeconds ?? 3);
    }
  }, [buildRoundText, startBetweenRoundsTimeline, stopProgressReporting, stopRoundClock]);

  const joinQueue = useCallback(() => {
    if (!authToken) {
      setError('Must be logged in to play ranked');
      return;
    }

    setPhase('queuing');
    setQueueTime(0);
    setMatchFoundProgress(null);
    setError(null);
    setMatchResult(null);
    setOpponentProgress(null);
    setOpponentFinished(false);
    setDrawVoteWindowOpen(false);
    setDrawVoteSelection(null);
    setOvertimeActive(false);
    localRoundStatsRef.current.clear();
    matchFoundStartedAtRef.current = null;

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

        const myId = userIdRef.current;
        const myEntry = myId ? data.opponents[myId] : undefined;
        const opponentEntry = Object.entries(data.opponents).find(([id]) => id !== myId);

        setMatchId(data.matchId);
        setSeed(data.seed);
        seedRef.current = data.seed;
        setMatchConfig(data.config);
        matchConfigRef.current = data.config;
        setStartAt(data.startAt);
        setMatchFoundProgress(0);
        matchFoundStartedAtRef.current = Date.now();
        setPhase('match_found');

        if (opponentEntry) {
          setOpponent({
            userId: opponentEntry[0],
            username: opponentEntry[1].username,
            rating: opponentEntry[1].rating,
          });
        }

        const roundText = buildRoundText(data.seed, 1, data.config);
        setTargetText(roundText);
        setTimeRemaining(data.config.limit);
        startInitialTimeline(data.startAt, data.config.countdownSeconds ?? 3);

        const playerId = myId ?? 'me';
        const playerUsername = myEntry?.username ?? 'Player';
        const playerRating = myEntry?.rating ?? null;
        const oppId = opponentEntry?.[0] ?? 'opponent';
        const oppUsername = opponentEntry?.[1].username ?? 'Opponent';
        const oppRating = opponentEntry?.[1].rating ?? null;

        setMatch({
          id: data.matchId,
          player: {
            id: playerId,
            username: playerUsername,
            rating: playerRating,
            rank: getRankFromRating(playerRating ?? 0).rank,
            hp: 100,
            maxHp: 100,
          },
          opponent: {
            id: oppId,
            username: oppUsername,
            rating: oppRating,
            rank: getRankFromRating(oppRating ?? 0).rank,
            hp: 100,
            maxHp: 100,
          },
          currentRound: 1,
          maxRounds: data.config.maxRounds ?? 6,
          roundResults: [],
          roundTimeSeconds: data.config.limit,
          status: 'waiting',
          winner: null,
          textSeed: Date.now(),
          textSettings: {
            punctuation: data.config.includePunctuation,
          },
        });

        const live = createLiveMatchSocket({
          onJoined: (joined) => {
            const joinedCfg = joined.config;
            if (joinedCfg?.startAt) {
              setStartAt(joinedCfg.startAt);
              setTimeRemaining(joinedCfg.limit);

              setMatch((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  currentRound: joinedCfg.roundNumber ?? prev.currentRound,
                  maxRounds: joinedCfg.maxRounds ?? prev.maxRounds,
                };
              });
              setDrawVoteWindowOpen(joinedCfg.drawWindowOpen ?? false);
              setOvertimeActive(joinedCfg.overtimeActive ?? false);
              setDrawVoteSelection(null);

              if (joinedCfg.roundNumber && seedRef.current && matchConfigRef.current) {
                setTargetText(buildRoundText(seedRef.current, joinedCfg.roundNumber, matchConfigRef.current));
              }

              // Timeline already starts from MATCH_FOUND for smooth 0% progress.
              // Resync only if server adjusts start time materially.
              if (Math.abs(joinedCfg.startAt - data.startAt) > 250) {
                startInitialTimeline(joinedCfg.startAt, joinedCfg.countdownSeconds ?? 3);
              }
            }
          },
          onOpponentJoined: () => {
            // no-op
          },
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
          onRoundEnd: (roundPayload: RoundEndPayload) => {
            applyRoundEnd(roundPayload);
          },
          onMatchComplete: (complete: MatchCompletePayload) => {
            stopProgressReporting();
            stopRoundClock();
            stopTransitionTimers();
            clearForfeitPending();

            const me = userIdRef.current;
            const myResult = me ? complete.players[me] : undefined;
            const oppResult = Object.entries(complete.players).find(([id]) => id !== me)?.[1];

            if (myResult && oppResult) {
              setMatchResult({
                matchId: complete.matchId,
                myResult,
                opponentResult: oppResult,
              });
            }

            setDrawVoteWindowOpen(false);
            setDrawVoteSelection(null);
            setOvertimeActive(false);
            setPhase('complete');
            liveSocketRef.current?.close();
            liveSocketRef.current = null;
          },
          onMatchStateRecovery: (recovery: MatchStateRecoveryPayload) => {
            const oppEntries = Object.entries(recovery.opponentProgress);
            if (oppEntries.length > 0) {
              const [, prog] = oppEntries[0];
              setOpponentProgress({
                progressIndex: prog.progressIndex,
                typedLength: prog.typedLength,
                mistakesCount: prog.mistakesCount,
                elapsedMs: prog.elapsedMs,
              });
            }

            setOpponentFinished(recovery.opponentFinished.length > 0);

            if (recovery.roundNumber && seedRef.current && matchConfigRef.current) {
              setTargetText(buildRoundText(seedRef.current, recovery.roundNumber, matchConfigRef.current));
            }

            if (recovery.roundStartAt) {
              const roundSeconds = matchConfigRef.current?.limit ?? 30;
              startRoundClock(recovery.roundStartAt, roundSeconds);
            }

            if (recovery.hp) {
              const me = userIdRef.current;
              setMatch((prev) => {
                if (!prev || !me) return prev;
                const oppId = prev.opponent.id;
                return {
                  ...prev,
                  currentRound: recovery.roundNumber ?? prev.currentRound,
                  maxRounds: recovery.maxRounds ?? prev.maxRounds,
                  player: {
                    ...prev.player,
                    hp: recovery.hp?.[me] ?? prev.player.hp,
                  },
                  opponent: {
                    ...prev.opponent,
                    hp: recovery.hp?.[oppId] ?? prev.opponent.hp,
                  },
                };
              });
            }
            setDrawVoteWindowOpen(recovery.drawWindowOpen ?? false);
            setOvertimeActive(recovery.overtimeActive ?? false);
            setDrawVoteSelection(null);

            if (phaseBeforeDisconnectRef.current === 'playing' && !progressIntervalRef.current) {
              startProgressReporting();
            }
          },
          onLatencyUpdate: (stats: LatencyStats) => {
            setLatency(stats);
          },
          onReconnecting: (attempt: number) => {
            setPhase((prev) => {
              if (prev !== 'reconnecting') phaseBeforeDisconnectRef.current = prev;
              return 'reconnecting';
            });
            setReconnectAttempt(attempt);
          },
          onReconnected: () => {
            const prevPhase = phaseBeforeDisconnectRef.current;
            if (prevPhase && prevPhase !== 'reconnecting') {
              setPhase(prevPhase);
            }
            setReconnectAttempt(0);
            phaseBeforeDisconnectRef.current = null;
          },
          onError: (msg) => {
            const lower = msg.toLowerCase();
            if (lower.includes('join required before match events')) return;
            if (
              (lower.includes('not in this match') || lower.includes('not in match')) &&
              (phaseRef.current === 'idle' || phaseRef.current === 'complete')
            ) {
              return;
            }
            setError(msg);
          },
          onClose: () => {
            // no-op
          },
        });

        live.join(data.matchId, authToken);
        liveSocketRef.current = live;
      },
      onError: (msg) => setError(msg),
      onClose: () => {
        if (queueTimerRef.current) {
          clearInterval(queueTimerRef.current);
          queueTimerRef.current = null;
        }
      },
    });

    mm.joinQueue(authToken);
    mmSocketRef.current = mm;
  }, [applyRoundEnd, authToken, buildRoundText, clearForfeitPending, startInitialTimeline, startProgressReporting, startRoundClock, stopProgressReporting, stopRoundClock, stopTransitionTimers]);

  const cancelQueue = useCallback(() => {
    mmSocketRef.current?.leaveQueue();
    mmSocketRef.current?.close();
    mmSocketRef.current = null;

    if (queueTimerRef.current) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    }

    setPhase('idle');
    setQueueTime(0);
    setMatchFoundProgress(null);
    setOvertimeActive(false);
    matchFoundStartedAtRef.current = null;
  }, []);

  const updateTypingState = useCallback((typed: string, cursor: number, errors: number, startedAtMs: number | null) => {
    typedStateRef.current = { typed, cursor, errors, startedAtMs };
  }, []);

  const registerLocalRoundStats = useCallback((stats: RoundStats, roundNumber?: number | null) => {
    const resolvedRound = roundNumber ?? match?.currentRound;
    if (!resolvedRound || resolvedRound < 1) return;
    localRoundStatsRef.current.set(resolvedRound, stats);
  }, [match?.currentRound]);

  const submitResult = useCallback((typed: string, totalErrors?: number, totalKeystrokes?: number) => {
    stopProgressReporting();

    liveSocketRef.current?.sendResult(typed, samplesRef.current, totalErrors, totalKeystrokes);
    setPhase('waiting_opponent');
  }, [stopProgressReporting]);

  const resetMatch = useCallback(() => {
    cleanup();

    setPhase('idle');
    setQueueTime(0);
    setMatchFoundProgress(null);
    setMatchId(null);
    setUserId(null);
    setSeed(null);
    setMatchConfig(null);
    setStartAt(null);
    setCountdown(3);
    setPrepareSeconds(0);
    setBreakSeconds(0);
    setTimeRemaining(30);
    setTargetText('');
    setOpponent(null);
    setOpponentProgress(null);
    setOpponentFinished(false);
    setMatchResult(null);
    setMatch(null);
    setDrawVoteWindowOpen(false);
    setDrawVoteSelection(null);
    setOvertimeActive(false);
    setError(null);
    setLatency(null);
    setReconnectAttempt(0);

    userIdRef.current = null;
    phaseBeforeDisconnectRef.current = null;
    typedStateRef.current = { typed: '', cursor: 0, errors: 0, startedAtMs: null };
    progressIndexRef.current = 0;
    samplesRef.current = [];
    seedRef.current = null;
    matchConfigRef.current = null;
    matchFoundStartedAtRef.current = null;
    localRoundStatsRef.current.clear();
  }, [cleanup]);

  useEffect(() => {
    resetMatchRef.current = resetMatch;
  }, [resetMatch]);

  const forfeitMatch = useCallback(() => {
    stopProgressReporting();
    stopRoundClock();
    stopTransitionTimers();
    setError(null);

    const sent = liveSocketRef.current?.sendForfeit() ?? false;
    if (!sent) {
      resetMatch();
      return;
    }

    setPhase('waiting_opponent');
  }, [resetMatch, stopProgressReporting, stopRoundClock, stopTransitionTimers]);

  const submitDrawVote = useCallback((vote: 'draw' | 'continue') => {
    const sent = liveSocketRef.current?.sendDrawVote(vote) ?? false;
    if (!sent) return false;
    setDrawVoteSelection(vote);
    if (vote === 'continue') {
      setDrawVoteWindowOpen(false);
    }
    return true;
  }, []);

  return {
    phase,
    queueTime,
    matchFoundProgress,
    matchId,
    userId,
    seed,
    matchConfig,
    startAt,
    countdown,
    prepareSeconds,
    breakSeconds,
    timeRemaining,
    targetText,
    opponent,
    opponentProgress,
    opponentFinished,
    matchResult,
    match,
    drawVoteWindowOpen,
    drawVoteSelection,
    overtimeActive,
    error,
    latency,
    reconnectAttempt,

    joinQueue,
    cancelQueue,
    updateTypingState,
    registerLocalRoundStats,
    submitResult,
    submitDrawVote,
    resetMatch,
    forfeitMatch,
  };
}
