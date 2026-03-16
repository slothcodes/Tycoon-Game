import { GameState } from './GameState.js';
import { randomGaussian } from '../utils/math.js';
import { EventBus } from './EventBus.js';
import { MACRO_CONFIG, GAME_CONFIG } from '../utils/config.js';
import { Company } from './Company.js';

export const Market = {
  tick() {
    GameState.market.day += 1;

    // Initialize macro if not present (for old saves)
    if (!GameState.market.macro) {
      GameState.market.macro = {
        interestRate: 0.05,
        inflation: 0.02,
        gdpGrowth: 0.02,
        economicCycle: 0
      };
    }

    if (!GameState.market.economicPhase) {
      GameState.market.economicPhase = 'Expansion';
      GameState.market.phaseTicksRemaining = 50;
      GameState.market.fearAndGreed = 50;
      GameState.market.commodities = { energyCost: 1.0, techCost: 1.0 };
    }

    // Phase Transitions
    GameState.market.phaseTicksRemaining -= 1;
    if (GameState.market.phaseTicksRemaining <= 0) {
      const currentIdx = MACRO_CONFIG.phases.indexOf(GameState.market.economicPhase);
      const nextIdx = (currentIdx + 1) % MACRO_CONFIG.phases.length;
      GameState.market.economicPhase = MACRO_CONFIG.phases[nextIdx];

      const durationConfig = MACRO_CONFIG.phaseDurations[GameState.market.economicPhase];
      GameState.market.phaseTicksRemaining = Math.floor(Math.random() * (durationConfig.max - durationConfig.min + 1)) + durationConfig.min;

      EventBus.emit('NEWS_ALERT', `Economic shift: We are entering a period of ${GameState.market.economicPhase}.`);
    }

    const phaseConfig = MACRO_CONFIG.phaseDurations[GameState.market.economicPhase];

    // Calculate GDP Growth
    GameState.market.macro.gdpGrowth += (phaseConfig.gdpTarget - GameState.market.macro.gdpGrowth) * 0.1 + (randomGaussian() * MACRO_CONFIG.gdpVolatility);

    // Update Inflation
    GameState.market.macro.inflation += (phaseConfig.inflationTarget - GameState.market.macro.inflation) * 0.1 + (randomGaussian() * 0.005);

    // Fear and Greed Index Update
    let fearGreedDrift = 0;
    if (GameState.market.economicPhase === 'Expansion') fearGreedDrift = 1;
    else if (GameState.market.economicPhase === 'Contraction') fearGreedDrift = -1;
    else if (GameState.market.economicPhase === 'Peak') fearGreedDrift = 0.5;
    else fearGreedDrift = -0.5;

    fearGreedDrift += randomGaussian() * 2;
    GameState.market.fearAndGreed = Math.max(0, Math.min(100, GameState.market.fearAndGreed + fearGreedDrift));

    // Commodities Update
    const commodityDrift = (GameState.market.economicPhase === 'Expansion' || GameState.market.economicPhase === 'Peak') ? 0.01 : -0.01;
    GameState.market.commodities.energyCost += commodityDrift + (randomGaussian() * 0.02);
    GameState.market.commodities.energyCost = Math.max(0.5, Math.min(2.0, GameState.market.commodities.energyCost));

    GameState.market.commodities.techCost += (commodityDrift * 0.5) + (randomGaussian() * 0.015);
    GameState.market.commodities.techCost = Math.max(0.5, Math.min(2.0, GameState.market.commodities.techCost));

      EventBus.emit('NEWS_ALERT', `Economic shift: We are entering a period of ${GameState.market.economicPhase}.`);
    }

    const phaseConfig = MACRO_CONFIG.phaseDurations[GameState.market.economicPhase];

    // Step A: Calculate GDP first, factoring in the current Interest Rate as a penalty.
    const baseCycleGrowth = phaseConfig.gdpTarget;
    const interestRateDrag = GameState.market.macro.interestRate * MACRO_LOGIC.rateDragOnGDP;
    const gdpNoise = randomGaussian() * MACRO_CONFIG.gdpVolatility;
    GameState.market.macro.gdpGrowth += ((baseCycleGrowth - interestRateDrag) - GameState.market.macro.gdpGrowth) * 0.1 + gdpNoise;

    // Step B: Calculate Inflation based on the new GDP and current Interest Rate.
    const gdpHeat = GameState.market.macro.gdpGrowth * MACRO_LOGIC.gdpHeatOnInf;
    const interestRateCooling = GameState.market.macro.interestRate * MACRO_LOGIC.rateCoolingOnInf;
    const inflationNoise = randomGaussian() * 0.005;
    // Current inflation drifts towards the heat minus cooling, alongside phase target
    const inflationTarget = (Math.max(0, gdpHeat - interestRateCooling) + phaseConfig.inflationTarget) / 2;
    GameState.market.macro.inflation += (inflationTarget - GameState.market.macro.inflation) * 0.1 + inflationNoise;
    GameState.market.macro.inflation = Math.max(0, GameState.market.macro.inflation);

    // Fear and Greed Index Update
    let fearGreedDrift = 0;
    if (GameState.market.economicPhase === 'Expansion') fearGreedDrift = 1;
    else if (GameState.market.economicPhase === 'Contraction') fearGreedDrift = -1;
    else if (GameState.market.economicPhase === 'Peak') fearGreedDrift = 0.5;
    else fearGreedDrift = -0.5;

    fearGreedDrift += randomGaussian() * 2;
    GameState.market.fearAndGreed = Math.max(0, Math.min(100, GameState.market.fearAndGreed + fearGreedDrift));

    // Commodities Update
    const commodityDrift = (GameState.market.economicPhase === 'Expansion' || GameState.market.economicPhase === 'Peak') ? 0.01 : -0.01;
    GameState.market.commodities.energyCost += commodityDrift + (randomGaussian() * 0.02);
    GameState.market.commodities.energyCost = Math.max(0.5, Math.min(2.0, GameState.market.commodities.energyCost));

    GameState.market.commodities.techCost += (commodityDrift * 0.5) + (randomGaussian() * 0.015);
    GameState.market.commodities.techCost = Math.max(0.5, Math.min(2.0, GameState.market.commodities.techCost));

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

    // Sector-specific updates
    for (const sector in GameState.market.sectors) {
      const s = GameState.market.sectors[sector];
      // Base drift depends on Fear & Greed somewhat
      const sentimentTarget = 0.5 + (GameState.market.fearAndGreed / 100);
      const sectorDrift = (sentimentTarget - s.multiplier) * 0.02;
      const sectorShock = randomGaussian() * s.volatility * 0.1;
      s.multiplier += sectorDrift + sectorShock;
      s.multiplier = Math.max(0.5, Math.min(2.0, s.multiplier));
    }

    // Tick all companies
    const activeCompanies = [];
    let portfolioChanged = false;
    GameState.companies.forEach(company => {
      company.tick();
      if (!company.isBankrupt) {
        activeCompanies.push(company);
      } else {
        EventBus.emit('NEWS_ALERT', `BANKRUPTCY: ${company.name} has been delisted.`);
        // Clean up player portfolio
        if (GameState.player.portfolio[company.id]) {
          delete GameState.player.portfolio[company.id];
          portfolioChanged = true;
        }
      }
    });
    GameState.companies = activeCompanies;

    // Update player net worth automatically on every tick so holding values are live
    import('./Player.js').then(module => {
        module.Player.recalculateNetWorth();
        if (portfolioChanged) {
            EventBus.emit('PLAYER_UPDATED', GameState.player);
        }
    });
    GameState.companies = activeCompanies;

    // Update player net worth automatically on every tick so holding values are live
    import('./Player.js').then(module => {
        module.Player.recalculateNetWorth();
        if (portfolioChanged) {
            EventBus.emit('PLAYER_UPDATED', GameState.player);
        }
    });

    // Handle IPOs
    if (Math.random() < GAME_CONFIG.ipoChancePerTick && GameState.companies.length < GAME_CONFIG.maxCompanies) {
      const sectors = Object.keys(GameState.market.sectors);
      const randomSector = sectors[Math.floor(Math.random() * sectors.length)];

      const newCompanyData = {
        id: `COMP_${randomSector.substring(0,3).toUpperCase()}_${Date.now()}`,
        name: `New ${randomSector} Corp ${Math.floor(Math.random() * 1000)}`,
        sector: randomSector,
        revenue: Math.random() * 10000000 + 1000000,
        operatingMargin: Math.random() * 0.2 + 0.05,
        sharesOutstanding: Math.floor(Math.random() * 10000000) + 1000000,
        cashOnHand: Math.random() * 5000000 + 1000000,
        initialPrice: Math.random() * 40 + 10,
        totalDebt: Math.random() * 5000000,
        fixedCosts: Math.random() * 1000000 + 500000
      };
      const newCompany = new Company(newCompanyData);
      GameState.companies.push(newCompany);
      EventBus.emit('NEWS_ALERT', `IPO: ${newCompany.name} has gone public!`);
    }



    // Handle IPOs
    if (Math.random() < GAME_CONFIG.ipoChancePerTick && GameState.companies.length < GAME_CONFIG.maxCompanies) {
      const sectors = Object.keys(GameState.market.sectors);
      const randomSector = sectors[Math.floor(Math.random() * sectors.length)];

      const newCompanyData = {
        id: `COMP_${randomSector.substring(0,3).toUpperCase()}_${Date.now()}`,
        name: `New ${randomSector} Corp ${Math.floor(Math.random() * 1000)}`,
        sector: randomSector,
        revenue: Math.random() * 10000000 + 1000000,
        operatingMargin: Math.random() * 0.2 + 0.05,
        sharesOutstanding: Math.floor(Math.random() * 10000000) + 1000000,
        cashOnHand: Math.random() * 5000000 + 1000000,
        initialPrice: Math.random() * 40 + 10,
        totalDebt: Math.random() * 5000000,
        fixedCosts: Math.random() * 1000000 + 500000
      };
      const newCompany = new Company(newCompanyData);
      GameState.companies.push(newCompany);
      EventBus.emit('NEWS_ALERT', `IPO: ${newCompany.name} has gone public!`);
    }

    EventBus.emit('MARKET_UPDATED', GameState);
  }
};
