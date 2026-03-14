import { GameState } from './GameState.js';
import { randomGaussian } from '../utils/math.js';
import { EventBus } from './EventBus.js';

export const Market = {
  tick() {
    GameState.market.day += 1;

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
