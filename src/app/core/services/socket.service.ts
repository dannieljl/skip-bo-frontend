import { inject, Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {BehaviorSubject, Subject} from 'rxjs';
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
  public error$ = this.errorSubject.asObservable(); // El componente se suscribirá a esto

  constructor() {
    this.socket = io(environment.apiUrl);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Conectado al servidor de Skip-Bo');
    });

    this.socket.on('game_state', (state: GameState) => {
      this.inspectState(state);
      this.gameStateSubject.next(state);
    });

    this.socket.on('error', (msg: any) => {
      const errorMsg = typeof msg === 'string' ? msg : msg.message;
      console.error('❌ Error del Servidor:', errorMsg);

      if ('vibrate' in navigator) navigator.vibrate(200);

      // 2. Emitimos el error a través del Subject
      this.errorSubject.next(errorMsg);
    });

    this.socket.on('disconnect', () => {
      console.warn('⚠️ Desconectado del servidor');
    });
  }

  createGame(playerName: string, goalSize: number = 20) {
    this.socket.emit('create_game', { playerName, goalSize });
  }

  joinGame(gameId: string, playerName: string) {
    console.log(`📡 Solicitando unirse a: ${gameId}`);
    this.socket.emit('join_game', { gameId, playerName });
  }

  /**
   * Envía una jugada al tablero central
   */
  playCard(move: Omit<MoveData, 'gameId' | 'playerId'>) {
    const currentState = this.currentGameState;

    if (currentState && this.socket.id) {
      const fullMove: MoveData = {
        gameId: currentState.gameId,
        playerId: this.socket.id,
        ...move
      };
      this.socket.emit('play_card', fullMove);
    }
  }

  /**
   * NUEVO MÉTODO: Envía un descarte al servidor
   * El descarte siempre termina el turno en Skip-Bo.
   */
  discard(targetIndex: number, cardId: string) {
    const currentState = this.gameStateSubject.value;

    if (currentState && this.socket.id) {
      this.socket.emit('discard_card', {
        gameId: currentState.gameId,
        playerId: this.socket.id, // Enviamos quién descarta
        cardId: cardId,
        targetIndex: targetIndex
      });
    } else {
      console.error('No se puede descartar: Estado o Socket no disponibles');
    }
  }

  private inspectState(state: GameState): void {
    console.group('🔍 INSPECCIÓN DE ESTADO');
    console.log('ID Partida:', state.gameId);

    if (state.opponent && state.opponent.id !== 'Opponent') {
      console.log('✅ Oponente Real:', state.opponent.name, `(${state.opponent.id})`);
    } else {
      console.warn('⏳ Esperando oponente real (estado actual: null o placeholder)');
    }

    console.log('Cartas en mazo:', state.drawPileCount);
    console.groupEnd();
  }

  public get currentGameState(): GameState | null {
    return this.gameStateSubject.value;
  }
  }


