import { GAME_CONFIG } from '../utils/config.js';

export const GameState = {
  system: {
    tickRateMs: GAME_CONFIG.tickRateMs,
    status: "START_MENU",
    isPaused: true
  },
  player: {
    cash: GAME_CONFIG.startingCash,
    portfolio: {},
    netWorth: GAME_CONFIG.startingNetWorth
  },
  market: {
    day: 1,
    globalSentiment: 1.0,
    sectors: {
      Tech: { multiplier: 1.2, volatility: 0.05, pe: 25 },
      Energy: { multiplier: 0.8, volatility: 0.08, pe: 10 },
      Retail: { multiplier: 1.0, volatility: 0.03, pe: 15 }
    }
  },
  companies: []
};
