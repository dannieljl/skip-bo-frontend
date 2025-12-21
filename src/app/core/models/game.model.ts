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
  opponent: any;         // Datos del oponente
  pilesToRecycleCount: number;
}

export interface MoveData {
  gameId: string;
  playerId: string;
  cardId: string;          // <--- Asegúrate de que esté aquí
  source: 'hand' | 'goal' | 'discard';
  targetIndex: number;
  sourceIndex?: number;    // Opcional, para cuando viene del descarte
}
