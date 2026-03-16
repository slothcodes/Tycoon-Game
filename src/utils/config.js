export const MACRO_CONFIG = {
  targetInflation: 0.02,
  baseInterestRate: 0.05,
  gdpVolatility: 0.01,
  sectorSensitivities: {
    Tech: { rateSensitivity: 1.5 },
    Energy: { rateSensitivity: 0.5 },
    Retail: { rateSensitivity: 1.0 }
  },
  phases: ['Expansion', 'Peak', 'Contraction', 'Trough'],
  phaseDurations: {
    Expansion: { min: 40, max: 80, gdpTarget: 0.04, inflationTarget: 0.03 },
    Peak: { min: 10, max: 30, gdpTarget: 0.02, inflationTarget: 0.05 },
    Contraction: { min: 20, max: 50, gdpTarget: -0.02, inflationTarget: 0.01 },
    Trough: { min: 10, max: 30, gdpTarget: 0.00, inflationTarget: -0.01 }
  }
};

export const MACRO_LOGIC = {
  fedMeetingInterval: 30, // Ticks between rate decisions
  rateDragOnGDP: 0.15,    // Every 1% of interest reduces GDP growth by 0.15%
  rateCoolingOnInf: 0.2,  // Every 1% of interest reduces Inflation by 0.2%
  gdpHeatOnInf: 0.1       // Every 1% of GDP growth adds 0.1% to Inflation
};

export const CREDIT_RATING_SPREADS = {
  AAA: 0.005,
  AA: 0.01,
  A: 0.015,
  BBB: 0.025,
  BB: 0.04,
  B: 0.06,
  CCC: 0.09,
  Junk: 0.15
};

export const SECTOR_COMMODITY_EXPOSURE = {
  Tech: { energy: 0.1, tech: 0.6 },
  Energy: { energy: -0.8, tech: 0.1 }, // Negative means they benefit from high prices
  Retail: { energy: 0.3, tech: 0.2 }
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
  maxPriceHistory: 100,
  ipoChancePerTick: 0.02,
  maxCompanies: 20
};
