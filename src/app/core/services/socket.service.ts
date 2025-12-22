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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
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

  public refreshIdentity(): void {
    this._playerId = this.generateNewId();
    localStorage.setItem('skipbo_player_id', this._playerId);
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Socket conectado:', this.socket.id);
      const savedGameId = localStorage.getItem('skipbo_current_game_id');
      const savedName = localStorage.getItem('skipbo_player_name') || 'Jugador';

      if (savedGameId) {
        this.socket.emit('join_game', {
          gameId: savedGameId,
          playerId: this.PLAYER_ID,
          playerName: savedName
        });
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
    });

    this.socket.on('disconnect', () => console.warn('⚠️ Socket desconectado'));
  }

  createGame(playerName: string, goalSize: number = 20) {
    this.refreshIdentity(); // Genera nuevo ID para nueva partida
    localStorage.setItem('skipbo_player_name', playerName);
    this.socket.emit('create_game', { playerId: this.PLAYER_ID, playerName, goalSize });
  }

  joinGame(gameId: string, playerName: string) {
    localStorage.setItem('skipbo_player_name', playerName);
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
