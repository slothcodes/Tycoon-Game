import { randomGaussian } from '../utils/math.js';
import { GAME_CONFIG } from '../utils/config.js';
import { GameState } from './GameState.js';

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
  }

  tick() {
    const sectorData = GameState.market.sectors[this.sector];
    const sectorVolatility = sectorData.volatility;
    const sectorMultiplier = sectorData.multiplier;
    const globalSentiment = GameState.market.globalSentiment;

    // 1. Gross Revenue Update
    this.revenue = this.revenue * (1 + (randomGaussian() * sectorVolatility));

    // 2. Operating Income
    const ebitda = this.revenue * this.operatingMargin;

    // 3. Net Income
    const netIncome = ebitda * (1 - GAME_CONFIG.taxRate);

    // 4. Cash Flow
    this.cashOnHand += netIncome;

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
    // Avoid negative or zero base valuation
    let fundamentalPrice = ((Math.max(trailingEPS, 0.01) * sectorPE) * globalSentiment);
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
