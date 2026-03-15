import { randomGaussian } from '../utils/math.js';
import { GAME_CONFIG } from '../utils/config.js';
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
  }

  tick() {
    const sectorData = GameState.market.sectors[this.sector];
    const sectorVolatility = sectorData.volatility; // Retained if needed
    const sectorMultiplier = sectorData.multiplier;
    const globalSentiment = GameState.market.globalSentiment;

    // 1. Gross Revenue Update
    const gdpGrowth = GameState.market?.macro?.gdpGrowth || 0;
    const newRevenue = this.revenue * (1 + gdpGrowth + (sectorMultiplier * 0.01));
    this.revenue = newRevenue;

    // 2. Interest Expense
    const interestRate = GameState.market?.macro?.interestRate || 0.05;
    const interestExpense = this.totalDebt * interestRate;

    // 3. Net Income
    const netIncomeBeforeTax = (newRevenue * this.operatingMargin) - this.fixedCosts - interestExpense;
    const netIncome = netIncomeBeforeTax * (1 - GAME_CONFIG.taxRate);

    // 4. Cash Flow
    this.cashOnHand += netIncome;

    // Bankruptcy Guard
    if (this.cashOnHand < 0) {
      this.negativeCashTicks++;
    } else {
      this.negativeCashTicks = 0;
    }

    if (this.negativeCashTicks > 12) {
      EventBus.emit('NEWS_ALERT', `${this.name} has entered restructuring.`);
      this.negativeCashTicks = 0; // reset to avoid spam
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

    // Valuation Algorithm
    // Dynamic Valuation & Discounted Multipliers
    const currentRate = GameState.market?.macro?.interestRate || 0.05;
    const effectivePE = sectorPE * (1 / (1 + currentRate * 10));

    // Avoid negative or zero base valuation
    let fundamentalPrice = ((Math.max(trailingEPS, 0.01) * effectivePE) * globalSentiment);
    // Adjust based on sector multiplier
    fundamentalPrice *= sectorMultiplier;

    // Add Price Noise (+/- 0.5% jitter)
    const noise = 1 + (randomGaussian() * GAME_CONFIG.priceNoiseVolatility);

    // Final price
    let newPrice = fundamentalPrice * noise;

    // Ensure price doesn't drop below $0.01 to prevent bugs
    this.price = Math.max(newPrice, 0.01);

    this.priceHistory.push(this.price);
    if (this.priceHistory.length > GAME_CONFIG.maxPriceHistory) {
      this.priceHistory.shift();
    }
  }
}
