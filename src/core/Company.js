import { randomGaussian } from '../utils/math.js';
import { GAME_CONFIG, CREDIT_RATING_SPREADS, SECTOR_COMMODITY_EXPOSURE } from '../utils/config.js';
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
    // Only reset dividendYield if the player hasn't just forced one this tick
    if (this.strategy !== 'Player Directed (Dividend Forced)') {
      this.dividendYield = 0;
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
    } else if (this.cashOnHand > this.revenue * 0.5) {
      // High cash reserves
      if (GameState.market.economicPhase === 'Expansion' || GameState.market.economicPhase === 'Peak') {
        this.strategy = 'Aggressive Growth (CapEx)';
        // Invest in growth
        const investment = this.cashOnHand * 0.3;
        this.cashOnHand -= investment;
        this.fixedCosts += investment * 0.05; // CapEx increases fixed costs slightly
        this.revenue *= 1.05; // Immediate bump to future revenue capacity

        // Maybe issue cheap debt to fund more growth if rating is good
        if (macroRate < 0.04 && (this.creditRating === 'AAA' || this.creditRating === 'AA')) {
            const newDebt = this.revenue * 0.2;
            this.totalDebt += newDebt;
            this.cashOnHand += newDebt;
        }
      } else {
        // Contraction/Trough: Return capital to shareholders
        if (Math.random() > 0.5) {
          this.strategy = 'Returning Capital (Dividends)';
          const dividendPool = this.cashOnHand * 0.2;
          this.cashOnHand -= dividendPool;
          const dps = dividendPool / this.sharesOutstanding;
          this.dividendYield = (dps / this.price) * 100; // Annualized proxy

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

    // 1. Gross Revenue Update & Commodity Impact
    const gdpGrowth = GameState.market?.macro?.gdpGrowth || 0;
    this.revenue = this.revenue * (1 + gdpGrowth + (sectorMultiplier * 0.01));

    // Calculate operating margin impact from commodities
    let effectiveMargin = this.operatingMargin;
    if (GameState.market.commodities && SECTOR_COMMODITY_EXPOSURE[this.sector]) {
      const exposure = SECTOR_COMMODITY_EXPOSURE[this.sector];
      // If energyCost > 1.0, and exposure is positive, it hurts margins.
      const energyImpact = (GameState.market.commodities.energyCost - 1.0) * exposure.energy;
      const techImpact = (GameState.market.commodities.techCost - 1.0) * exposure.tech;
      effectiveMargin -= (energyImpact + techImpact) * 0.1; // scale down impact
    }

    const operatingIncome = (this.revenue * effectiveMargin) - this.fixedCosts;

    // 2. Interest Expense
    const baseRate = GameState.market?.macro?.interestRate || 0.05;
    const spread = CREDIT_RATING_SPREADS[this.creditRating] || 0.025;
    const interestRate = baseRate + spread;
    const interestExpense = this.totalDebt * interestRate;

    this.updateCreditRating(interestExpense, operatingIncome);

    // 3. Net Income
    const netIncomeBeforeTax = operatingIncome - interestExpense;
    const netIncome = netIncomeBeforeTax * (1 - GAME_CONFIG.taxRate);

    this.capitalAllocation(netIncome, baseRate);

    // 4. Cash Flow
    this.cashOnHand += netIncome;

    // Bankruptcy Guard
    if (this.cashOnHand < 0 && this.creditRating === 'Junk') {
      this.negativeCashTicks++;
    } else if (this.cashOnHand > 0) {
      this.negativeCashTicks = 0;
    }

    if (this.negativeCashTicks > 12) {
      this.isBankrupt = true;
      return;
    }
    // 5. EPS
    this.eps = netIncome / this.sharesOutstanding;

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

    // Add Price Noise (+/- 0.5% jitter)
    const noise = 1 + (randomGaussian() * GAME_CONFIG.priceNoiseVolatility);

    let newPrice = fundamentalPrice * noise;

    // Ensure price doesn't drop below $0.01 to prevent bugs
    this.price = Math.max(newPrice, 0.01);

    this.priceHistory.push(this.price);
    if (this.priceHistory.length > GAME_CONFIG.maxPriceHistory) {
      this.priceHistory.shift();
    }
  }
}
