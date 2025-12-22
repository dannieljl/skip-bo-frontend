import { Routes } from '@angular/router';
import {LobbyComponent} from './features/lobby/lobby.component.js';
import { GameBoardComponent } from './features/game-board/game-board.component';
export const routes: Routes = [

  { path: 'lobby', component: LobbyComponent },
  { path: 'game/:id', component: GameBoardComponent },
  { path: '', redirectTo: '/lobby', pathMatch: 'full' },
  { path: '**', redirectTo: '/lobby' }
];
