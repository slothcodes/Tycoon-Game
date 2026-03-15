import { GameState } from './GameState.js';
import { randomGaussian } from '../utils/math.js';
import { EventBus } from './EventBus.js';
import { MACRO_CONFIG, MACRO_LOGIC } from '../utils/config.js';

export const Market = {
  tick() {
    GameState.market.day += 1;

    // Macro Economic Cycle Update
    if (!GameState.market.macro) {
      GameState.market.macro = {
        interestRate: 0.05,
        inflation: 0.02,
        gdpGrowth: 0.02,
        economicCycle: 0
      };
    }

    GameState.market.macro.economicCycle += 1;

    // Step A: Calculate GDP first, factoring in the current Interest Rate as a penalty.
    const baseCycleGrowth = 0.02 + (Math.sin(GameState.market.macro.economicCycle * 0.1) * 0.03);
    const interestRateDrag = GameState.market.macro.interestRate * MACRO_LOGIC.rateDragOnGDP;
    const gdpNoise = randomGaussian() * MACRO_CONFIG.gdpVolatility;
    GameState.market.macro.gdpGrowth = baseCycleGrowth - interestRateDrag + gdpNoise;

    // Step B: Calculate Inflation based on the new GDP and current Interest Rate.
    const gdpHeat = GameState.market.macro.gdpGrowth * MACRO_LOGIC.gdpHeatOnInf;
    const interestRateCooling = GameState.market.macro.interestRate * MACRO_LOGIC.rateCoolingOnInf;
    const inflationNoise = randomGaussian() * 0.005;
    // Current inflation drifts towards the heat minus cooling.
    const inflationTarget = Math.max(0, gdpHeat - interestRateCooling);
    GameState.market.macro.inflation += (inflationTarget - GameState.market.macro.inflation) * 0.1 + inflationNoise;
    GameState.market.macro.inflation = Math.max(0, GameState.market.macro.inflation);

    // Step C: Central Bank Logic (Fed Meeting every 30 ticks)
    if (GameState.market.day % MACRO_LOGIC.fedMeetingInterval === 0) {
      const inflationDiff = GameState.market.macro.inflation - MACRO_CONFIG.targetInflation;
      // Change rates if deviation is > 0.5% (0.005)
      if (Math.abs(inflationDiff) > 0.005) {
        if (inflationDiff > 0) {
          GameState.market.macro.interestRate += 0.0025; // Hike
        } else {
          GameState.market.macro.interestRate -= 0.0025; // Cut
        }
      }
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
