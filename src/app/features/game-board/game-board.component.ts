import { inject, computed, signal, Component, OnInit, OnDestroy, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import { GameState } from '../../core/models/game.model.js';
import { Subscription } from 'rxjs';
import confetti from 'canvas-confetti';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'game-board',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss',

})
export class GameBoardComponent implements OnInit, OnDestroy {

  private document = inject(DOCUMENT);

  // --- INYECCIONES Y SERVICIOS ---
  private router = inject(Router);
  public socketService = inject(SocketService);
  public gameState = toSignal(this.socketService.gameState$);

  // --- SEÑALES DE UI Y SELECCIÓN ---
  public isCopied = signal(false);
  public selectedSource = signal<'hand' | 'goal' | 'discard' | null>(null);
  public selectedIndex = signal<number | null>(null);
  public selectedCardId = signal<string | null>(null);

  // SEÑALES PARA EL FIN DEL JUEGO
  public showWinnerModal = signal(false);
  public winnerName = signal<string>('');

  // --- LÓGICA DE ERRORES ---
  public gameErrorMessage: string | null = null;
  private errorSubscription!: Subscription;

  // --- LÓGICA DE COLORES Y RECICLAJE ---
  public state!: GameState;
  public wasJustRecycled: boolean = false;
  private prevPending: number = 0;

  // --- COMPUTADOS ---
  public isGameReady = computed(() => {
    const state = this.gameState();
    return !!state?.opponent && state.opponent.id !== 'Opponent';
  });

  public isMyTurn = computed(() => {
    const state = this.gameState();
    return state?.currentPlayerId === state?.me.id;
  });

  constructor() {
    // EFFECT: Detecta cambios en el estado del juego para victoria o reciclaje
    effect(() => {
      const state = this.gameState();
      if (!state) return;

      // 1. Detección de Ganador
      if (state.status === 'finished' && state.winnerId) {
        const isMe = state.winnerId === state.me.id;
        this.winnerName.set(isMe ? '¡YOU!' : state.opponent.name);
        this.showWinnerModal.set(true);


        // Regresar al lobby automáticamente en 5 segundos
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 5000);
      }

      // 2. Manejo visual de reciclaje de cartas
      this.handleStateUpdate(state);
    }, { allowSignalWrites: true });


    effect(() => {
      const state = this.gameState();
      if (!state) return;

      if (state.status === 'finished' && state.winnerId) {
        const isMe = state.winnerId === state.me.id;
        this.winnerName.set(isMe ? '¡TÚ!' : state.opponent.name);
        this.showWinnerModal.set(true);

        // LANZAR CONFETI SI GANASTE
        if (isMe) {
          this.launchCelebration();
        }

        setTimeout(() => {
          this.router.navigate(['/']);
        }, 5000);
      }

      this.handleStateUpdate(state);
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.errorSubscription = this.socketService.error$.subscribe(msg => {
      this.showTemporaryError(msg);
    });

    const myId = (this.socketService as any).PLAYER_ID;
    this.showTemporaryError(`MY ID: ${myId}`);

    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        const state = this.gameState();
        if (state) {
          // Forzamos al socket a pedir el estado actual
          this.socketService.joinGame(state.gameId, state.me.name);
        }
      }
    });

  }

  ngOnDestroy() {
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
  }

  // --- MÉTODOS DE SELECCIÓN (ORIGEN) ---

  selectFromHand(index: number, cardId: string) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    this.setSelection('hand', index, cardId);
  }

  selectFromGoal() {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const state = this.gameState();
    if (!state || state.me.goalPile.length === 0) return;
    const card = state.me.goalPile[state.me.goalPile.length - 1];
    this.setSelection('goal', 0, card.id);
  }

  selectFromDiscard(slotIndex: number) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const state = this.gameState();
    if (!state || state.me.discards[slotIndex].length === 0) return;
    const slot = state.me.discards[slotIndex];
    const topCard = slot[slot.length - 1];
    this.setSelection('discard', slotIndex, topCard.id);
  }

  private setSelection(source: 'hand' | 'goal' | 'discard', index: number, cardId: string) {
    if (this.selectedCardId() === cardId) {
      this.clearSelection();
      return;
    }
    this.selectedSource.set(source);
    this.selectedIndex.set(index);
    this.selectedCardId.set(cardId);
    if ('vibrate' in navigator) navigator.vibrate(15);
  }

  // --- MÉTODOS DE ACCIÓN (DESTINO) ---

  onCommonPileClick(targetIndex: number) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const source = this.selectedSource();
    const cardId = this.selectedCardId();

    if (source && cardId) {
      this.socketService.playCard({
        cardId: cardId,
        source: source,
        targetIndex: targetIndex,
        sourceIndex: source === 'discard' ? this.selectedIndex()! : undefined
      });
      this.clearSelection();
    }
  }

  onDiscardSlotClick(slotIndex: number) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const source = this.selectedSource();
    const cardId = this.selectedCardId();

    if (source === 'hand' && cardId) {
      this.socketService.discard(slotIndex, cardId);
      this.clearSelection();
      return;
    }
    this.selectFromDiscard(slotIndex);
  }

  // --- UTILIDADES Y UI ---

  handleStateUpdate(newState: GameState) {
    if (this.prevPending >= 2 && newState.pilesToRecycleCount === 0) {
      this.wasJustRecycled = true;
      setTimeout(() => this.wasJustRecycled = false, 2500);
    }
    this.state = newState;
    this.prevPending = newState.pilesToRecycleCount;
  }

  getPileCounterClass() {
    if (!this.state) return 'bg-slate-800 border-white/10 text-pink-500';
    if (this.wasJustRecycled) return 'bg-green-600 border-green-400 text-white scale-110 shadow-green-500/50';
    if (this.state.pilesToRecycleCount >= 2) return 'bg-red-600 border-red-400 text-white animate-pulse shadow-red-500/30';
    return 'bg-slate-800 border-white/10 text-pink-500';
  }

  clearSelection() {
    this.selectedSource.set(null);
    this.selectedIndex.set(null);
    this.selectedCardId.set(null);
  }

  async copyCode(gameId: string) {
    try {
      await navigator.clipboard.writeText(gameId);
      if ('vibrate' in navigator) navigator.vibrate(50);
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    } catch (err) {
      console.error('Error copy:', err);
    }
  }

  public showTemporaryError(msg: string) {
    this.gameErrorMessage = msg;
    setTimeout(() => {
      this.gameErrorMessage = null;
    }, 3000);
  }


  private launchCelebration() {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#EAB308', '#22C55E', '#3B82F6'] // Colores de las cartas Skip-Bo
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#EAB308', '#22C55E', '#3B82F6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }
}
