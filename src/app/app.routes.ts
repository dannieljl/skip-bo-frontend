import { Routes } from '@angular/router';
import {LobbyComponent} from './features/lobby/lobby.component.js';
import { GameShellComponent } from './features/game-shell.component.js';
export const routes: Routes = [

  { path: 'lobby', component: LobbyComponent },
  { path: 'game/:id', component: GameShellComponent }, // Apunta aquí ahora
  { path: '', redirectTo: '/lobby', pathMatch: 'full' },
  { path: '**', redirectTo: '/lobby' }
];
