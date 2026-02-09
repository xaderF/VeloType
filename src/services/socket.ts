// socket.ts — WebSocket client service for matchmaking and live match communication

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000';

// ---------------------------------------------------------------------------
// Types – messages the server may send to the client
// ---------------------------------------------------------------------------

export interface MatchFoundPayload {
  type: 'MATCH_FOUND';
  matchId: string;
  seed: string;
  config: {
    mode: string;
    limit: number;
    difficulty: string;
    length: number;
    includePunctuation: boolean;
    maxRounds?: number;
    prepSeconds?: number;
    countdownSeconds?: number;
    breakSeconds?: number;
  };
  startAt: number;
  opponents: Record<string, { username: string; rating: number | null }>;
}

export interface JoinedConfigPayload {
  seed: string;
  mode: string;
  limit: number;
  difficulty: string;
  textLength: number;
  includePunctuation: boolean;
  startAt: number;
  roundNumber?: number;
  maxRounds?: number;
  breakSeconds?: number;
  countdownSeconds?: number;
  prepSeconds?: number;
}

export interface OpponentProgressPayload {
  type: 'opponent_progress';
  matchId: string;
  userId: string;
  progressIndex: number;
  typedLength: number;
  mistakesCount: number;
  elapsedMs: number;
}

export interface OpponentFinishedPayload {
  type: 'opponent_finished';
  matchId: string;
  userId: string;
}

export interface RoundEndPlayerPayload {
  wpm: number;
  accuracy: number;
  consistency: number;
  score: number;
  correctChars: number;
  totalTyped: number;
  errors: number;
  rawWpm: number;
  damageDealt: number;
  damageTaken: number;
  hp: number;
}

export interface RoundEndPayload {
  type: 'round_end';
  matchId: string;
  roundNumber: number;
  maxRounds: number;
  winner: string;
  players: Record<string, RoundEndPlayerPayload>;
  breakSeconds: number;
  countdownSeconds: number;
  nextRoundStartAt: number | null;
}

export interface MatchCompletePlayer {
  wpm: number;
  accuracy: number;
  consistency: number;
  score: number;
  correctChars: number;
  totalTyped: number;
  errors: number;
  rawWpm: number;
  result: string;
  damageDealt: number;
  damageTaken: number;
  ratingDelta?: number;
  newRating?: number | null;
  competitiveElo?: number | null;
}

export interface MatchCompletePayload {
  type: 'match_complete';
  matchId: string;
  players: Record<string, MatchCompletePlayer>;
}

export interface MatchStateRecoveryPayload {
  type: 'match_state_recovery';
  matchId: string;
  serverTime: number;
  opponentProgress: Record<string, {
    progressIndex: number;
    typedLength: number;
    mistakesCount: number;
    elapsedMs: number;
  }>;
  opponentFinished: string[];
  roundNumber?: number;
  roundStartAt?: number;
  maxRounds?: number;
  hp?: Record<string, number>;
}

export interface PongPayload {
  type: 'pong';
  clientTs: number;
  serverTs: number;
}

export type ServerMessage =
  | { type: 'welcome'; message: string }
  | { type: 'queued'; rating: number | null; userId: string; username: string }
  | { type: 'left' }
  | MatchFoundPayload
  | { type: 'joined'; matchId: string; userId: string; config: JoinedConfigPayload | null }
  | { type: 'opponent_joined'; matchId: string; userId: string }
  | { type: 'opponent_left'; matchId: string; userId: string }
  | OpponentProgressPayload
  | OpponentFinishedPayload
  | { type: 'result_received'; matchId: string }
  | RoundEndPayload
  | MatchCompletePayload
  | MatchStateRecoveryPayload
  | PongPayload
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Latency tracker — measures RTT and jitter over a sliding window
// ---------------------------------------------------------------------------

export interface LatencyStats {
  rtt: number;
  smoothedRtt: number;
  jitter: number;
  clockOffset: number;
}

export class LatencyTracker {
  private samples: { rtt: number; clockOffset: number }[] = [];
  private readonly maxSamples = 20;
  private smoothedRtt = 0;
  private jitter = 0;
  private clockOffset = 0;
  private lastRtt = 0;

  record(clientSendTs: number, clientRecvTs: number, serverTs: number) {
    const rtt = clientRecvTs - clientSendTs;
    if (rtt < 0 || rtt > 10_000) return;

    const halfRtt = rtt / 2;
    const offset = serverTs - (clientSendTs + halfRtt);

    this.samples.push({ rtt, clockOffset: offset });
    if (this.samples.length > this.maxSamples) this.samples.shift();

    this.lastRtt = rtt;

    if (this.smoothedRtt === 0) {
      this.smoothedRtt = rtt;
      this.jitter = rtt / 2;
    } else {
      this.smoothedRtt = 0.875 * this.smoothedRtt + 0.125 * rtt;
      this.jitter = 0.75 * this.jitter + 0.25 * Math.abs(rtt - this.smoothedRtt);
    }

    const offsets = this.samples.map((s) => s.clockOffset).sort((a, b) => a - b);
    this.clockOffset = offsets[Math.floor(offsets.length / 2)];
  }

  getStats(): LatencyStats {
    return {
      rtt: this.lastRtt,
      smoothedRtt: Math.round(this.smoothedRtt * 100) / 100,
      jitter: Math.round(this.jitter * 100) / 100,
      clockOffset: Math.round(this.clockOffset),
    };
  }

  serverToClientTime(serverTs: number): number {
    return serverTs - this.clockOffset;
  }

  compensateElapsed(reportedElapsedMs: number): number {
    const oneWay = this.smoothedRtt / 2;
    return Math.max(0, reportedElapsedMs - oneWay);
  }

  reset() {
    this.samples = [];
    this.smoothedRtt = 0;
    this.jitter = 0;
    this.clockOffset = 0;
    this.lastRtt = 0;
  }
}

// ---------------------------------------------------------------------------
// Matchmaking socket
// ---------------------------------------------------------------------------

export function createMatchmakingSocket(handlers: {
  onQueued?: (data: { rating: number | null; userId: string; username: string }) => void;
  onMatchFound?: (data: MatchFoundPayload) => void;
  onError?: (msg: string) => void;
  onClose?: () => void;
}) {
  const ws = new WebSocket(`${WS_BASE}/ws/matchmaking`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      switch (msg.type) {
        case 'queued':
          handlers.onQueued?.(msg);
          break;
        case 'MATCH_FOUND':
          handlers.onMatchFound?.(msg);
          break;
        case 'error':
          handlers.onError?.(msg.message);
          break;
      }
    } catch {
      // Ignore parse errors
    }
  };

  ws.onclose = () => handlers.onClose?.();

  function joinQueue(token: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'join', token }));
    } else {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'join', token }));
      }, { once: true });
    }
  }

  function leaveQueue() {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave' }));
    }
  }

  function close() {
    ws.close();
  }

  return { ws, joinQueue, leaveQueue, close };
}

// ---------------------------------------------------------------------------
// Live match socket — with auto-reconnect, state recovery & ping/pong
// ---------------------------------------------------------------------------

export interface LiveMatchSocketHandlers {
  onJoined?: (data: { matchId: string; userId: string; config: JoinedConfigPayload | null }) => void;
  onOpponentJoined?: (data: { matchId: string; userId: string }) => void;
  onOpponentLeft?: (data: { matchId: string; userId: string }) => void;
  onOpponentProgress?: (data: OpponentProgressPayload) => void;
  onOpponentFinished?: (data: OpponentFinishedPayload) => void;
  onResultReceived?: (data: { matchId: string }) => void;
  onRoundEnd?: (data: RoundEndPayload) => void;
  onMatchComplete?: (data: MatchCompletePayload) => void;
  onMatchStateRecovery?: (data: MatchStateRecoveryPayload) => void;
  onLatencyUpdate?: (stats: LatencyStats) => void;
  onReconnecting?: (attempt: number) => void;
  onReconnected?: () => void;
  onError?: (msg: string) => void;
  onClose?: () => void;
}

export function createLiveMatchSocket(handlers: LiveMatchSocketHandlers) {
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 500;
  const MAX_RECONNECT_DELAY = 8_000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;
  let currentMatchId: string | null = null;
  let currentToken: string | null = null;
  let hasJoined = false;
  let hasJoinAck = false;

  const latencyTracker = new LatencyTracker();
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  const PING_INTERVAL_MS = 3_000;

  let ws: WebSocket;

  function stopPing() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function startPing() {
    stopPing();
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', clientTs: Date.now() }));
      }
    }, PING_INTERVAL_MS);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', clientTs: Date.now() }));
    }
  }

  function setupWs(): WebSocket {
    const sock = new WebSocket(`${WS_BASE}/ws/match`);

    sock.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        switch (msg.type) {
          case 'joined':
            hasJoinAck = true;
            handlers.onJoined?.(msg);
            break;
          case 'opponent_joined':
            handlers.onOpponentJoined?.(msg);
            break;
          case 'opponent_left':
            handlers.onOpponentLeft?.(msg);
            break;
          case 'opponent_progress':
            handlers.onOpponentProgress?.(msg);
            break;
          case 'opponent_finished':
            handlers.onOpponentFinished?.(msg);
            break;
          case 'result_received':
            handlers.onResultReceived?.(msg);
            break;
          case 'round_end':
            handlers.onRoundEnd?.(msg);
            break;
          case 'match_complete':
            handlers.onMatchComplete?.(msg);
            break;
          case 'match_state_recovery':
            handlers.onMatchStateRecovery?.(msg);
            break;
          case 'pong':
            latencyTracker.record(msg.clientTs, Date.now(), msg.serverTs);
            handlers.onLatencyUpdate?.(latencyTracker.getStats());
            break;
          case 'error':
            handlers.onError?.(msg.message);
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    sock.onclose = () => {
      stopPing();
      hasJoinAck = false;
      if (intentionalClose) {
        handlers.onClose?.();
        return;
      }

      if (hasJoined && currentMatchId && currentToken) {
        attemptReconnect();
      } else {
        handlers.onClose?.();
      }
    };

    sock.onerror = () => {
      // onerror always fires before onclose; onclose handles reconnection
    };

    return sock;
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      handlers.onError?.('Connection lost — could not reconnect');
      handlers.onClose?.();
      return;
    }

    reconnectAttempts += 1;
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1) + Math.random() * 200,
      MAX_RECONNECT_DELAY,
    );

    handlers.onReconnecting?.(reconnectAttempts);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      ws = setupWs();

      ws.addEventListener('open', () => {
        if (currentMatchId && currentToken) {
          ws.send(JSON.stringify({ type: 'join', matchId: currentMatchId, token: currentToken }));
          reconnectAttempts = 0;
          handlers.onReconnected?.();
          startPing();
        }
      }, { once: true });
    }, delay);
  }

  ws = setupWs();

  function join(matchId: string, token: string) {
    currentMatchId = matchId;
    currentToken = token;
    hasJoined = true;
    hasJoinAck = false;

    const doSend = () => {
      ws.send(JSON.stringify({ type: 'join', matchId, token }));
      startPing();
    };

    if (ws.readyState === WebSocket.OPEN) {
      doSend();
    } else {
      ws.addEventListener('open', doSend, { once: true });
    }
  }

  function sendProgress(
    progressIndex: number,
    typedLength: number,
    mistakesCount: number,
    elapsedMs: number,
  ) {
    if (ws.readyState === WebSocket.OPEN && hasJoinAck) {
      ws.send(JSON.stringify({
        type: 'progress',
        progressIndex,
        typedLength,
        mistakesCount,
        elapsedMs,
      }));
    }
  }

  function sendResult(typed: string, samples: number[], totalErrors?: number, totalKeystrokes?: number) {
    if (ws.readyState === WebSocket.OPEN && hasJoinAck) {
      ws.send(JSON.stringify({ type: 'result', typed, samples, totalErrors, totalKeystrokes }));
    }
  }

  function sendForfeit(): boolean {
    if (ws.readyState === WebSocket.OPEN && hasJoinAck) {
      ws.send(JSON.stringify({ type: 'forfeit' }));
      return true;
    }
    return false;
  }

  function close() {
    intentionalClose = true;
    hasJoinAck = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopPing();
    ws.close();
  }

  function getLatency(): LatencyStats {
    return latencyTracker.getStats();
  }

  function getLatencyTracker(): LatencyTracker {
    return latencyTracker;
  }

  function isReadyForMatchEvents(): boolean {
    return hasJoinAck;
  }

  return {
    get ws() { return ws; },
    join,
    sendProgress,
    sendResult,
    sendForfeit,
    close,
    getLatency,
    getLatencyTracker,
    isReadyForMatchEvents,
  };
}
