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

  // State Management
  private gameStateSubject = new BehaviorSubject<GameState | null>(null);
  public gameState$ = this.gameStateSubject.asObservable();

  private errorSubject = new Subject<string>();
  public error$ = this.errorSubject.asObservable();

  // Identity Management
  private _playerId: string = this.getOrCreatePlayerId();
  public get PLAYER_ID(): string { return this._playerId; }

  constructor() {
    this.socket = io(environment.apiUrl, {
      reconnection: true,
      reconnectionAttempts: 20, // Muy alto para móviles
      reconnectionDelay: 1000,
      transports: ['websocket']
    });
    this.setupListeners();
  }

  // --- IDENTITY ---
  private getOrCreatePlayerId(): string {
    let id = localStorage.getItem('skipbo_player_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('skipbo_player_id', id);
    }
    return id;
  }

  // --- LISTENERS ---
  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Socket conectado:', this.socket.id);
      this.attemptReconnection();
    });

    this.socket.on('game_state', (state: GameState) => {
      // Guardar datos críticos para reconexión futura
      localStorage.setItem('skipbo_current_game_id', state.gameId);
      if (state.me) localStorage.setItem('skipbo_player_name', state.me.name);

      this.gameStateSubject.next(state);
    });

    this.socket.on('error', (msg: any) => {
      const errorMsg = typeof msg === 'string' ? msg : msg.message;
      this.errorSubject.next(errorMsg);
      // Si la partida murió, limpiar
      if (errorMsg.includes('inexistente') || errorMsg.includes('No existe')) {
        localStorage.removeItem('skipbo_current_game_id');
      }
    });

    this.socket.on('disconnect', () => console.warn('⚠️ Socket desconectado'));
  }

  private attemptReconnection() {
    /*
    const savedGameId = localStorage.getItem('skipbo_current_game_id');
    const savedName = localStorage.getItem('skipbo_player_name');

    if (savedGameId && savedName) {
      console.log(`🔄 Intentando reconectar a ${savedGameId}...`);
      // Usamos el ID interno ya guardado
      this.joinGame(savedGameId, this.PLAYER_ID, savedName);
    }*/
  }

  // --- ACTIONS ---

  // 1. Crear: ID, Nombre, Meta
  createGame(playerId: string, playerName: string, goalSize: number = 20) {
    localStorage.setItem('skipbo_player_name', playerName);
    this.socket.emit('create_game', { playerId, playerName, goalSize });
  }

  // 2. Unirse: GameID, ID Jugador, Nombre
  joinGame(gameId: string, playerId: string, playerName: string) {
    localStorage.setItem('skipbo_player_name', playerName);
    localStorage.setItem('skipbo_current_game_id', gameId);
    this.socket.emit('join_game', { gameId, playerId, playerName });
  }

  playCard(move: Omit<MoveData, 'gameId' | 'playerId'>) {
    const currentState = this.gameStateSubject.value;
    if (currentState) {
      this.socket.emit('play_card', {
        gameId: currentState.gameId,
        playerId: this.PLAYER_ID,
        ...move
      });
    }
  }

  discard(targetIndex: number, cardId: string) {
    const currentState = this.gameStateSubject.value;
    if (currentState) {
      this.socket.emit('discard_card', {
        gameId: currentState.gameId,
        playerId: this.PLAYER_ID,
        cardId,
        targetIndex
      });
    }
  }

  public leaveGame() {
    // Borramos la "memoria" del ID de la partida
    localStorage.removeItem('skipbo_game_id');

    // Limpiamos el estado reactivo para que la UI sepa que no hay juego
    this.gameStateSubject.next(null);
  }
}
