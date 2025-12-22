import { inject, Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GameState, MoveData } from '../models/game.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private router = inject(Router);
  public socket: Socket;

  private gameStateSubject = new BehaviorSubject<GameState | null>(null);
  public gameState$ = this.gameStateSubject.asObservable();

  private errorSubject = new Subject<string>();
  public error$ = this.errorSubject.asObservable();

  public readonly PLAYER_ID = this.getOrCreatePlayerId();

  constructor() {
    // Configuración de reconexión automática para Socket.io
    this.socket = io(environment.apiUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    this.setupListeners();
  }

  private getOrCreatePlayerId(): string {
    let id = localStorage.getItem('skipbo_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('skipbo_player_id', id);
    }
    return id;
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Connected to server. ID:', this.socket.id);

      // Intentar recuperar sesión si existía una partida previa
      const savedGameId = localStorage.getItem('skipbo_current_game_id');
      if (savedGameId) {
        console.log('🔄 Attempting to restore session for game:', savedGameId);
        this.socket.emit('restore_session', {
          gameId: savedGameId,
          playerId: this.PLAYER_ID
        });
      }
    });

    this.socket.on('game_state', (state: GameState) => {
      // Guardamos datos críticos en localStorage para soportar cierres de app
      localStorage.setItem('skipbo_current_game_id', state.gameId);
      localStorage.setItem('skipbo_player_name', state.me.name);

      this.inspectState(state);
      this.gameStateSubject.next(state);
    });

    this.socket.on('session_expired', () => {
      console.warn('⚠️ Session expired');
      localStorage.removeItem('skipbo_current_game_id');
      this.gameStateSubject.next(null);
      this.router.navigate(['/']);
    });

    this.socket.on('error', (msg: any) => {
      const errorMsg = typeof msg === 'string' ? msg : msg.message;
      console.error('❌ Server Error:', errorMsg);
      if ('vibrate' in navigator) navigator.vibrate(200);
      this.errorSubject.next(errorMsg);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Disconnected:', reason);
    });
  }

  createGame(playerName: string, goalSize: number = 20) {
    this.socket.emit('create_game', {
      playerId: this.PLAYER_ID,
      playerName,
      goalSize
    });
  }

  joinGame(gameId: string, playerName: string) {
    console.log(`📡 Joining game: ${gameId}`);
    this.socket.emit('join_game', {
      gameId,
      playerId: this.PLAYER_ID,
      playerName
    });
  }

  /**
   * Envía una jugada al tablero central usando PLAYER_ID persistente
   */
  playCard(move: Omit<MoveData, 'gameId' | 'playerId'>) {
    const currentState = this.currentGameState;

    if (currentState) {
      const fullMove = {
        gameId: currentState.gameId,
        playerId: this.PLAYER_ID, // CRÍTICO: Usar ID persistente, no socket.id
        ...move
      };
      this.socket.emit('play_card', fullMove);
    }
  }

  /**
   * Envía un descarte usando PLAYER_ID persistente
   */
  discard(targetIndex: number, cardId: string) {
    const currentState = this.gameStateSubject.value;

    if (currentState) {
      this.socket.emit('discard_card', {
        gameId: currentState.gameId,
        playerId: this.PLAYER_ID, // CRÍTICO: Usar ID persistente
        cardId: cardId,
        targetIndex: targetIndex
      });
    }
  }

  private inspectState(state: GameState): void {
    console.group('🔍 STATE INSPECTION');
    console.log('Game ID:', state.gameId);
    if (state.opponent && state.opponent.id !== 'Opponent') {
      console.log('✅ Opponent:', state.opponent.name, `(${state.opponent.id})`);
    }
    console.log('My ID (Persistent):', this.PLAYER_ID);
    console.groupEnd();
  }

  public get currentGameState(): GameState | null {
    return this.gameStateSubject.value;
  }

  /**
   * Limpia la sesión local (útil para el botón de salir o al terminar)
   */
  clearSession() {
    localStorage.removeItem('skipbo_current_game_id');
    this.gameStateSubject.next(null);
  }
}
