import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Card {
  id?: string;
  value: number | string;
  isWild?: boolean;
  displayColor?: string;
}

@Component({
  selector: 'sb-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss'
})
export class CardComponent {
  @Input() card!: Card;

  /** * Nuevo Input: Permite que el tablero fuerce un valor visual (ej. la posición en la pila).
   * Si se recibe, la carta ignorará su 'value' real para decidir su color.
   */
  @Input() visualValueOverride?: number;

  // card.component.ts
  getCardStyles(): string {
    const colorMap: Record<string, string> = {
      'blue': 'bg-blue-600 border-blue-400',
      'green': 'bg-green-600 border-green-400',
      'red': 'bg-red-600 border-red-400',
      'orange': 'bg-orange-500 border-orange-300'
    };

    // SEGURIDAD: Si no hay carta, devolvemos un estilo neutro/vacío
    if (!this.card) return 'bg-slate-800 border-slate-700 opacity-50';

    const effectiveValue = this.visualValueOverride !== undefined
      ? this.visualValueOverride
      : (this.card.value === 'SB' || this.card.value === 0 ? 0 : Number(this.card.value));

    if (!this.card.displayColor || this.visualValueOverride !== undefined) {
      if (effectiveValue === 0) return colorMap['orange'];
      if (effectiveValue <= 4) return colorMap['blue'];
      if (effectiveValue <= 8) return colorMap['green'];
      return colorMap['red'];
    }

    return colorMap[this.card.displayColor] || colorMap['blue'];
  }

// También blinda el displayValue
  get displayValue(): string | number {
    if (!this.card) return ''; // Si es nula, no mostramos texto
    if (this.visualValueOverride !== undefined) return this.visualValueOverride;
    return this.card.value === 0 ? 'SB' : this.card.value;
  }
}
