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
  };
  startAt: number;
  opponents: Record<string, { username: string; rating: number }>;
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
}

export interface MatchCompletePayload {
  type: 'match_complete';
  matchId: string;
  players: Record<string, MatchCompletePlayer>;
}

export type ServerMessage =
  | { type: 'welcome'; message: string }
  | { type: 'queued'; rating: number; userId: string; username: string }
  | { type: 'left' }
  | MatchFoundPayload
  | { type: 'joined'; matchId: string; userId: string; config: MatchFoundPayload['config'] & { startAt: number; seed: string } | null }
  | { type: 'opponent_joined'; matchId: string; userId: string }
  | { type: 'opponent_left'; matchId: string; userId: string }
  | OpponentProgressPayload
  | OpponentFinishedPayload
  | { type: 'result_received'; matchId: string }
  | MatchCompletePayload
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Matchmaking socket
// ---------------------------------------------------------------------------

export function createMatchmakingSocket(handlers: {
  onQueued?: (data: { rating: number; userId: string; username: string }) => void;
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
    } catch { /* ignore parse errors */ }
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
// Live match socket
// ---------------------------------------------------------------------------

export function createLiveMatchSocket(handlers: {
  onJoined?: (data: { matchId: string; userId: string; config: unknown }) => void;
  onOpponentJoined?: (data: { matchId: string; userId: string }) => void;
  onOpponentLeft?: (data: { matchId: string; userId: string }) => void;
  onOpponentProgress?: (data: OpponentProgressPayload) => void;
  onOpponentFinished?: (data: OpponentFinishedPayload) => void;
  onResultReceived?: (data: { matchId: string }) => void;
  onMatchComplete?: (data: MatchCompletePayload) => void;
  onError?: (msg: string) => void;
  onClose?: () => void;
}) {
  const ws = new WebSocket(`${WS_BASE}/ws/match`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      switch (msg.type) {
        case 'joined':
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
        case 'match_complete':
          handlers.onMatchComplete?.(msg);
          break;
        case 'error':
          handlers.onError?.(msg.message);
          break;
      }
    } catch { /* ignore parse errors */ }
  };

  ws.onclose = () => handlers.onClose?.();

  function join(matchId: string, token: string) {
    const doSend = () => ws.send(JSON.stringify({ type: 'join', matchId, token }));
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
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'progress',
        progressIndex,
        typedLength,
        mistakesCount,
        elapsedMs,
      }));
    }
  }

  function sendResult(typed: string, samples: number[]) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'result', typed, samples }));
    }
  }

  function close() {
    ws.close();
  }

  return { ws, join, sendProgress, sendResult, close };
}
