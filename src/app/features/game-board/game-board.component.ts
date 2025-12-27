import {inject, computed, signal, Component, OnInit, OnDestroy, effect, Inject, Renderer2, Input} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { CommonModule, DOCUMENT } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import { GameState } from '../../core/models/game.model.js';
import { Subscription } from 'rxjs';
import confetti from 'canvas-confetti';
import {CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';

interface DragData {
  source: 'hand' | 'goal' | 'discard';
  cardId: string;
  sourceIndex?: number;
  cardValue: number | string;// Opcional, para cuando viene del descarte
}

@Component({
  selector: 'game-board',
  standalone: true,
  imports: [CommonModule, CardComponent, DragDropModule],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss',
})
export class GameBoardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) statev!: GameState;

  protected readonly Math = Math;
  private document = inject(DOCUMENT);
  private router = inject(Router);
  public socketService = inject(SocketService);

  public gameState = toSignal(this.socketService.gameState$);

  public isConnected = signal(true);
  // Estados de selección manual (click)
  public selectedSource = signal<'hand' | 'goal' | 'discard' | null>(null);
  public selectedIndex = signal<number | null>(null);
  public selectedCardId = signal<string | null>(null);

  public showWinnerModal = signal(false);
  public winnerName = signal<string>('');
  public wasJustRecycled = signal(false);
  private prevPending = 0;
  public gameErrorMessage: string | null = null;
  private errorSubscription!: Subscription;
  private navigationTimeout: any;

  public isGameReady = computed(() => {
    const state = this.gameState();
    return !!state && (state.status === 'playing' || (!!state.opponent && state.opponent.id !== 'Opponent'));
  });

  public isMyTurn = computed(() => {
    const state = this.gameState();
    return !!state && state.currentPlayerId === state.me.id;
  });

  constructor(@Inject(DOCUMENT) privatedocument: Document, private renderer: Renderer2) {
    effect(() => {
      const state = this.gameState();
      if (!state) return;

      if (state.status === 'finished' && state.winnerId && !this.showWinnerModal()) {
        const isMe = state.winnerId === state.me.id;
        this.winnerName.set(isMe ? '¡YOU!' : (state.opponent?.name || 'OPPONENT'));
        this.showWinnerModal.set(true);
        if (isMe) this.launchCelebration();

        localStorage.removeItem('skipbo_current_game_id');
        this.navigationTimeout = setTimeout(() => this.router.navigate(['/']), 6000);
      }
      this.handleStateUpdate(state);
    });
  }

  ngOnInit() {

    // 1. Forzar overflow hidden al body para evitar rebotes
    this.renderer.addClass(this.document.body, 'overflow-hidden');
    this.renderer.addClass(this.document.body, 'fixed');
    this.renderer.addClass(this.document.body, 'inset-0');

    // 2. Corrección de altura para iOS/Android Chrome
    this.fixViewportHeight();
    window.addEventListener('resize', this.fixViewportHeight.bind(this));


    this.errorSubscription = this.socketService.error$.subscribe(msg => this.showTemporaryError(msg));
    this.socketService.socket.on('connect', () => this.isConnected.set(true));
    this.socketService.socket.on('disconnect', () => this.isConnected.set(false));
    this.document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private handleVisibility = () => {
    if (this.document.visibilityState === 'visible' && !this.socketService.socket.connected) {
      console.log("🔄 Resincronización forzada...");
      this.socketService.socket.connect();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.fixViewportHeight.bind(this));
    this.renderer.removeClass(this.document.body, 'overflow-hidden');
    this.renderer.removeClass(this.document.body, 'fixed');
    this.renderer.removeClass(this.document.body, 'inset-0');

    if (this.errorSubscription) this.errorSubscription.unsubscribe();
    if (this.navigationTimeout) clearTimeout(this.navigationTimeout);
    this.document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  // Ajusta una variable CSS con la altura real visible
  private fixViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }


  // --- LOGICA DRAG & DROP ---

  public canDragPredicate = () => {
    return this.isMyTurn() && !this.showWinnerModal();
  };

  /**
   * Se ejecuta SOLO cuando soltamos válidamente en un DropList destino (Common Piles & Decard Piles)
   */

  /**
   * Maneja el soltado de cartas tanto en Common Piles (Jugar) como en Discard Piles (Descartar)
   */
  // Helper para validar reglas localmente (Pureza Matemática)
  private isValidMove(cardValue: number | string, pile: any[]): boolean {
    // 1. Detectar Comodines (Ajusta según tu backend: 'SB', 0, 'SKIP-BO')
    const val = String(cardValue).toUpperCase();
    const isWild = val === 'SB' || val === 'SKIP-BO' || cardValue === 0;

    if (isWild) return true; // El comodín entra donde sea

    // 2. Regla Matemática: Valor necesario = Tamaño de la pila + 1
    const currentPileSize = pile ? pile.length : 0;
    const neededValue = currentPileSize + 1;

    // Usamos '==' para permitir comparar "5" (string) con 5 (number)
    return cardValue == neededValue;
  }

  public onDrop(event: CdkDragDrop<any>, targetIndex: number, destinationType: 'common' | 'discard') {
    // 1. Validaciones básicas de CDK
    if (!event.container.data || !event.previousContainer.data) return;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;

    const data: DragData = event.item.data;

    // 2. VALIDACIÓN DE REGLAS (El Filtro Anti-Glitch)
    if (destinationType === 'common') {
      const targetPile = event.container.data;

      // Si la matemática no cuadra, CANCELAMOS TODO.
      // La carta regresa sola a su origen con una animación suave.
      if (!this.isValidMove(data.cardValue, targetPile)) {
        if ('vibrate' in navigator) navigator.vibrate(50); // Feedback de error
        return;
      }
    }

    // 3. VALIDACIÓN DE ORIGEN (Descarte)
    if (destinationType === 'discard' && data.source !== 'hand') return;

    // ----------------------------------------------------
    // SI PASA AQUÍ, LA JUGADA ES VÁLIDA.
    // HACEMOS OPTIMISTIC UI (Movimiento instantáneo)
    // ----------------------------------------------------

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    // Feedback táctil de éxito
    if ('vibrate' in navigator) navigator.vibrate(10);

    // 4. Enviar al Servidor (Fuente de la Verdad)
    if (destinationType === 'common') {
      this.socketService.playCard({
        cardId: data.cardId,
        source: data.source,
        targetIndex: targetIndex,
        sourceIndex: data.sourceIndex
      });
    } else {
      this.socketService.discard(targetIndex, data.cardId);
    }

    this.clearSelection();
  }

  // --- Lógica Legacy (Click) ---
  selectFromHand(index: number, cardId: string) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    this.setSelection('hand', index, cardId);
  }

  selectFromGoal() {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const state = this.gameState();
    if (!state || !state.me.goalPile?.length) return;
    this.setSelection('goal', 0, state.me.goalPile[state.me.goalPile.length - 1].id);
  }

  selectFromDiscard(slotIndex: number) {
    if (!this.isMyTurn() || this.showWinnerModal()) return;
    const state = this.gameState();
    if (!state || !state.me.discards[slotIndex]?.length) return;
    const slot = state.me.discards[slotIndex];
    this.setSelection('discard', slotIndex, slot[slot.length - 1].id);
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
      this.wasJustRecycled.set(true);
      setTimeout(() => this.wasJustRecycled.set(false), 2500);
    }
    this.prevPending = newState.pilesToRecycleCount || 0;
  }

  public getPileCounterClass() {
    const state = this.gameState();
    if (!state) return 'bg-slate-800 text-slate-500';
    if (this.wasJustRecycled()) return 'bg-green-600 text-white scale-110 shadow-lg shadow-green-500/20';
    if (state.pilesToRecycleCount >= 2) return 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/20';
    return 'bg-slate-800 text-orange-500 border border-white/5';
  }

  public clearSelection() {
    this.selectedSource.set(null);
    this.selectedIndex.set(null);
    this.selectedCardId.set(null);
  }


  public showTemporaryError(msg: string) {
    this.gameErrorMessage = msg;
    setTimeout(() => this.gameErrorMessage = null, 4000);
  }

  private launchCelebration() {
    const duration = 4000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }



  onDropInVoid(event: CdkDragDrop<any>) {
  }

}

