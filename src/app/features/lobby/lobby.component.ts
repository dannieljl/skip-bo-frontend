import { Component, inject, signal, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SocketService } from '../../core/services/socket.service';
import { filter, take, Subscription } from 'rxjs';

@Component({
  selector: 'sb-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss'
})
export class LobbyComponent implements OnInit, OnDestroy {
  // Inyecciones
  private socketService = inject(SocketService);
  private router = inject(Router);

  // Variables de Estado
  playerName: string = '';
  goalSize: number = 20;
  gameIdToJoin: string = '';
  isPasted = signal(false);

  // Variables de Control de Conexión (BLINDAJE MÓVIL)
  public isConnected = signal(true);
  private errorSubscription!: Subscription;
  private navSubscription!: Subscription;

  // Inyección de DOCUMENT para detectar visibilidad
  constructor(@Inject(DOCUMENT) private document: Document) {}

  ngOnInit() {

    this.socketService.leaveGame();
    // 1. BLINDAJE: Escuchar errores
    this.errorSubscription = this.socketService.error$.subscribe(msg => console.error('Lobby Error:', msg));

    // 2. BLINDAJE: Monitor de estado visual
    this.socketService.socket.on('connect', () => this.isConnected.set(true));
    this.socketService.socket.on('disconnect', () => this.isConnected.set(false));

    // 3. BLINDAJE SUPREMO: Si vuelven de WhatsApp, reconectar a la fuerza
    this.document.addEventListener('visibilitychange', this.handleVisibility);

    // Recuperar nombre
    const savedName = localStorage.getItem('skipbo_player_name');
    if (savedName) this.playerName = savedName;
  }

  ngOnDestroy() {
    // Limpieza total para evitar fugas de memoria
    if (this.errorSubscription) this.errorSubscription.unsubscribe();
    if (this.navSubscription) this.navSubscription.unsubscribe();

    this.document.removeEventListener('visibilitychange', this.handleVisibility);
    this.socketService.socket.off('connect');
    this.socketService.socket.off('disconnect');
  }

  // --- EL CORAZÓN DE LA ESTABILIDAD (Igual que GameBoard) ---
  private handleVisibility = () => {
    // Si la pantalla se enciende (vuelven de segundo plano) y el socket murió -> REVIVIR
    if (this.document.visibilityState === 'visible' && !this.socketService.socket.connected) {
      console.log("🔄 [Lobby] Resincronización forzada tras inactividad...");
      this.socketService.socket.connect();
    }
  }

  // --- LÓGICA DE NEGOCIO ---

  // Genera ID persistente para que el server sepa que eres tú aunque se caiga el internet
  private getPersistentId(): string {
    let id = localStorage.getItem('skipbo_player_id');
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      localStorage.setItem('skipbo_player_id', id);
    }
    return id;
  }

  createGame() {
    if (!this.playerName.trim()) return;

    // 1. Guardar identidad
    localStorage.setItem('skipbo_player_name', this.playerName);
    const myId = this.getPersistentId();

    // 2. Preparar la navegación (antes de emitir)
    // Usamos una suscripción que espera el ID de la partida
    this.navSubscription = this.socketService.gameState$.pipe(
      filter(state => !!state?.gameId), // Solo pasa si hay ID de juego
      take(1) // Solo necesitamos la primera confirmación
    ).subscribe(state => {
      this.router.navigate(['/game', state?.gameId]);
    });

    // 3. Enviar comando de creación (con el ID persistente)
    this.socketService.createGame(myId, this.playerName, this.goalSize);
  }

  joinExistingGame() {
    const gId = this.gameIdToJoin.trim();
    if (this.playerName.trim() && gId) {
      // 1. Guardar identidad
      localStorage.setItem('skipbo_player_name', this.playerName);
      const myId = this.getPersistentId();

      // 2. Preparar navegación
      this.navSubscription = this.socketService.gameState$.pipe(
        filter(state => !!state?.gameId),
        take(1)
      ).subscribe(state => {
        this.router.navigate(['/game', state?.gameId]);
      });

      // 3. Enviar comando de unión
      this.socketService.joinGame(gId, myId, this.playerName);
    }
  }

  async pasteCode() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.gameIdToJoin = text.trim().toLowerCase();
        this.isPasted.set(true);
        setTimeout(() => this.isPasted.set(false), 2000);
      }
    } catch (err) {
      console.error('Error clipboard:', err);
    }
  }
}
