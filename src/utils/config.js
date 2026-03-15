export const MACRO_CONFIG = {
  targetInflation: 0.02,
  baseInterestRate: 0.05,
  gdpVolatility: 0.01,
  sectorSensitivities: {
    Tech: { rateSensitivity: 1.5 },
    Energy: { rateSensitivity: 0.5 },
    Retail: { rateSensitivity: 1.0 }
  }
};

export const MACRO_LOGIC = {
  fedMeetingInterval: 30, // Ticks between rate decisions
  rateDragOnGDP: 0.15,    // Every 1% of interest reduces GDP growth by 0.15%
  rateCoolingOnInf: 0.2,  // Every 1% of interest reduces Inflation by 0.2%
  gdpHeatOnInf: 0.1       // Every 1% of GDP growth adds 0.1% to Inflation
};

export const GAME_CONFIG = {
  tickRateMs: 2000,
  startingCash: 1000000,
  startingNetWorth: 1000000,
  bankruptcyNetWorthThreshold: 500000,
  monopolyThreshold: 0.51,
  ownershipNewsThreshold: 0.05,
  taxRate: 0.20,
  priceNoiseVolatility: 0.005, // 0.5% random jitter
  slippageFactor: 0.5,
  saveIntervalTicks: 10,
  maxPriceHistory: 100
};
