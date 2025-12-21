import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SocketService } from './core/services/socket.service';
@Component({
  selector: 'sb-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('skip-bo-frontend');
  private socketService = inject(SocketService);
  ngOnInit() {
    console.log('App inicializada y SocketService inyectado');
  }
}
