import { inject, computed, signal, Component, OnInit, OnDestroy, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { CommonModule, DOCUMENT } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import { GameState } from '../../core/models/game.model.js';
import { Subscription } from 'rxjs';
import confetti from 'canvas-confetti';

@Component({
  selector: 'game-board',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss',
})
export class GameBoardComponent implements OnInit, OnDestroy {
  private document = inject(DOCUMENT);
  private router = inject(Router);
  public socketService = inject(SocketService);
  public gameState = toSignal(this.socketService.gameState$);

  public isCopied = signal(false);
  public selectedSource = signal<'hand' | 'goal' | 'discard' | null>(null);
  public selectedIndex = signal<number | null>(null);
  public selectedCardId = signal<string | null>(null);
  public showWinnerModal = signal(false);
  public winnerName = signal<string>('');

  public gameErrorMessage: string | null = null;
  private errorSubscription!: Subscription;

  public wasJustRecycled = false;
  private prevPending = 0;

  public isGameReady = computed(() => {
    const state = this.gameState();
    return state?.status === 'playing' || (!!state?.opponent && state.opponent.id !== 'Opponent');
  });

  public isMyTurn = computed(() => {
    const state = this.gameState();
    return state?.currentPlayerId === state?.me.id;
  });

  constructor() {
    effect(() => {
      const state = this.gameState();
      if (!state) return;

      if (state.status === 'finished' && state.winnerId && !this.showWinnerModal()) {
        const isMe = state.winnerId === state.me.id;
        this.winnerName.set(isMe ? '¡TÚ!' : state.opponent.name);
        this.showWinnerModal.set(true);
        if (isMe) this.launchCelebration();
        setTimeout(() => this.router.navigate(['/']), 6000);
      }
      this.handleStateUpdate(state);
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.errorSubscription = this.socketService.error$.subscribe(msg => this.showTemporaryError(msg));

    // Solo forzar unión si volvemos y NO hay estado cargado
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible' && !this.gameState()) {
        const gid = localStorage.getItem('skipbo_current_game_id');
        const name = localStorage.getItem('skipbo_player_name') || 'Player';
        if (gid) this.socketService.joinGame(gid, name);
      }
    });
  }

  ngOnDestroy() {
    if (this.errorSubscription) this.errorSubscription.unsubscribe();
  }

  selectFromHand(index: number, cardId: string) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    this.setSelection('hand', index, cardId);
  }

  selectFromGoal() {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const state = this.gameState();
    if (!state || state.me.goalPile.length === 0) return;
    this.setSelection('goal', 0, state.me.goalPile[state.me.goalPile.length - 1].id);
  }

  selectFromDiscard(slotIndex: number) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const state = this.gameState();
    if (!state || state.me.discards[slotIndex].length === 0) return;
    const slot = state.me.discards[slotIndex];
    this.setSelection('discard', slotIndex, slot[slot.length - 1].id);
  }

  private setSelection(source: 'hand' | 'goal' | 'discard', index: number, cardId: string) {
    if (this.selectedCardId() === cardId) { this.clearSelection(); return; }
    this.selectedSource.set(source);
    this.selectedIndex.set(index);
    this.selectedCardId.set(cardId);
    if ('vibrate' in navigator) navigator.vibrate(15);
  }

  onCommonPileClick(targetIndex: number) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const source = this.selectedSource();
    const cardId = this.selectedCardId();
    if (source && cardId) {
      this.socketService.playCard({
        cardId, source, targetIndex,
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
    } else {
      this.selectFromDiscard(slotIndex);
    }
  }

  private handleStateUpdate(newState: GameState) {
    if (this.prevPending >= 2 && newState.pilesToRecycleCount === 0) {
      this.wasJustRecycled = true;
      setTimeout(() => this.wasJustRecycled = false, 2500);
    }
    this.prevPending = newState.pilesToRecycleCount;
  }

  public getPileCounterClass() {
    const state = this.gameState();
    if (!state) return 'bg-slate-800 text-pink-500';
    if (this.wasJustRecycled) return 'bg-green-600 text-white scale-110';
    if (state.pilesToRecycleCount >= 2) return 'bg-red-600 text-white animate-pulse';
    return 'bg-slate-800 text-pink-500';
  }

  public clearSelection() {
    this.selectedSource.set(null);
    this.selectedIndex.set(null);
    this.selectedCardId.set(null);
  }

  async copyCode(gameId: string) {
    try {
      await navigator.clipboard.writeText(gameId);
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    } catch (err) {}
  }

  public showTemporaryError(msg: string) {
    this.gameErrorMessage = msg;
    setTimeout(() => this.gameErrorMessage = null, 4000);
  }

  private launchCelebration() {
    const duration = 4 * 1000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }
}
