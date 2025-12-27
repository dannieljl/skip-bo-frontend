import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RpsMinigameComponent } from './rps-minigame.component.js';

describe('RpsMinigameComponent', () => {
  let component: RpsMinigameComponent;
  let fixture: ComponentFixture<RpsMinigameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RpsMinigameComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RpsMinigameComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
