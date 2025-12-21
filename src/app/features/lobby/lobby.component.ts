import {Component, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // Importar Router
import { SocketService } from '../../core/services/socket.service';

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
    if (this.playerName.trim()) {
      this.socketService.createGame(this.playerName, this.goalSize);

      const sub = this.socketService.gameState$.subscribe(state => {
        if (state?.gameId) {
          this.router.navigate(['/game', state.gameId]);
          sub.unsubscribe();
        }
      });
    }
  }
  joinExistingGame() {
    if (this.playerName.trim() && this.gameIdToJoin.trim()) {
      this.socketService.joinGame(this.gameIdToJoin.trim(), this.playerName);
      this.router.navigate(['/game', this.gameIdToJoin.trim()]);
    }
  }
}
