import { GameState } from './GameState.js';
import { GAME_CONFIG } from '../utils/config.js';
import { EventBus } from './EventBus.js';

export const Player = {
  buy(companyId, shares) {
    if (shares <= 0 || isNaN(shares) || !Number.isInteger(shares)) {
      EventBus.emit('TRADE_ERROR', 'Invalid share amount.');
      return false;
    }

    const company = GameState.companies.find(c => c.id === companyId);
    if (!company) {
      EventBus.emit('TRADE_ERROR', 'Company not found.');
      return false;
    }

    // Slippage impact calculation
    // publicFloat approximation: let's assume sharesOutstanding is public float
    const priceImpact = (shares / company.sharesOutstanding) * GAME_CONFIG.slippageFactor;
    const executionPrice = company.price * (1 + priceImpact);
    const totalCost = executionPrice * shares;

    if (GameState.player.cash < totalCost) {
      EventBus.emit('TRADE_ERROR', 'Insufficient funds.');
      return false;
    }

    // Process trade
    GameState.player.cash -= totalCost;

    if (!GameState.player.portfolio[companyId]) {
      GameState.player.portfolio[companyId] = { shares: 0, averageCost: 0 };
    }

    const holding = GameState.player.portfolio[companyId];
    const oldTotalCost = holding.shares * holding.averageCost;
    holding.shares += shares;
    holding.averageCost = (oldTotalCost + totalCost) / holding.shares;

    this.recalculateNetWorth();
    this.checkOwnership(company, holding.shares);

    EventBus.emit('TRADE_SUCCESS', `Bought ${shares} shares of ${company.name}`);
    EventBus.emit('TRADE_SUCCESS_VALUE', { type: 'buy', value: totalCost });
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  },

  sell(companyId, shares) {
    if (shares <= 0 || isNaN(shares) || !Number.isInteger(shares)) {
      EventBus.emit('TRADE_ERROR', 'Invalid share amount.');
      return false;
    }

    const holding = GameState.player.portfolio[companyId];
    if (!holding || holding.shares < shares) {
      EventBus.emit('TRADE_ERROR', 'Insufficient shares.');
      return false;
    }

    const company = GameState.companies.find(c => c.id === companyId);
    if (!company) {
      EventBus.emit('TRADE_ERROR', 'Company not found.');
      return false;
    }

    // Slippage (Negative impact when selling big blocks)
    const priceImpact = (shares / company.sharesOutstanding) * GAME_CONFIG.slippageFactor;
    const executionPrice = company.price * (1 - priceImpact);
    const totalProceeds = executionPrice * shares;

    // Process trade
    GameState.player.cash += totalProceeds;
    holding.shares -= shares;

    if (holding.shares === 0) {
      delete GameState.player.portfolio[companyId];
    }

    this.recalculateNetWorth();
    this.checkOwnership(company, holding ? holding.shares : 0);

    EventBus.emit('TRADE_SUCCESS', `Sold ${shares} shares of ${company.name}`);
    EventBus.emit('TRADE_SUCCESS_VALUE', { type: 'sell', value: totalProceeds });
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  },

  recalculateNetWorth() {
    let portfolioValue = 0;

    for (const [companyId, holding] of Object.entries(GameState.player.portfolio)) {
      const company = GameState.companies.find(c => c.id === companyId);
      if (company) {
        portfolioValue += holding.shares * company.price;
      }
    }

    GameState.player.netWorth = GameState.player.cash + portfolioValue;
  },

  checkOwnership(company, sharesOwned) {
    const ownershipPercentage = sharesOwned / company.sharesOutstanding;

    if (ownershipPercentage > GAME_CONFIG.ownershipNewsThreshold && ownershipPercentage <= GAME_CONFIG.monopolyThreshold) {
      EventBus.emit('NEWS_ALERT', `Player acquired a >5% stake in ${company.name}`);
    }

    if (ownershipPercentage > GAME_CONFIG.monopolyThreshold) {
      if (!company.isPlayerControlled) {
        company.isPlayerControlled = true;
        EventBus.emit('NEWS_ALERT', `Player gained controlling interest (>51%) in ${company.name}`);
        EventBus.emit('CONTROL_ACQUIRED', company.id);
      }
    } else {
      if (company.isPlayerControlled) {
        company.isPlayerControlled = false;
        company.strategy = 'Balanced';
        EventBus.emit('NEWS_ALERT', `Player lost controlling interest in ${company.name}`);
      }
    }
  },

  issueDividend(companyId, percentage) {
    const company = GameState.companies.find(c => c.id === companyId);
    if (!company || !company.isPlayerControlled) return false;

    if (percentage < 1 || percentage > 100) {
      EventBus.emit('TRADE_ERROR', 'Invalid dividend percentage. Must be between 1 and 100.');
      return false;
    }

    const decPercentage = percentage / 100;
    const dividendPool = company.cashOnHand * decPercentage;

    if (dividendPool <= 0) {
      EventBus.emit('TRADE_ERROR', 'Company has no cash to distribute.');
      return false;
    }

    company.cashOnHand -= dividendPool;
    const dps = dividendPool / company.sharesOutstanding;
    company.dividendYield = (dps / company.price) * 100;
    company.strategy = 'Player Directed (Dividend Forced)';

    // Payout to all shareholders (including player)
    if (GameState.player.portfolio[companyId]) {
      const playerShares = GameState.player.portfolio[companyId].shares;
      const payout = playerShares * dps;
      GameState.player.cash += payout;
      GameState.player.totalDividends += payout;
    }

    EventBus.emit('NEWS_ALERT', `You forced ${company.name} to issue a special dividend of $${dps.toFixed(2)}/share (Total: $${dividendPool.toLocaleString()}).`);
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  },

  stockBuyback(companyId, cashAmount) {
    const company = GameState.companies.find(c => c.id === companyId);
    if (!company || !company.isPlayerControlled) return false;

    if (cashAmount <= 0 || cashAmount > company.cashOnHand) {
      EventBus.emit('TRADE_ERROR', 'Invalid buyback amount. Exceeds cash on hand.');
      return false;
    }

    company.cashOnHand -= cashAmount;
    const sharesBought = Math.floor(cashAmount / company.price);

    // Ensure we don't buy back more shares than exist (or create a 0 float situation)
    const minFloat = 100000;
    const actualSharesBought = Math.min(sharesBought, company.sharesOutstanding - minFloat);

    if (actualSharesBought <= 0) {
        EventBus.emit('TRADE_ERROR', 'Buyback failed: Minimum float reached.');
        // Refund
        company.cashOnHand += cashAmount;
        return false;
    }

    company.sharesOutstanding -= actualSharesBought;
    company.strategy = 'Player Directed (Buyback)';

    // Re-evaluate player ownership % since float decreased
    if (GameState.player.portfolio[companyId]) {
        this.checkOwnership(company, GameState.player.portfolio[companyId].shares);
    }

    EventBus.emit('NEWS_ALERT', `You forced ${company.name} to buy back ${actualSharesBought.toLocaleString()} shares for $${cashAmount.toLocaleString()}.`);
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  }
};
