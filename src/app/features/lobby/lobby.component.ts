import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { filter, take } from 'rxjs';

@Component({
  selector: 'sb-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss'
})
export class LobbyComponent {
  private socketService = inject(SocketService);
  private router = inject(Router);

  playerName: string = '';
  goalSize: number = 20;
  gameIdToJoin: string = '';
  isPasted = signal(false);

  async pasteCode() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.gameIdToJoin = text.trim().toLowerCase();
        this.isPasted.set(true);
        setTimeout(() => this.isPasted.set(false), 2000);
      }
    } catch (err) {
      console.error('Error al acceder al portapapeles', err);
    }
  }

  createGame() {
    if (!this.playerName.trim()) return;

    this.socketService.gameState$.pipe(
      filter(state => !!state?.gameId),
      take(1)
    ).subscribe(state => {
      this.router.navigate(['/game', state?.gameId]);
    });

    this.socketService.createGame(this.playerName, this.goalSize);
  }

  joinExistingGame() {
    const gId = this.gameIdToJoin.trim();
    if (this.playerName.trim() && gId) {
      this.socketService.joinGame(gId, this.playerName);
      this.router.navigate(['/game', gId]);
    }
  }
}
