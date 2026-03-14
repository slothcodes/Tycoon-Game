// src/utils/storage.js
import { GameState } from '../core/GameState.js';

const SAVE_KEY = 'boardroom_tycoon_save';

export function saveGame() {
  try {
    const serialized = JSON.stringify(GameState);
    localStorage.setItem(SAVE_KEY, serialized);
  } catch (e) {
    console.error("Failed to save game:", e);
  }
}

export function loadGame() {
  try {
    const serialized = localStorage.getItem(SAVE_KEY);
    if (serialized) {
      const data = JSON.parse(serialized);
      Object.assign(GameState, data);
      return true;
    }
  } catch (e) {
    console.error("Failed to load game:", e);
  }
  return false;
}

export function clearGame() {
  localStorage.removeItem(SAVE_KEY);
}
