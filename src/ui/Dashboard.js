import { GameState } from '../core/GameState.js';
import { Player } from '../core/Player.js';
import { EventBus } from '../core/EventBus.js';
import { formatCurrency, formatLargeNumber, formatPercent } from '../utils/math.js';
import { GAME_CONFIG } from '../utils/config.js';

export const Dashboard = {
  selectedCompanyId: null,
  elements: {},

  init() {
    this.elements = {
      cash: document.getElementById('player-cash'),
      netWorth: document.getElementById('player-networth'),
      marketDay: document.getElementById('market-day'),
      portfolioList: document.getElementById('portfolio-list'),
      companySelect: document.getElementById('company-select'),
      selectedName: document.getElementById('selected-company-name'),
      selectedPrice: document.getElementById('selected-company-price'),
      selectedSector: document.getElementById('selected-company-sector'),
      selectedRevenue: document.getElementById('selected-company-revenue'),
      selectedRevenueEst: document.getElementById('selected-company-revenue-est'),
      selectedEps: document.getElementById('selected-company-eps'),
      selectedEpsEst: document.getElementById('selected-company-eps-est'),
      selectedShares: document.getElementById('selected-company-shares'),
      selectedStake: document.getElementById('selected-company-stake'),
      selectedRating: document.getElementById('selected-company-rating'),
      selectedDebt: document.getElementById('selected-company-debt'),
      selectedYield: document.getElementById('selected-company-yield'),
      selectedStrategy: document.getElementById('selected-company-strategy'),
      tradeAmount: document.getElementById('trade-amount'),
      buyBtn: document.getElementById('buy-btn'),
      sellBtn: document.getElementById('sell-btn'),
      boardroomMenu: document.getElementById('boardroom-menu'),
      macroPhase: document.getElementById('macro-phase'),
      macroSentiment: document.getElementById('macro-sentiment'),
      macroInterest: document.getElementById('macro-interest'),
      macroInflation: document.getElementById('macro-inflation'),
      macroGdp: document.getElementById('macro-gdp'),
      playerDividends: document.getElementById('player-dividends')
    };

    this.populateCompanySelect();

    this.elements.issueDividendBtn = document.getElementById('issue-dividend-btn');
    this.elements.stockBuybackBtn = document.getElementById('stock-buyback-btn');
    this.elements.issueSharesBtn = document.getElementById('issue-shares-btn');
    this.elements.issueDebtBtn = document.getElementById('issue-debt-btn');
    this.elements.paydownDebtBtn = document.getElementById('paydown-debt-btn');
    this.elements.investRndBtn = document.getElementById('invest-rnd-btn');
    this.elements.restructureBtn = document.getElementById('restructure-btn');

    // Select first company by default
    if (GameState.companies.length > 0) {
      this.selectCompany(GameState.companies[0].id);
    }

    // Bind UI Events
    this.elements.companySelect.addEventListener('change', (e) => {
      this.selectCompany(e.target.value);
    });

    this.elements.issueDividendBtn.addEventListener('click', () => {
        const input = prompt('Enter dividend percentage of cash to distribute (1-100):', '50');
        if (input !== null) {
            const percentage = parseInt(input, 10);
            Player.issueDividend(this.selectedCompanyId, percentage);
        }
    });

    this.elements.stockBuybackBtn.addEventListener('click', () => {
        const company = GameState.companies.find(c => c.id === this.selectedCompanyId);
        if (company) {
            // Default to 10% cash buyback
            const defaultCash = Math.floor(company.cashOnHand * 0.10);
            const input = prompt(`Enter cash amount for buyback (Max: $${Math.floor(company.cashOnHand).toLocaleString()}):`, defaultCash.toString());
            if (input !== null) {
                const amount = parseInt(input.replace(/,/g, ''), 10);
                Player.stockBuyback(this.selectedCompanyId, amount);
            }
        }
    });

    this.elements.issueSharesBtn.addEventListener('click', () => {
        const input = prompt('Enter percentage of shares to issue/dilute (1-50):', '10');
        if (input !== null) {
            const percentage = parseInt(input, 10);
            Player.issueShares(this.selectedCompanyId, percentage);
        }
    });

    this.elements.issueDebtBtn.addEventListener('click', () => {
        const company = GameState.companies.find(c => c.id === this.selectedCompanyId);
        if (company) {
            const input = prompt('Enter amount of corporate debt to issue:', '5000000');
            if (input !== null) {
                const amount = parseInt(input.replace(/,/g, ''), 10);
                Player.issueDebt(this.selectedCompanyId, amount);
            }
        }
    });

    this.elements.paydownDebtBtn.addEventListener('click', () => {
        const company = GameState.companies.find(c => c.id === this.selectedCompanyId);
        if (company) {
            const input = prompt(`Enter amount of debt to pay down (Max: $${Math.floor(company.cashOnHand).toLocaleString()}):`, '1000000');
            if (input !== null) {
                const amount = parseInt(input.replace(/,/g, ''), 10);
                Player.payDownDebt(this.selectedCompanyId, amount);
            }
        }
    });

    this.elements.investRndBtn.addEventListener('click', () => {
        const company = GameState.companies.find(c => c.id === this.selectedCompanyId);
        if (company) {
            const cost = Math.floor(company.cashOnHand * 0.20);
            if (confirm(`Launch R&D Campaign? This will consume $${cost.toLocaleString()} cash for a permanent revenue boost.`)) {
                Player.investRnD(this.selectedCompanyId);
            }
        }
    });

    this.elements.restructureBtn.addEventListener('click', () => {
        const company = GameState.companies.find(c => c.id === this.selectedCompanyId);
        if (company) {
            const cost = Math.floor(company.revenue * 0.10);
            if (confirm(`Execute Corporate Restructuring? This will cost $${cost.toLocaleString()} in severance but permanently reduce fixed costs. Expect a PR hit.`)) {
                Player.restructure(this.selectedCompanyId);
            }
        }
    });

    this.elements.buyBtn.addEventListener('click', (e) => {
      const amount = parseInt(this.elements.tradeAmount.value, 10);
      if (Player.buy(this.selectedCompanyId, amount)) {
         this.spawnFloatingNumber(e, `-${formatCurrency(this.lastTradeCost)}`, 'red');
      }
    });

    this.elements.sellBtn.addEventListener('click', (e) => {
      const amount = parseInt(this.elements.tradeAmount.value, 10);
      if (Player.sell(this.selectedCompanyId, amount)) {
         this.spawnFloatingNumber(e, `+${formatCurrency(this.lastTradeProceeds)}`, 'green');
      }
    });

    // Capture the exact trade value via EventBus for the floating numbers
    EventBus.on('TRADE_SUCCESS_VALUE', (data) => {
       if (data.type === 'buy') this.lastTradeCost = data.value;
       if (data.type === 'sell') this.lastTradeProceeds = data.value;
    });

    this.elements.tradeAmount.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const amount = parseInt(this.elements.tradeAmount.value, 10);
        // Default to buy on enter if no specific modifier is held,
        // or just buy if they type a positive number.
        if (amount > 0) {
          Player.buy(this.selectedCompanyId, amount);
        }
      }
    });

    // Listen to Game Logic Events
    EventBus.on('MARKET_UPDATED', () => this.update());
    EventBus.on('PLAYER_UPDATED', () => this.updatePlayerPanel());
    EventBus.on('CONTROL_ACQUIRED', (companyId) => {
      if (this.selectedCompanyId === companyId) {
        this.elements.boardroomMenu.classList.remove('hidden');
      }
    });

    // Handle IPOs and Bankruptcies UI updates
    EventBus.on('NEWS_ALERT', (msg) => {
      if (msg.startsWith('IPO:') || msg.startsWith('BANKRUPTCY:')) {
        this.populateCompanySelect();
        // If the selected company went bankrupt, select the first available one
        if (!GameState.companies.find(c => c.id === this.selectedCompanyId)) {
          if (GameState.companies.length > 0) {
            this.selectCompany(GameState.companies[0].id);
          } else {
             this.selectedCompanyId = null;
             this.updateCompanyDetails();
          }
        } else {
            // Re-select the current one to ensure the dropdown shows the right value
            this.elements.companySelect.value = this.selectedCompanyId;
        }
      }
    });

    this.update();
  },

  spawnFloatingNumber(e, text, color) {
    const el = document.createElement('div');
    el.textContent = text;
    el.className = `floating-number ${color}`;

    // Position near the button clicked
    const rect = e.target.getBoundingClientRect();
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top}px`;

    document.body.appendChild(el);

    // Remove after animation
    setTimeout(() => {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    }, 1000);
  },

  populateCompanySelect() {
    this.elements.companySelect.innerHTML = GameState.companies.map(c =>
      `<option value="${c.id}">${c.name}</option>`
    ).join('');
  },

  selectCompany(companyId) {
    this.selectedCompanyId = companyId;
    this.elements.companySelect.value = companyId;
    EventBus.emit('COMPANY_SELECTED', companyId);
    this.updateCompanyDetails();
  },

  update() {
    this.elements.marketDay.textContent = GameState.market?.day || 1;

    if (this.elements.macroInterest) {
      if (this.elements.macroPhase) {
        this.elements.macroPhase.textContent = GameState.market?.economicPhase || 'Expansion';

        let fgValue = GameState.market?.fearAndGreed || 50;
        let fgText = fgValue > 75 ? 'Extreme Greed' : (fgValue > 55 ? 'Greed' : (fgValue < 25 ? 'Extreme Fear' : (fgValue < 45 ? 'Fear' : 'Neutral')));
        if (this.elements.macroSentiment) {
          this.elements.macroSentiment.textContent = `${Math.round(fgValue)} (${fgText})`;
        }
      }
      const macro = GameState.market && GameState.market.macro ? GameState.market.macro : null;
      this.elements.macroInterest.textContent = formatPercent(macro ? macro.interestRate : 0);
      this.elements.macroInflation.textContent = formatPercent(macro ? macro.inflation : 0);
      this.elements.macroGdp.textContent = formatPercent(macro ? macro.gdpGrowth : 0);
    }

    this.updatePlayerPanel();
    this.updateCompanyDetails();
  },

  updatePlayerPanel() {
    const oldCash = this.elements.cash.textContent;
    const oldNetWorth = this.elements.netWorth.textContent;

    const newCash = formatCurrency(GameState.player.cash);
    const newNetWorth = formatCurrency(GameState.player.netWorth);

    this.elements.cash.textContent = newCash;
    this.elements.netWorth.textContent = newNetWorth;
    this.elements.playerDividends.textContent = formatCurrency(GameState.player.totalDividends || 0);

    // Flash animation on change
    if (oldCash !== newCash) {
        this.elements.cash.classList.remove('flash-update');
        void this.elements.cash.offsetWidth; // trigger reflow
        this.elements.cash.classList.add('flash-update');
    }
    if (oldNetWorth !== newNetWorth) {
        this.elements.netWorth.classList.remove('flash-update');
        void this.elements.netWorth.offsetWidth;
        this.elements.netWorth.classList.add('flash-update');
    }

    // Render portfolio
    const portfolioHtml = Object.entries(GameState.player.portfolio).map(([compId, holding]) => {
      const comp = GameState.companies.find(c => c.id === compId);
      if (!comp) return '';
      const value = holding.shares * comp.price;
      const profit = value - (holding.shares * holding.averageCost);
      const colorClass = profit >= 0 ? 'color: var(--positive-color)' : 'color: var(--negative-color)';
      const indicatorClass = profit >= 0 ? 'bull' : 'bear';

      return `
        <li class="portfolio-item">
          <div style="font-weight: 600; cursor: pointer; display: flex; align-items: center;" onclick="document.getElementById('company-select').value='${compId}'; document.getElementById('company-select').dispatchEvent(new Event('change'))">
             <span class="status-indicator ${indicatorClass}"></span> ${comp.name}
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span style="color: var(--text-secondary);">${holding.shares.toLocaleString()} shrs</span>
            <span style="font-family: 'JetBrains Mono', monospace;">${formatCurrency(value)}</span>
          </div>
          <div style="font-size: 0.8em; margin-top: 4px; ${colorClass}">
            Avg: ${formatCurrency(holding.averageCost)} | P/L: ${formatCurrency(profit)}
          </div>
        </li>
      `;
    }).join('');

    this.elements.portfolioList.innerHTML = portfolioHtml || '<li style="color: var(--text-secondary); text-align: center; padding: 1rem;">No active positions</li>';
  },

  updateCompanyDetails() {
    if (!this.selectedCompanyId) return;
    const comp = GameState.companies.find(c => c.id === this.selectedCompanyId);
    if (!comp) return;

    this.elements.selectedName.textContent = comp.name;
    this.elements.selectedPrice.textContent = formatCurrency(comp.price);
    this.elements.selectedSector.textContent = comp.sector;

    // Display Reported vs Estimated values
    this.elements.selectedRevenue.textContent = formatCurrency(comp.reportedRevenue || comp.revenue);
    const revEst = comp.analystEstimates ? comp.analystEstimates.revenue : comp.revenue;
    this.elements.selectedRevenueEst.textContent = `(Est: ${formatCurrency(revEst)})`;

    this.elements.selectedEps.textContent = formatCurrency(comp.reportedEps || 0);
    const epsEst = comp.analystEstimates ? comp.analystEstimates.eps : 0;
    this.elements.selectedEpsEst.textContent = `(Est: ${formatCurrency(epsEst)})`;

    this.elements.selectedShares.textContent = formatLargeNumber(comp.sharesOutstanding);
    this.elements.selectedRating.textContent = comp.creditRating || '-';
    this.elements.selectedDebt.textContent = formatLargeNumber(comp.totalDebt || 0);
    this.elements.selectedYield.textContent = comp.dividendYield > 0 ? formatPercent(comp.dividendYield / 100) : '-';
    this.elements.selectedStrategy.textContent = comp.strategy || '-';

    const holding = GameState.player.portfolio[comp.id];
    let stakeHtml = "0%";
    if (holding) {
      const percentage = (holding.shares / comp.sharesOutstanding) * 100;
      stakeHtml = `${percentage.toFixed(2)}%`;
      if (percentage > (GAME_CONFIG.monopolyThreshold * 100)) {
         stakeHtml += ' (Ctrl)';
      }
    }
    this.elements.selectedStake.textContent = stakeHtml;

    if (comp.isPlayerControlled) {
      this.elements.boardroomMenu.classList.remove('hidden');
      this.elements.issueDividendBtn.disabled = false;
      this.elements.stockBuybackBtn.disabled = false;
      this.elements.issueSharesBtn.disabled = false;
      this.elements.issueDebtBtn.disabled = false;
      this.elements.paydownDebtBtn.disabled = false;
      this.elements.investRndBtn.disabled = false;
      this.elements.restructureBtn.disabled = false;
    } else {
      this.elements.boardroomMenu.classList.add('hidden');
      this.elements.issueDividendBtn.disabled = true;
      this.elements.stockBuybackBtn.disabled = true;
      this.elements.issueSharesBtn.disabled = true;
      this.elements.issueDebtBtn.disabled = true;
      this.elements.paydownDebtBtn.disabled = true;
      this.elements.investRndBtn.disabled = true;
      this.elements.restructureBtn.disabled = true;
    }
  }
};
