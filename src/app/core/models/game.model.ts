export interface Card {
  id: string;
  value: number;
  isWild: boolean;
  displayColor: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  hand: Card[];
  goalPile: Card[];
  goalRemaining: number;
  discards: Card[][];
}

export interface GameState {
  gameId: string;
  status: string;
  currentPlayerId: string;
  drawPileCount: number;
  commonPiles: Card[][]; // Las 4 pilas del centro
  me: PlayerInfo;        // Tus datos
  opponent: PlayerInfo | null;         // Datos del oponente
  pilesToRecycleCount: number;
  winnerId?: string;
  tieBreaker?: TieBreakerState;
}

export interface MoveData {
  gameId: string;
  playerId: string;
  cardId: string;          // <--- Asegúrate de que esté aquí
  source: 'hand' | 'goal' | 'discard';
  targetIndex: number;
  sourceIndex?: number;    // Opcional, para cuando viene del descarte
}

export interface TieBreakerState {
  player1Id: string; // ✅ NUEVO: Necesario para que el front sepa quién es P1
  player2Id: string; // ✅ NUEVO
  p1Choice: RPSChoice;
  p2Choice: RPSChoice;
  lastResult: 'draw' | 'p1_wins' | 'p2_wins' | null; // Para mostrar feedback visual
  roundId: number;
}
export type RPSChoice = 'rock' | 'paper' | 'scissors' | null;
export interface RPSPayload {
  choice: 'rock' | 'paper' | 'scissors';
}
