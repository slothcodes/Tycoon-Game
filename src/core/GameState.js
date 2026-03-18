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
    netWorth: GAME_CONFIG.startingNetWorth,
    totalDividends: 0
  },
  market: {
    day: 1,
    globalSentiment: 1.0,
    fearAndGreed: 50, // 0-100 scale
    economicPhase: 'Expansion',
    marketRegime: 'Stagnant', // Bull, Bear, Crisis, Stagnant
    phaseTicksRemaining: 50,
    commodities: {
      energyCost: 1.0,
      techCost: 1.0
    },
    macro: {
      interestRate: 0.05,
      inflation: 0.02,
      gdpGrowth: 0.02,
      economicCycle: 0
    },
    sectors: {
      Tech: { multiplier: 1.2, volatility: 0.05, pe: 25 },
      Energy: { multiplier: 0.8, volatility: 0.08, pe: 10 },
      Retail: { multiplier: 1.0, volatility: 0.03, pe: 15 }
    },
    catalysts: []
  },
  rivals: [
    { id: 'rival_1', name: 'Vanguard Group', cash: 50000000, portfolio: {} },
    { id: 'rival_2', name: 'BlackRock', cash: 100000000, portfolio: {} },
    { id: 'rival_3', name: 'State Street', cash: 75000000, portfolio: {} }
  ],
  companies: []
};
