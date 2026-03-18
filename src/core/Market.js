import { GameState } from './GameState.js';
import { randomGaussian } from '../utils/math.js';
import { EventBus } from './EventBus.js';
import { MACRO_CONFIG, MACRO_LOGIC, GAME_CONFIG } from '../utils/config.js';
import { Company } from './Company.js';
import { Player } from './Player.js';
import { Rivals } from './Rivals.js';

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
      GameState.market.marketRegime = 'Bull';
      GameState.market.phaseTicksRemaining = 50;
      GameState.market.fearAndGreed = 50;
      GameState.market.commodities = { energyCost: 1.0, techCost: 1.0 };
    }

    // Regime Transitions (Markov Chain style)
    if (Math.random() < 0.02) {
       const regimes = ['Bull', 'Bear', 'Stagnant', 'Crisis'];
       const currentRegime = GameState.market.marketRegime || 'Stagnant';
       let nextRegime = currentRegime;

       // Simple transition logic
       if (currentRegime === 'Bull' && Math.random() > 0.7) nextRegime = 'Bear';
       else if (currentRegime === 'Bear' && Math.random() > 0.6) nextRegime = 'Stagnant';
       else if (currentRegime === 'Stagnant' && Math.random() > 0.5) nextRegime = 'Bull';
       else if (currentRegime !== 'Crisis' && Math.random() > 0.95) nextRegime = 'Crisis';
       else if (currentRegime === 'Crisis' && Math.random() > 0.2) nextRegime = 'Bear';

       if (nextRegime !== currentRegime) {
           GameState.market.marketRegime = nextRegime;
           EventBus.emit('NEWS_ALERT', `MARKET REGIME SHIFT: The market has entered a ${nextRegime} phase.`);
       }
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

    // GDP updates once a quarter (90 days)
    if (GameState.market.day % 90 === 0) {
        let baseCycleGrowth = phaseConfig.gdpTarget;

        // Regime modifiers on GDP
        if (GameState.market.marketRegime === 'Bull') baseCycleGrowth += 0.02;
        else if (GameState.market.marketRegime === 'Bear') baseCycleGrowth -= 0.02;
        else if (GameState.market.marketRegime === 'Crisis') baseCycleGrowth -= 0.06;

        const interestRateDrag = GameState.market.macro.interestRate * MACRO_LOGIC.rateDragOnGDP;

        let gdpVol = MACRO_CONFIG.gdpVolatility;
        if (GameState.market.marketRegime === 'Crisis') gdpVol *= 3;

        const gdpNoise = randomGaussian() * gdpVol;
        GameState.market.macro.gdpGrowth += ((baseCycleGrowth - interestRateDrag) - GameState.market.macro.gdpGrowth) * 0.5 + gdpNoise;
    }

    // Inflation updates once a month (30 days)
    if (GameState.market.day % 30 === 0) {
        const gdpHeat = GameState.market.macro.gdpGrowth * MACRO_LOGIC.gdpHeatOnInf;
        const interestRateCooling = GameState.market.macro.interestRate * MACRO_LOGIC.rateCoolingOnInf;
        const inflationNoise = randomGaussian() * 0.005;
        const inflationTarget = (Math.max(0, gdpHeat - interestRateCooling) + phaseConfig.inflationTarget) / 2;
        GameState.market.macro.inflation += (inflationTarget - GameState.market.macro.inflation) * 0.5 + inflationNoise;
        GameState.market.macro.inflation = Math.max(0, GameState.market.macro.inflation);
    }

    // Fear and Greed Index Update
    let fearGreedDrift = 0;
    if (GameState.market.economicPhase === 'Expansion') {
      fearGreedDrift = 1;
    } else if (GameState.market.economicPhase === 'Contraction') {
      fearGreedDrift = -1;
    } else if (GameState.market.economicPhase === 'Peak') {
      fearGreedDrift = 0.5;
    } else {
      fearGreedDrift = -0.5;
    }

    fearGreedDrift += randomGaussian() * 2;
    GameState.market.fearAndGreed = Math.max(0, Math.min(100, GameState.market.fearAndGreed + fearGreedDrift));

    // Commodities Update
    let commodityDrift = (GameState.market.economicPhase === 'Expansion' || GameState.market.economicPhase === 'Peak') ? 0.01 : -0.01;
    GameState.market.commodities.energyCost += commodityDrift + (randomGaussian() * 0.02);
    GameState.market.commodities.energyCost = Math.max(0.5, Math.min(2.0, GameState.market.commodities.energyCost));

    GameState.market.commodities.techCost += (commodityDrift * 0.5) + (randomGaussian() * 0.015);
    GameState.market.commodities.techCost = Math.max(0.5, Math.min(2.0, GameState.market.commodities.techCost));

    // Step C: Central Bank Logic (Fed Meeting)
    // Runs when fedMeetingInterval hits, evaluating the "Dual Mandate"
    if (GameState.market.day % MACRO_LOGIC.fedMeetingInterval === 0) {
      const inflationDiff = GameState.market.macro.inflation - MACRO_CONFIG.targetInflation;
      const gdpDiff = GameState.market.macro.gdpGrowth - MACRO_CONFIG.targetGdp;

      let rateChange = 0;

      // Dual Mandate evaluation
      if (inflationDiff > 0.01) {
          // Inflation is high, prioritize hiking
          rateChange = 0.0025;
      } else if (gdpDiff < -0.01) {
          // GDP is crashing, prioritize cutting
          rateChange = -0.0025;
      } else if (inflationDiff > 0.005 && gdpDiff >= 0) {
          // Economy is okay, but inflation slightly high
          rateChange = 0.0025;
      } else if (inflationDiff < -0.005 && gdpDiff < 0) {
          // Deflation and contraction risk
          rateChange = -0.0025;
      }

      if (rateChange !== 0) {
          GameState.market.macro.interestRate += rateChange;
          GameState.market.macro.interestRate = Math.max(0, GameState.market.macro.interestRate);
      }
    }

    // Ensure bounds for interest rate
    GameState.market.macro.interestRate = Math.max(0, GameState.market.macro.interestRate);

    // Global sentiment drift driven by Regime
    let sentimentTarget = 1.0;
    let shockVol = 0.02;
    if (GameState.market.marketRegime === 'Bull') sentimentTarget = 1.2;
    else if (GameState.market.marketRegime === 'Bear') sentimentTarget = 0.8;
    else if (GameState.market.marketRegime === 'Crisis') { sentimentTarget = 0.5; shockVol = 0.1; }

    const drift = (sentimentTarget - GameState.market.globalSentiment) * 0.05;
    const shock = randomGaussian() * shockVol;
    GameState.market.globalSentiment += drift + shock;
    GameState.market.globalSentiment = Math.max(0.3, Math.min(1.8, GameState.market.globalSentiment));

    // Process Active Catalysts
    if (!GameState.market.catalysts) GameState.market.catalysts = [];
    const activeCatalysts = [];

    for (const cat of GameState.market.catalysts) {
        cat.ticksRemaining -= 1;
        if (cat.ticksRemaining > 0) {
            activeCatalysts.push(cat);
        }
    }
    GameState.market.catalysts = activeCatalysts;

    // Sector-specific updates
    for (const sector in GameState.market.sectors) {
      const s = GameState.market.sectors[sector];

      // Calculate sum of active catalyst shocks for this sector
      let catalystShockSum = 0;
      for (const cat of GameState.market.catalysts) {
          if (cat.sector === sector) {
              catalystShockSum += cat.shockValue;
          }
      }

      // Base drift depends on Fear & Greed somewhat
      const sentimentTarget = 0.5 + (GameState.market.fearAndGreed / 100);
      const sectorDrift = (sentimentTarget - s.multiplier) * 0.02;
      const sectorShock = randomGaussian() * s.volatility * 0.1;

      s.multiplier += sectorDrift + sectorShock + catalystShockSum;
      s.multiplier = Math.max(0.5, Math.min(2.5, s.multiplier)); // Increased max bound to allow for catalyst booms
    }

    // Procedural Catalyst Generator (5% chance per tick)
    if (Math.random() < 0.05) {
        const sectors = Object.keys(GameState.market.sectors);
        const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
        const isPositive = Math.random() > 0.5;

        const shockValue = isPositive ? 0.05 : -0.05; // Distributed over the lifespan, this is significant

        const headlines = {
            Tech: {
                pos: ["Tech sector booms on breakthrough AI algorithms", "Semiconductor shortage ends, Tech rallies", "Major government subsidies announced for Tech"],
                neg: ["Tech sector faces strict new regulatory fines", "Massive data breach hits top Tech firms", "Consumer demand for new Tech plummets"]
            },
            Energy: {
                pos: ["Energy sector surges on new oil discoveries", "Favorable legislation boosts Energy profits", "Global demand for Energy hits record highs"],
                neg: ["Energy sector slumps amid new carbon taxes", "Pipeline leak causes massive fines for Energy sector", "Alternative renewables crash traditional Energy markets"]
            },
            Retail: {
                pos: ["Retail spending hits all-time high this quarter", "Supply chain issues resolved, Retail rejoices", "Consumer confidence boosts Retail sector"],
                neg: ["Retail sales plummet amid inflation fears", "Major shipping delays cripple Retail inventory", "E-commerce giants crush traditional Retail margins"]
            }
        };

        const headlinePool = isPositive ? headlines[randomSector].pos : headlines[randomSector].neg;
        const headline = headlinePool[Math.floor(Math.random() * headlinePool.length)];

        GameState.market.catalysts.push({
            sector: randomSector,
            shockValue: shockValue,
            ticksRemaining: 20
        });

        EventBus.emit('NEWS_ALERT', `CATALYST: ${headline}`);
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

    // Run Rivals
    Rivals.tick();

    // Update player net worth automatically on every tick so holding values are live
    Player.recalculateNetWorth();
    if (portfolioChanged) {
        EventBus.emit('PLAYER_UPDATED', GameState.player);
    }

    // Handle IPOs
    if (Math.random() < GAME_CONFIG.ipoChancePerTick && GameState.companies.length < GAME_CONFIG.maxCompanies) {
      const sectors = Object.keys(GameState.market.sectors);
      const randomSector = sectors[Math.floor(Math.random() * sectors.length)];

      const prefixes = ["Global", "Apex", "Summit", "Quantum", "Nexus", "Horizon", "Pinnacle", "Aether", "Stellar", "Titan"];
      const techMid = ["Software", "Systems", "Cybernetics", "Data", "Networks"];
      const energyMid = ["Power", "Resources", "Petroleum", "Renewables", "Energy"];
      const retailMid = ["Brands", "Stores", "Mart", "Retail", "Goods"];
      const suffixes = ["Inc.", "Corp.", "Holdings", "Group", "LLC", "Ltd."];

      let mid = techMid;
      if (randomSector === 'Energy') mid = energyMid;
      else if (randomSector === 'Retail') mid = retailMid;

      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const middle = mid[Math.floor(Math.random() * mid.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

      const revenue = Math.random() * 500000000 + 50000000;
      const operatingMargin = Math.random() * 0.2 + 0.08; // 8% to 28% margin
      const grossProfit = revenue * operatingMargin;
      const fixedCosts = grossProfit * (Math.random() * 0.4 + 0.2); // 20-60% of gross profit
      const operatingIncome = grossProfit - fixedCosts;
      const totalDebt = Math.max(0, operatingIncome * (Math.random() * 3 + 1)); // 1x to 4x operating income

      const newCompanyData = {
        id: `COMP_${randomSector.substring(0,3).toUpperCase()}_${Date.now()}`,
        name: `${prefix} ${middle} ${suffix}`,
        sector: randomSector,
        revenue: revenue,
        operatingMargin: operatingMargin,
        sharesOutstanding: Math.floor(Math.random() * 50000000) + 10000000,
        cashOnHand: operatingIncome * (Math.random() * 2 + 1),
        initialPrice: Math.random() * 40 + 10,
        totalDebt: totalDebt,
        fixedCosts: fixedCosts
      };
      const newCompany = new Company(newCompanyData);
      GameState.companies.push(newCompany);
      EventBus.emit('NEWS_ALERT', `IPO: ${newCompany.name} has gone public!`);
    }



    EventBus.emit('MARKET_UPDATED', GameState);
  }
};
