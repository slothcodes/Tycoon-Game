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
  },

  issueShares(companyId, percentage) {
    const company = GameState.companies.find(c => c.id === companyId);
    if (!company || !company.isPlayerControlled) return false;

    if (percentage < 1 || percentage > 50) {
      EventBus.emit('TRADE_ERROR', 'Invalid dilution. Must be between 1% and 50%.');
      return false;
    }

    const decPercentage = percentage / 100;
    const newShares = Math.floor(company.sharesOutstanding * decPercentage);

    // Apply an underwriting discount (market absorbs new shares at a slightly lower price)
    const issuePrice = company.price * 0.90;
    const capitalRaised = newShares * issuePrice;

    company.sharesOutstanding += newShares;
    company.cashOnHand += capitalRaised;
    company.strategy = 'Player Directed (Secondary Offering)';

    // Negative hit to hype/sentiment due to dilution
    company.hype *= 0.9;
    // Price drops immediately to reflect dilution and discount
    company.price = issuePrice;

    // Re-evaluate player ownership % since float increased
    if (GameState.player.portfolio[companyId]) {
        this.checkOwnership(company, GameState.player.portfolio[companyId].shares);
    }

    EventBus.emit('NEWS_ALERT', `DILUTION: ${company.name} issued ${newShares.toLocaleString()} new shares, raising $${capitalRaised.toLocaleString()}.`);
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  },

  issueDebt(companyId, amount) {
    const company = GameState.companies.find(c => c.id === companyId);
    if (!company || !company.isPlayerControlled) return false;

    if (amount <= 0) {
      EventBus.emit('TRADE_ERROR', 'Invalid debt amount.');
      return false;
    }

    if (company.creditRating === 'Junk' || company.creditRating === 'CCC') {
      EventBus.emit('TRADE_ERROR', 'Credit rating too low to issue new debt.');
      return false;
    }

    company.totalDebt += amount;
    company.cashOnHand += amount;
    company.strategy = 'Player Directed (Debt Offering)';

    EventBus.emit('NEWS_ALERT', `${company.name} successfully issued $${amount.toLocaleString()} in corporate bonds.`);
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  },

  payDownDebt(companyId, amount) {
    const company = GameState.companies.find(c => c.id === companyId);
    if (!company || !company.isPlayerControlled) return false;

    if (amount <= 0 || amount > company.cashOnHand) {
      EventBus.emit('TRADE_ERROR', 'Invalid amount or insufficient cash.');
      return false;
    }

    const actualPaydown = Math.min(amount, company.totalDebt);

    if (actualPaydown <= 0) {
      EventBus.emit('TRADE_ERROR', 'Company has no debt to pay down.');
      return false;
    }

    company.totalDebt -= actualPaydown;
    company.cashOnHand -= actualPaydown;
    company.strategy = 'Player Directed (Deleveraging)';

    EventBus.emit('NEWS_ALERT', `${company.name} paid down $${actualPaydown.toLocaleString()} of debt.`);
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  },

  investRnD(companyId) {
    const company = GameState.companies.find(c => c.id === companyId);
    if (!company || !company.isPlayerControlled) return false;

    // Fixed cost based on 20% of current cash
    const cost = Math.floor(company.cashOnHand * 0.20);

    if (cost < 100000) {
      EventBus.emit('TRADE_ERROR', 'Insufficient cash reserves for meaningful R&D investment.');
      return false;
    }

    company.cashOnHand -= cost;

    // Boost revenue capacity permanently
    company.revenue *= 1.10;

    // Increase hype temporarily
    company.hype *= 1.15;

    company.strategy = 'Player Directed (R&D Push)';

    EventBus.emit('NEWS_ALERT', `INNOVATION: ${company.name} launches a massive $${cost.toLocaleString()} R&D campaign!`);
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  },

  restructure(companyId) {
    const company = GameState.companies.find(c => c.id === companyId);
    if (!company || !company.isPlayerControlled) return false;

    // Cost to restructure (severance, etc) is 10% of revenue
    const cost = Math.floor(company.revenue * 0.10);

    if (company.cashOnHand < cost) {
      EventBus.emit('TRADE_ERROR', `Need at least $${cost.toLocaleString()} cash to cover restructuring costs.`);
      return false;
    }

    company.cashOnHand -= cost;

    // Permanently drop fixed costs by 15%
    company.fixedCosts *= 0.85;

    // Negative PR hit to hype
    company.hype *= 0.80;

    company.strategy = 'Player Directed (Restructuring)';

    EventBus.emit('NEWS_ALERT', `RESTRUCTURING: ${company.name} announces corporate layoffs, saving on fixed costs.`);
    EventBus.emit('PLAYER_UPDATED', GameState.player);
    return true;
  }
};
