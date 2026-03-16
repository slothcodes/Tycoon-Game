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

    // Handle Bankruptcies (Delisting & Replacement)
    const activeCompanies = [];
    GameState.companies.forEach(company => {
      // If a company has been bankrupt for too long (12 ticks negative cash), delist it
      if (company.negativeCashTicks > 12) {
        EventBus.emit('NEWS_ALERT', `BANKRUPTCY: ${company.name} has been delisted.`);
        EventBus.emit('BANKRUPTCY', company.id);

        // Wipe out player's shares
        if (GameState.player.portfolio[company.id]) {
          delete GameState.player.portfolio[company.id];
          EventBus.emit('NEWS_ALERT', `Your shares in ${company.name} are now worthless.`);
        }

        // Spawn a replacement company in the same sector
        const newCompanyData = {
          id: `COMP_${company.sector.substring(0, 3).toUpperCase()}_${Date.now()}`,
          name: `${company.sector} Innovations ${Math.floor(Math.random() * 1000)}`,
          sector: company.sector,
          revenue: company.revenue * 0.5, // Start smaller
          operatingMargin: 0.10, // Fresh start margin
          sharesOutstanding: company.sharesOutstanding,
          cashOnHand: company.sharesOutstanding * 2, // Decent cash buffer
          initialPrice: 10.00, // IPO price
          totalDebt: 0, // Clean slate
          fixedCosts: company.fixedCosts * 0.5
        };

        // Dynamic import to prevent circular dependencies if not needed, or just use the Company class
        // Since we are in Market.js and Company.js depends on Market, let's just emit an event to main.js to handle the instantiation, or just require it if safe.
        // Actually, we can import Company at the top of Market.js. Let's add the import.

        EventBus.emit('SPAWN_COMPANY', newCompanyData);
      } else {
        activeCompanies.push(company);
      }
    });

    if (activeCompanies.length !== GameState.companies.length) {
      GameState.companies = activeCompanies;
    }

    EventBus.emit('MARKET_UPDATED', GameState);
  }
};
