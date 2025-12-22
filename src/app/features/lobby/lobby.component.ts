import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { filter, take } from 'rxjs';

@Component({
  selector: 'sb-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.component.html'
})
export class LobbyComponent {
  private socketService = inject(SocketService);
  private router = inject(Router);

  playerName: string = '';
  goalSize: number = 20;
  gameIdToJoin: string = '';

  createGame() {
    if (!this.playerName.trim()) return;

    console.log(`[Lobby] Creando partida para: ${this.playerName}`);

    // 1. Nos preparamos para reaccionar al cambio de estado ANTES de emitir
    this.socketService.gameState$.pipe(
      // Solo nos interesa si el estado tiene un gameId válido
      filter(state => !!state?.gameId),
      // Nos desuscribimos automáticamente tras recibir el primero válido
      take(1)
    ).subscribe(state => {
      console.log(`[Lobby] Partida detectada: ${state?.gameId}. Navegando...`);
      this.router.navigate(['/game', state?.gameId]);
    });

    // 2. Emitimos la creación
    this.socketService.createGame(this.playerName, this.goalSize);
  }

  joinExistingGame() {
    const gId = this.gameIdToJoin.trim();
    if (this.playerName.trim() && gId) {
      console.log(`[Lobby] Uniéndose a partida: ${gId}`);
      this.socketService.joinGame(gId, this.playerName);

      // En el join, podemos navegar directamente ya que tenemos el ID
      this.router.navigate(['/game', gId]);
    }
  }
}
