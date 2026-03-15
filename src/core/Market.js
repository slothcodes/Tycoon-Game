import { GameState } from './GameState.js';
import { randomGaussian } from '../utils/math.js';
import { EventBus } from './EventBus.js';
import { MACRO_CONFIG } from '../utils/config.js';

export const Market = {
  tick() {
    GameState.market.day += 1;

    // Macro Economic Cycle Update
    GameState.market.macro.economicCycle += 1;

    // Calculate GDP Growth
    GameState.market.macro.gdpGrowth = 0.02 +
      (Math.sin(GameState.market.macro.economicCycle * 0.1) * 0.03) +
      (randomGaussian() * MACRO_CONFIG.gdpVolatility);

    // Update Inflation
    const inflationTarget = GameState.market.macro.gdpGrowth;
    GameState.market.macro.inflation += (inflationTarget - GameState.market.macro.inflation) * 0.1 + (randomGaussian() * 0.005);

    // Central Bank Logic
    if (GameState.market.macro.inflation > MACRO_CONFIG.targetInflation) {
      GameState.market.macro.interestRate += 0.0025;
    }
    if (GameState.market.macro.gdpGrowth < 0) {
      GameState.market.macro.interestRate -= 0.0025;
    }

    // Ensure bounds for interest rate
    GameState.market.macro.interestRate = Math.max(0, GameState.market.macro.interestRate);

    // Global sentiment drift (slowly mean-reverting)
    const drift = (1.0 - GameState.market.globalSentiment) * 0.05;
    const shock = randomGaussian() * 0.02; // Global volatility
    GameState.market.globalSentiment += drift + shock;
    GameState.market.globalSentiment = Math.max(0.5, Math.min(1.5, GameState.market.globalSentiment));

    // Sector-specific updates (slow drift)
    for (const sector in GameState.market.sectors) {
      const s = GameState.market.sectors[sector];
      const sectorDrift = (1.0 - s.multiplier) * 0.02;
      const sectorShock = randomGaussian() * s.volatility * 0.1;
      s.multiplier += sectorDrift + sectorShock;
      s.multiplier = Math.max(0.5, Math.min(2.0, s.multiplier));
    }

    // Tick all companies
    GameState.companies.forEach(company => {
      company.tick();
    });

    EventBus.emit('MARKET_UPDATED', GameState);
  }
};
