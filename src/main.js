import { GameState } from './core/GameState.js';
import { Company } from './core/Company.js';
import { Market } from './core/Market.js';
import { SEED_COMPANIES } from './data/seed.js';
import { GAME_CONFIG } from './utils/config.js';
import { Dashboard } from './ui/Dashboard.js';
import { ChartCtrl } from './ui/ChartCtrl.js';
import { Ticker } from './ui/Ticker.js';
import { Toast } from './ui/Toast.js';
import { saveGame, loadGame, clearGame } from './utils/storage.js';
import { EventBus } from './core/EventBus.js';

let gameLoopInterval = null;
let chartCtrl = null;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
}

function playBeep(freq = 440, type = 'sine', duration = 0.1) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

function checkWinLoss() {
  // Loss Condition
  if (GameState.player.cash <= 0 && GameState.player.netWorth < GAME_CONFIG.bankruptcyNetWorthThreshold) {
    pauseGame();
    clearGame();
    document.getElementById('game-over-modal').classList.remove('hidden');
    playBeep(150, 'sawtooth', 1);
    return;
  }

  // Win Condition
  const controlledCount = GameState.companies.filter(c => c.isPlayerControlled).length;
  if (controlledCount === GameState.companies.length && GameState.companies.length > 0) {
    pauseGame();
    clearGame();
    document.getElementById('victory-modal').classList.remove('hidden');
    playBeep(880, 'sine', 0.5);
    setTimeout(() => playBeep(1046, 'sine', 1), 200);
    return;
  }
}

function gameLoop() {
  if (GameState.system.isPaused) return;

  Market.tick();

  if (GameState.market.day % GAME_CONFIG.saveIntervalTicks === 0) {
    saveGame();
  }

  checkWinLoss();
}

function startGame() {
  GameState.system.isPaused = false;
  document.getElementById('onboarding-modal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  if (!gameLoopInterval) {
    gameLoopInterval = setInterval(gameLoop, GAME_CONFIG.tickRateMs);
  }
}

function pauseGame() {
  GameState.system.isPaused = true;
}

function resumeGame() {
  if (GameState.system.status !== 'START_MENU') {
    GameState.system.isPaused = false;
  }
}

function init() {
  // Check save
  const hasSave = loadGame();

  if (!hasSave) {
    // Instantiate seed data
    GameState.companies = SEED_COMPANIES.map(data => new Company(data));
  } else {
    // Rehydrate objects
    GameState.companies = GameState.companies.map(data => {
      const c = new Company(data);
      Object.assign(c, data);
      return c;
    });

    // Migrate old saves: Add missing macro object if it doesn't exist
    if (!GameState.market.macro) {
      GameState.market.macro = {
        interestRate: 0.05,
        inflation: 0.02,
        gdpGrowth: 0.02,
        economicCycle: 0
      };
    }
  }

  // Init UI
  Dashboard.init();
  Ticker.init();
  Toast.init();
  chartCtrl = new ChartCtrl('stock-chart');

  // Bind Audio
  EventBus.on('TRADE_SUCCESS', () => playBeep(600, 'sine', 0.1));
  EventBus.on('TRADE_ERROR', () => playBeep(200, 'square', 0.2));
  EventBus.on('NEWS_ALERT', () => playBeep(400, 'triangle', 0.1));

  // Modals
  document.getElementById('start-game-btn').addEventListener('click', () => {
    GameState.system.status = 'PLAYING';
    startGame();
  });

  document.getElementById('restart-game-btn').addEventListener('click', () => location.reload());
  document.getElementById('play-again-btn').addEventListener('click', () => location.reload());

  // Visibility changes
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseGame();
    } else {
      if (document.getElementById('app').classList.contains('hidden') === false) {
        resumeGame();
      }
    }
  });

  // Dev Tools
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      GameState.player.cash += 1000000;
      EventBus.emit('PLAYER_UPDATED');
      EventBus.emit('NEWS_ALERT', '[DEV] Added $1M');
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
