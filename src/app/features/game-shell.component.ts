import { Component, Inject, OnInit, OnDestroy, signal, inject, effect } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { SocketService } from '../core/services/socket.service';
import { GameBoardComponent } from './game-board/game-board.component';
import { RpsMinigameComponent } from './rps-minigame/rps-minigame.component';

@Component({
  selector: 'sb-game-shell',
  standalone: true,
  imports: [CommonModule, GameBoardComponent, RpsMinigameComponent],
  template: `
    @if (error(); as errorMsg) {
      <div class="h-screen w-full bg-[#0f172a] flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
        <div class="max-w-md w-full bg-slate-800/80 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl shadow-red-900/20">

          <div class="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 class="text-2xl font-black text-white mb-2 tracking-tight">¡Oops! Something is worng</h2>
          <p class="text-slate-400 font-medium mb-8">{{ errorMsg }}</p>

          <button (click)="goToLobby()" class="w-full py-3.5 px-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold rounded-xl shadow-lg transform transition-all active:scale-95">
            Go back to lobby
          </button>
        </div>
      </div>
    }

    @else if (isLoading()) {
      <div class="h-screen w-full bg-[#0f172a] flex items-center justify-center">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    }

    @else {
      @if (gameState(); as state) {
        @switch (state.status) {

          @case ('waiting') {
            <div class="absolute inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div class="bg-slate-800/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl max-w-xs w-full animate-in zoom-in">
                <div class="relative w-16 h-16 mx-auto mb-6">
                  <div class="absolute inset-0 border-4 border-orange-500/20 rounded-full"></div>
                  <div class="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h2 class="text-lg font-black mb-1 uppercase tracking-tighter text-white">Waiting Opponent</h2>
                <p class="text-slate-400 text-[10px] mb-6 font-medium uppercase tracking-widest">Code of the room</p>
                <div class="bg-slate-900 py-3 px-4 rounded-xl border border-white/5 flex items-center justify-between mb-2">
                  <span class="font-mono text-orange-400 font-bold tracking-widest uppercase text-sm">{{ state.gameId }}</span>
                  <button (click)="copyCode(state.gameId)" class="p-2 active:scale-90 transition-transform">
                    @if (isCopied()) {
                      <span class="text-[10px] font-bold text-green-500 animate-pulse uppercase">Copied!</span>
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          }

          @case ('resolving_tie') {
            <sb-rps-minigame
              [tieBreaker]="state.tieBreaker!"
              [myGoalCard]="getMyGoalCard()"
              [oppGoalCard]="getOppGoalCard()"
              [amIPlayer1]="state.me.id === state.tieBreaker?.player1Id"
              (choiceMade)="onRpsChoice($event)">
            </sb-rps-minigame>
          }

          @case ('playing') {
            <game-board [statev]="state"></game-board>
          }

          @case ('finished') {
            <game-board [statev]="state"></game-board>
          }
        }
      }
    }
  `
})
export class GameShellComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public socketService = inject(SocketService);

  public gameState = toSignal(this.socketService.gameState$);
  public isLoading = signal(true);
  public isCopied = signal(false);
  public error = signal<string | null>(null);

  private errorSub!: Subscription;
  private gameId: string | null = null;
  private playerId: string | null = null;

  // Listeners de socket para limpieza
  private connectListener: any;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngOnInit() {
    this.gameId = this.route.snapshot.paramMap.get('id');
    this.playerId = this.socketService.PLAYER_ID;

    // 1. Validación inicial básica
    if (!this.gameId) {
      this.goToLobby();
      return;
    }

    // 2. Manejo de Errores (Igual que antes)
    this.errorSub = this.socketService.error$.subscribe(msg => {
      console.error('Socket Error:', msg);
      if (msg && (msg.includes('No existe') || msg.includes('terminado'))) {
        this.isLoading.set(false);
        this.error.set(msg);
      }
    });

    // 3. 🚨 LO IMPORTANTE: Listener PERMANENTE de conexión 🚨
    // Al igual que en tu game-board antiguo, definimos qué hacer cuando hay conexión,
    // sin importar si es automática, manual o reconexión por background.
    this.connectListener = () => {
      console.log('🔗 [Shell] Socket detectó conexión. Ejecutando Join...');
      this.joinRoom();
    };

    this.socketService.socket.on('connect', this.connectListener);

    // 4. Listener de Visibilidad (Para forzar reactividad en iOS)
    this.document.addEventListener('visibilitychange', this.handleVisibility);

    // 5. Intento inicial de conexión
    this.initialConnectionAttempt();
  }

  ngOnDestroy() {
    this.document.removeEventListener('visibilitychange', this.handleVisibility);

    // Limpieza estricta de listeners para evitar duplicados al navegar
    if (this.connectListener) {
      this.socketService.socket.off('connect', this.connectListener);
    }

    if (this.errorSub) this.errorSub.unsubscribe();
  }

  // Lógica unificada para unirse a la sala
  private joinRoom() {
    if (this.gameId && this.playerId) {
      const name = localStorage.getItem('skipbo_player_name') || 'Player';
      this.socketService.joinGame(this.gameId, this.playerId, name);

      // Quitamos loading con un pequeño delay para suavidad visual
      setTimeout(() => {
        if (!this.error()) this.isLoading.set(false);
      }, 300);
    }
  }

  // Decide si conectar o unirse directamente al cargar
  private initialConnectionAttempt() {
    if (this.socketService.socket.connected) {
      // Si ya veníamos conectados del lobby, nos unimos directo
      this.joinRoom();
    } else {
      // Si no, forzamos conexión (el listener 'connect' se encargará del resto)
      console.log('🔌 [Shell] Iniciando conexión de socket...');
      this.socketService.socket.connect();
    }
  }

  // Manejador robusto para vuelta de background (WhatsApp, etc)
  private handleVisibility = () => {
    if (this.document.visibilityState === 'visible') {
      console.log('📱 [Shell] App visible (Background Return)');

      // CASO A: El socket se murió por ahorro de batería (común en iOS)
      if (!this.socketService.socket.connected) {
        console.log('🔄 Socket desconectado. Reconectando...');
        this.socketService.socket.connect();
        // No hacemos nada más aquí, el listener 'connect' del ngOnInit hará el joinRoom
      }
      // CASO B: El socket sigue vivo o se reconectó automágicamente antes de este evento
      else {
        console.log('✅ Socket activo. Refrescando estado (Re-Join)...');
        // IMPORTANTE: Forzamos el join aunque estemos conectados para pedir el estado actual
        // Esto arregla el bug de quedarse en "Waiting"
        this.joinRoom();
      }
    }
  }

  // --- MÉTODOS DE UI (Sin cambios lógicos) ---

  goToLobby() {
    this.router.navigate(['/']);
  }

  onRpsChoice(choice: 'rock' | 'paper' | 'scissors') {
    const state = this.gameState();
    if(state) {
      this.socketService.socket.emit('rps_choice', { gameId: state.gameId, playerId: state.me.id, choice });
    }
  }

  async copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    } catch (e) { console.error('Copy failed', e); }
  }

  getMyGoalCard() { return this.gameState()?.me.goalPile?.at(-1); }
  getOppGoalCard() { return this.gameState()?.opponent?.goalPile?.at(-1); }
}
