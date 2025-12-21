import {inject, computed, signal, Component, OnInit, OnDestroy} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SocketService } from '../../core/services/socket.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import {GameState} from '../../core/models/game.model.js';
import {Subscription} from 'rxjs'; // Ajusta la ruta si es necesario
import {trigger, transition, style, animate, query, stagger, group} from '@angular/animations';

@Component({
  selector: 'game-board',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.scss',

})
export class GameBoardComponent  implements OnInit, OnDestroy{
  public gameErrorMessage: string | null = null;
  private errorSubscription!: Subscription;

  public socketService = inject(SocketService);
  public gameState = toSignal(this.socketService.gameState$);

  // Señales de UI
  public isCopied = signal(false);

  // Señales de Selección
  public selectedSource = signal<'hand' | 'goal' | 'discard' | null>(null);
  public selectedIndex = signal<number | null>(null);
  public selectedCardId = signal<string | null>(null);

  // Computados
  public isGameReady = computed(() => {
    const state = this.gameState();
    // Validamos que exista oponente y no sea el placeholder
   console.log(state);
    return !!state?.opponent && state.opponent.id !== 'Opponent';
  });

  public isMyTurn = computed(() => {
    const state = this.gameState();
    return state?.currentPlayerId === state?.me.id;
  });

  // --- MÉTODOS DE SELECCIÓN (ORIGEN) ---

  // 1. Seleccionar desde la Mano
  selectFromHand(index: number, cardId: string) {
    if (!this.isMyTurn()) return; // Solo puedes seleccionar si es tu turno
    this.setSelection('hand', index, cardId);
  }

  // 2. Seleccionar desde el Objetivo (Stock)
  selectFromGoal() {
    if (!this.isMyTurn()) return;
    const state = this.gameState();
    if (!state || state.me.goalPile.length === 0) return;

    const card = state.me.goalPile[state.me.goalPile.length - 1];
    this.setSelection('goal', 0, card.id);
  }

  // 3. Seleccionar desde un Descarte (Para jugar al centro)
  selectFromDiscard(slotIndex: number) {
    if (!this.isMyTurn()) return;
    const state = this.gameState();

    // Solo permitimos seleccionar si hay cartas en ese slot
    if (!state || state.me.discards[slotIndex].length === 0) return;

    const slot = state.me.discards[slotIndex];
    const topCard = slot[slot.length - 1];

    this.setSelection('discard', slotIndex, topCard.id);
  }

  // Helper para centralizar la selección y vibración
  private setSelection(source: 'hand' | 'goal' | 'discard', index: number, cardId: string) {
    // Si toco la misma carta, la deselecciono
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

  // 4. Jugar carta en Tablero Central (Common Pile)
  onCommonPileClick(targetIndex: number) {
    if (!this.isMyTurn()) return;

    const source = this.selectedSource();
    const cardId = this.selectedCardId();

    if (source && cardId) {

      this.socketService.playCard({
        cardId: cardId,
        source: source,
        targetIndex: targetIndex,
        // Si viene del descarte, necesitamos saber de qué slot salió
        sourceIndex: source === 'discard' ? this.selectedIndex()! : undefined
      });

      this.clearSelection();
    }
  }

  // 5. Manejo de clics en Descartes (Puede ser Destino u Origen)
  onDiscardSlotClick(slotIndex: number) {
    if (!this.isMyTurn()) return;

    const source = this.selectedSource();
    const cardId = this.selectedCardId();

    // CASO A: Estoy descartando desde mi mano (DESTINO)
    if (source === 'hand' && cardId) {
      this.socketService.discard(slotIndex, cardId);
      this.clearSelection();
      return;
    }

    // CASO B: Quiero seleccionar esta pila para jugar (ORIGEN)
    // No se puede mover Goal -> Discard ni Discard -> Discard, así que esto es seguro
    this.selectFromDiscard(slotIndex);
  }

  // Utilidades
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

  // Variables para controlar la animación
  wasJustRecycled: boolean = false;
  private prevPending: number = 0;
  public state!: GameState;
// Lógica de colores dinámica
  getPileCounterClass() {
    // 1. Blindaje: Si state no existe todavía, devuelve la clase base y sal de la función
    if (!this.state) {
      return 'bg-slate-800 border-white/10 text-pink-500';
    }

    // 2. Lógica de reciclaje (Prioridad máxima)
    if (this.wasJustRecycled) {
      return 'bg-green-600 border-green-400 text-white scale-110 shadow-green-500/50';
    }

    // 3. Lógica de alerta (2 pilas acumuladas)
    // Ahora es seguro acceder a this.state.pilesToRecycleCount
    if (this.state.pilesToRecycleCount >= 2) {
      return 'bg-red-600 border-red-400 text-white animate-pulse shadow-red-500/30';
    }

    // 4. Estado normal
    return 'bg-slate-800 border-white/10 text-pink-500';
  }

// Lógica para detectar el cambio (pon esto donde recibes el socket del estado)
  handleStateUpdate(newState: GameState) {
    // Si antes teníamos 2 pilas y ahora 0, es que se barajó
    if (this.prevPending >= 2 && newState.pilesToRecycleCount === 0) {
      this.wasJustRecycled = true;
      setTimeout(() => this.wasJustRecycled = false, 2500); // 2.5 seg en verde
    }

    this.state = newState;
    this.prevPending = newState.pilesToRecycleCount;
  }

  ngOnInit() {
    // 3. Nos suscribimos al canal de errores
    this.errorSubscription = this.socketService.error$.subscribe(msg => {
      this.showTemporaryError(msg);
    });
  }

  ngOnDestroy() {
    // Muy importante para evitar fugas de memoria
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
  }


  public showTemporaryError(msg: string) {
    this.gameErrorMessage = msg;
    setTimeout(() => {
      this.gameErrorMessage = null;
    }, 3000);
  }

}
