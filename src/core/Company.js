import { randomGaussian } from '../utils/math.js';
import { GAME_CONFIG, MACRO_CONFIG, CREDIT_RATING_SPREADS, SECTOR_COMMODITY_EXPOSURE } from '../utils/config.js';
import { GameState } from './GameState.js';
import { EventBus } from './EventBus.js';

export class Company {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.sector = data.sector;
    this.revenue = data.revenue;
    this.operatingMargin = data.operatingMargin;
    this.sharesOutstanding = data.sharesOutstanding;
    this.cashOnHand = data.cashOnHand;
    this.price = data.initialPrice;
    this.priceHistory = [data.initialPrice];
    this.epsHistory = [];
    this.eps = 0;
    this.isPlayerControlled = false;
    this.totalDebt = data.totalDebt || 0;
    this.fixedCosts = data.fixedCosts || 0;
    this.negativeCashTicks = 0;

    this.creditRating = 'BBB';
    this.strategy = 'Balanced';
    this.dividendYield = 0;
    this.hype = 1.0;
    this.isBankrupt = false;

    // Information Asymmetry
    this.reportedRevenue = this.revenue;
    this.reportedEps = 0; // Initialize at next tick
    this.analystEstimates = { revenue: this.revenue, eps: 0 };
  }

  updateCreditRating(interestExpense, operatingIncome) {
    if (interestExpense === 0) {
      this.creditRating = 'AAA';
      return;
    }

    const icr = operatingIncome / interestExpense;
    if (icr > 8.5) this.creditRating = 'AAA';
    else if (icr > 6.5) this.creditRating = 'AA';
    else if (icr > 5.0) this.creditRating = 'A';
    else if (icr > 3.0) this.creditRating = 'BBB';
    else if (icr > 2.0) this.creditRating = 'BB';
    else if (icr > 1.25) this.creditRating = 'B';
    else if (icr > 0.5) this.creditRating = 'CCC';
    else this.creditRating = 'Junk';
  }

  capitalAllocation(netIncome, macroRate) {
    // Decay dividend yield so it's visible in UI, rather than instant reset
    if (this.dividendYield > 0 && this.strategy !== 'Player Directed (Dividend Forced)') {
       // Decay by a small amount each tick, eventually resetting to 0
       this.dividendYield *= 0.95;
       if (this.dividendYield < 0.001) this.dividendYield = 0;
    }

    if (this.isPlayerControlled) {
      if (this.strategy !== 'Player Directed (Dividend Forced)') {
        this.strategy = 'Player Directed';
      }
      // If player directed, automated actions are paused except basic debt maintenance
      if (this.creditRating === 'Junk' || this.creditRating === 'CCC') {
        // Forced debt paydown if distressed
        const paydown = Math.min(this.cashOnHand * 0.5, this.totalDebt);
        if (paydown > 0) {
            this.totalDebt -= paydown;
            this.cashOnHand -= paydown;
        }
      }
      return;
    }

    if (this.creditRating === 'Junk' || this.creditRating === 'CCC') {
      this.strategy = 'Distressed / Deleveraging';
      // Prioritize paying down debt
      const paydown = Math.min(this.cashOnHand * 0.8, this.totalDebt);
      if (paydown > 0) {
        this.totalDebt -= paydown;
        this.cashOnHand -= paydown;
      }
    } else if (this.cashOnHand > this.revenue * 0.3) {
      // Moderate/High cash reserves

      const inGrowthPhase = GameState.market.economicPhase === 'Expansion' || GameState.market.economicPhase === 'Peak';

      // If in growth phase, mostly invest in CapEx, but mature companies might still pay dividends
      // If in contraction phase, mostly return capital, but maybe some conservative growth
      const returnCapitalChance = inGrowthPhase ? 0.2 : 0.8;

      if (Math.random() > returnCapitalChance) {
        this.strategy = 'Aggressive Growth (CapEx)';
        // Invest in growth
        const investment = this.cashOnHand * 0.3;
        this.cashOnHand -= investment;
        this.fixedCosts += investment * 0.05;
        this.revenue *= 1.05;

        if (macroRate < 0.04 && (this.creditRating === 'AAA' || this.creditRating === 'AA')) {
            const newDebt = this.revenue * 0.2;
            this.totalDebt += newDebt;
            this.cashOnHand += newDebt;
        }
      } else {
        // Return capital to shareholders
        if (Math.random() > 0.5) {
          this.strategy = 'Returning Capital (Dividends)';
          const dividendPool = this.cashOnHand * 0.2;
          this.cashOnHand -= dividendPool;
          const dps = dividendPool / this.sharesOutstanding;

          // Set yield, but only if it's noticeably higher than current decaying yield
          const newYield = (dps / this.price) * 100;
          if (newYield > this.dividendYield) {
              this.dividendYield = newYield;
          }

          // Pay player
          if (GameState.player.portfolio[this.id]) {
            const playerShares = GameState.player.portfolio[this.id].shares;
            const payout = playerShares * dps;
            GameState.player.cash += payout;
            GameState.player.totalDividends += payout;
            EventBus.emit('NEWS_ALERT', `${this.name} paid a dividend. You received $${payout.toFixed(2)}.`);
          }
        } else {
          this.strategy = 'Returning Capital (Buybacks)';
          // Stock Buyback
          const buybackPool = this.cashOnHand * 0.2;
          this.cashOnHand -= buybackPool;
          const sharesBought = Math.floor(buybackPool / this.price);
          this.sharesOutstanding = Math.max(100000, this.sharesOutstanding - sharesBought);
        }
      }
    } else {
       this.strategy = 'Maintaining Operations';
    }
  }

  tick() {
    if (this.isBankrupt) return;

    const sectorData = GameState.market.sectors[this.sector];
    const sectorVolatility = sectorData.volatility; // Retained if needed
    const sectorMultiplier = sectorData.multiplier;
    const globalSentiment = GameState.market.globalSentiment;

    const gdpGrowth = GameState.market?.macro?.gdpGrowth || 0;
    const inflation = GameState.market?.macro?.inflation || 0;
    const interestRate = GameState.market?.macro?.interestRate || 0.05;

    // Sector-Specific Drag: Hit revenue harder based on interest rates
    const rateSensitivity = MACRO_CONFIG.sectorSensitivities?.[this.sector]?.rateSensitivity || 1.0;
    const rateDrag = interestRate * rateSensitivity;

    // Diminishing returns: As revenue gets massive, growth naturally slows down (market saturation)
    const saturationFactor = Math.max(0, 1 - (this.revenue / 10000000000)); // starts slowing at 10B

    // 1. Gross Revenue Update (Nominal GDP = Real GDP + Inflation) & Commodity Impact
    const nominalGdpGrowth = gdpGrowth + inflation;

    // Scale down growth to daily levels (360 financial days in a year)
    let dailyRevenueGrowth = (nominalGdpGrowth - rateDrag + (sectorMultiplier * 0.01)) / 360;

    // Apply saturation to positive growth only
    if (dailyRevenueGrowth > 0) {
        dailyRevenueGrowth *= saturationFactor;
    }

    this.revenue = this.revenue * (1 + dailyRevenueGrowth);

    // Calculate operating margin impact from commodities
    let effectiveMargin = this.operatingMargin;
    if (GameState.market.commodities && SECTOR_COMMODITY_EXPOSURE[this.sector]) {
      const exposure = SECTOR_COMMODITY_EXPOSURE[this.sector];
      // If energyCost > 1.0, and exposure is positive, it hurts margins.
      const energyImpact = (GameState.market.commodities.energyCost - 1.0) * exposure.energy;
      const techImpact = (GameState.market.commodities.techCost - 1.0) * exposure.tech;
      effectiveMargin -= (energyImpact + techImpact) * 0.1; // scale down impact
    }

    // Inflation-Linked Expenses scaled daily
    this.fixedCosts *= (1 + (inflation / 360));

    // Scale operational calculations to daily
    const dailyRevenue = this.revenue / 360;
    const dailyFixedCosts = this.fixedCosts / 360;

    const operatingIncome = (dailyRevenue * effectiveMargin) - dailyFixedCosts;

    // 2. Interest Expense
    const baseRate = interestRate; // from top
    const spread = CREDIT_RATING_SPREADS[this.creditRating] || 0.025;
    const effectiveInterestRate = baseRate + spread;
    const dailyInterestExpense = (this.totalDebt * effectiveInterestRate) / 360;

    // Use annualized numbers for rating
    this.updateCreditRating(dailyInterestExpense * 360, operatingIncome * 360);

    // 3. Net Income
    const netIncomeBeforeTax = operatingIncome - dailyInterestExpense;
    const netIncome = netIncomeBeforeTax * (1 - GAME_CONFIG.taxRate);

    // Only run automated capital allocations once per quarter (90 days)
    if (GameState.market.day % 90 === 0) {
        this.capitalAllocation(netIncome * 90, baseRate); // Provide quarterly income
    } else {
        // Decay dividend yield anyway so it doesn't get stuck
        if (this.dividendYield > 0 && this.strategy !== 'Player Directed (Dividend Forced)') {
           this.dividendYield *= 0.95;
           if (this.dividendYield < 0.001) this.dividendYield = 0;
        }
    }

    // 4. Cash Flow
    this.cashOnHand += netIncome;

    // Bankruptcy Guard - Now allowing more ticks to recover since ticks are just 1 day
    if (this.cashOnHand < 0 && this.creditRating === 'Junk') {
      this.negativeCashTicks++;
    } else if (this.cashOnHand > 0) {
      this.negativeCashTicks = 0;
    }

    if (this.negativeCashTicks > 30) {
      this.isBankrupt = true;
      return;
    }
    // 5. EPS
    // Provide annualized EPS estimate instead of daily for better valuation
    this.eps = (netIncome * 360) / this.sharesOutstanding;

    // Handle Fog of War & Analyst Estimates (Quarterly Reporting)
    if (GameState.market.day % 30 === 0) {
        const prevEstimateRevenue = this.analystEstimates.revenue;
        const prevEstimateEps = this.analystEstimates.eps;

        this.reportedRevenue = this.revenue;
        this.reportedEps = this.eps;

        // Evaluate if company beat or missed estimates
        if (prevEstimateEps && this.reportedEps < prevEstimateEps * 0.95) {
            // Significant miss
            this.hype *= 0.8;
            EventBus.emit('NEWS_ALERT', `EARNINGS MISS: ${this.name} missed EPS estimates by a wide margin.`);
        } else if (prevEstimateEps && this.reportedEps > prevEstimateEps * 1.05) {
            // Significant beat
            this.hype *= 1.2;
            EventBus.emit('NEWS_ALERT', `EARNINGS BEAT: ${this.name} crushes EPS estimates!`);
        }

        // Generate next quarter's estimates (real value + up to +/- 10% error margin)
        const errorMarginRev = 1 + (randomGaussian() * 0.10);
        const errorMarginEps = 1 + (randomGaussian() * 0.10);

        // Assume slight growth for the estimate baseline
        this.analystEstimates.revenue = this.revenue * 1.02 * errorMarginRev;
        this.analystEstimates.eps = this.eps * 1.02 * errorMarginEps;
    }

    // Initialize estimates correctly on the very first tick if needed
    if (this.reportedEps === 0 && this.eps !== 0) {
       this.reportedEps = this.eps;
       this.analystEstimates.eps = this.eps * (1 + (randomGaussian() * 0.05));
    }

    // Manage EPS History for Trailing EPS
    this.epsHistory.push(this.eps);
    if (this.epsHistory.length > 4) {
      this.epsHistory.shift();
    }

    const trailingEPS = this.epsHistory.reduce((a, b) => a + b, 0);
    const sectorPE = sectorData.pe || 15;

    // Update Hype (mean reverting to 1.0, influenced by Fear & Greed)
    const hypeDrift = (1.0 - this.hype) * 0.1;
    const fgHype = (GameState.market.fearAndGreed - 50) / 500; // Small influence
    this.hype += hypeDrift + fgHype + (randomGaussian() * 0.05);
    this.hype = Math.max(0.2, Math.min(3.0, this.hype));

    // Valuation Algorithm
    const currentRate = GameState.market?.macro?.interestRate || 0.05;

    // Adjust PE based on Fear & Greed (Greed = higher PE)
    const fgMultiplier = 0.5 + (GameState.market.fearAndGreed / 100);
    const effectivePE = (sectorPE * fgMultiplier) * (1 / (1 + currentRate * 10));

    // Fundamental valuation
    let fundamentalPrice = ((Math.max(trailingEPS, 0.01) * effectivePE) * globalSentiment);

    // Apply Sector and Hype multipliers
    fundamentalPrice *= sectorMultiplier * this.hype;

    // Apply "Selling Pressure" / Valuation Cap
    // As fundamental price crosses certain high thresholds, it gets heavily compressed
    const softCap = GAME_CONFIG.softPriceCap || 500;
    if (fundamentalPrice > softCap) {
        // Compress everything above the soft cap
        const excess = fundamentalPrice - softCap;
        // Use a logarithmic or root function to squash the excess
        fundamentalPrice = softCap + (Math.sqrt(excess) * 10);
    }

    // Add Price Noise (+/- 0.5% jitter)
    const noise = 1 + (randomGaussian() * GAME_CONFIG.priceNoiseVolatility);

    let newPrice = fundamentalPrice * noise;

    // Ensure price doesn't drop below $0.01 to prevent bugs
    this.price = Math.max(newPrice, 0.01);

    this.priceHistory.push(this.price);
    if (this.priceHistory.length > GAME_CONFIG.maxPriceHistory) {
      this.priceHistory.shift();
    }

    // Check for Stock Split
    if (this.price > (GAME_CONFIG.stockSplitThreshold || 800)) {
        this.executeStockSplit();
    }
  }

  executeStockSplit() {
      // 2-for-1 Split
      const splitRatio = 2;

      this.sharesOutstanding *= splitRatio;
      this.price /= splitRatio;
      this.eps /= splitRatio;

      // Adjust history
      this.epsHistory = this.epsHistory.map(e => e / splitRatio);

      // Adjust analyst estimates so they don't automatically miss
      if (this.analystEstimates && this.analystEstimates.eps) {
          this.analystEstimates.eps /= splitRatio;
      }

      // We must adjust the price history so the chart doesn't look like a crash
      this.priceHistory = this.priceHistory.map(p => p / splitRatio);

      // Update Player Portfolio
      if (GameState.player.portfolio[this.id]) {
          const holding = GameState.player.portfolio[this.id];
          holding.shares *= splitRatio;
          holding.averageCost /= splitRatio;
      }

      EventBus.emit('NEWS_ALERT', `STOCK SPLIT: ${this.name} announces a 2-for-1 stock split!`);
      // Emit an update event so UI charts redraw immediately
      EventBus.emit('MARKET_UPDATED', GameState);
  }
}
