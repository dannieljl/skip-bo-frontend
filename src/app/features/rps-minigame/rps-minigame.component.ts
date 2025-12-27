import { Component, EventEmitter, Input, Output, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import { TieBreakerState, Card } from '../../core/models/game.model';

@Component({
  selector: 'sb-rps-minigame',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './rps-minigame.component.html',
  styles: [`
    @keyframes loadProgress { from { width: 0%; } to { width: 100%; } }
    .animate-progress { animation: loadProgress 3s linear forwards; }
  `]
})
export class RpsMinigameComponent implements OnChanges {
  @Input({ required: true }) tieBreaker!: TieBreakerState;
  @Input() myGoalCard?: Card;
  @Input() oppGoalCard?: Card;
  @Input() amIPlayer1: boolean = false;

  @Output() choiceMade = new EventEmitter<'rock' | 'paper' | 'scissors'>();

  public localSelection = signal<'rock' | 'paper' | 'scissors' | null>(null);

  // 1. CREAMOS UNA SEÑAL ESPEJO PARA EL ESTADO
  // Esto hace que el objeto tieBreaker sea reactivo para los computed
  private state = signal<TieBreakerState | null>(null);

  private currentRoundId = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tieBreaker']) {
      const newVal = changes['tieBreaker'].currentValue as TieBreakerState;

      // 2. ACTUALIZAMOS LA SEÑAL ESPEJO
      this.state.set(newVal);

      // Lógica de reseteo de ronda (igual que antes)
      if (newVal.roundId !== this.currentRoundId) {
        console.log(`🔄 [RPS] Nueva ronda (${newVal.roundId}). Reseteando.`);
        this.currentRoundId = newVal.roundId;
        this.localSelection.set(null);
      }
    }
  }

  // 3. AHORA USAMOS LA SEÑAL this.state() EN LUGAR DE this.tieBreaker
  public statusMessage = computed(() => {
    const currentState = this.state();
    if (!currentState) return 'LOADING...';

    const result = currentState.lastResult;

    // CASO A: RESULTADO FINAL (Aquí es donde fallaba antes)
    if (result) {
      if (result === 'draw') return 'IT’S A TIE!';

      const iWon = (this.amIPlayer1 && result === 'p1_wins') || (!this.amIPlayer1 && result === 'p2_wins');
      return iWon ? 'WIN! YOU START' : 'LOSE! RIVAL STARTS';
    }

    // CASO B: JUEGO ACTIVO
    const myChoice = this.localSelection();
    const opponentChoice = this.amIPlayer1 ? currentState.p2Choice : currentState.p1Choice;
    const opponentHasChosen = opponentChoice !== null; // Si no es null (o es 'hidden'), ya eligió.

    if (!myChoice) {
      return opponentHasChosen
        ? 'OPPONENT IS READY!' // Presión
        : 'CHOOSE YOUR WEAPON';
    } else {
      return opponentHasChosen
        ? 'CALCULATING...'  // Ambos listos
        : 'WAITING OPPONENT...';
    }
  });

  selectOption(option: 'rock' | 'paper' | 'scissors') {
    if (this.localSelection()) return;

    // Verificamos contra la señal
    const currentState = this.state();
    if (!currentState) return;

    const myServerChoice = this.amIPlayer1 ? currentState.p1Choice : currentState.p2Choice;
    if (myServerChoice) return;

    this.localSelection.set(option);
    this.choiceMade.emit(option);
  }
}
