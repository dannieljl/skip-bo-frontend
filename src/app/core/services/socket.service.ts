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

  private _playerId: string = this.getOrCreatePlayerId();
  public get PLAYER_ID(): string { return this._playerId; }

  constructor() {
    this.socket = io(environment.apiUrl, {
      reconnection: true,
      reconnectionAttempts: 10, // Aumentado para móviles
      reconnectionDelay: 1000,
      transports: ['websocket'] // Recomendado para evitar problemas de polling en reconexión
    });
    this.setupListeners();
  }

  private getOrCreatePlayerId(): string {
    let id = localStorage.getItem('skipbo_player_id');
    if (!id) {
      id = this.generateNewId();
      localStorage.setItem('skipbo_player_id', id);
    }
    return id;
  }

  private generateNewId(): string {
    return 'p_' + Math.random().toString(36).substring(2, 11);
  }

  // Ahora solo se usa si el usuario quiere "Cerrar Sesión" o limpiar datos
  public forceNewIdentity(): void {
    this._playerId = this.generateNewId();
    localStorage.setItem('skipbo_player_id', this._playerId);
    localStorage.removeItem('skipbo_current_game_id');
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Socket conectado:', this.socket.id);

      const savedGameId = localStorage.getItem('skipbo_current_game_id');
      const savedName = localStorage.getItem('skipbo_player_name');

      // Si volvemos de segundo plano y había una partida, nos re-unimos automáticamente
      if (savedGameId && savedName) {
        console.log(`🔄 Reconectando a partida ${savedGameId}...`);
        this.joinGame(savedGameId, savedName);
      }
    });

    this.socket.on('game_state', (state: GameState) => {
      localStorage.setItem('skipbo_current_game_id', state.gameId);
      localStorage.setItem('skipbo_player_name', state.me.name);
      this.gameStateSubject.next(state);
    });

    this.socket.on('error', (msg: any) => {
      const errorMsg = typeof msg === 'string' ? msg : msg.message;
      this.errorSubject.next(errorMsg);

      // Si el error es que la partida no existe, limpiamos el localstorage
      if (errorMsg.includes('inexistente') || errorMsg.includes('No existe')) {
        localStorage.removeItem('skipbo_current_game_id');
      }
    });

    this.socket.on('disconnect', () => console.warn('⚠️ Socket desconectado'));
  }

  createGame(playerName: string, goalSize: number = 20) {
    // ❌ ELIMINADO: this.refreshIdentity()
    // Mantenemos el mismo PLAYER_ID para que si el socket parpadea al salir de la app,
    // el servidor nos reconozca al volver.
    localStorage.setItem('skipbo_player_name', playerName);
    this.socket.emit('create_game', { playerId: this.PLAYER_ID, playerName, goalSize });
  }

  joinGame(gameId: string, playerName: string) {
    localStorage.setItem('skipbo_player_name', playerName);
    localStorage.setItem('skipbo_current_game_id', gameId);
    this.socket.emit('join_game', { gameId, playerId: this.PLAYER_ID, playerName });
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
}
