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
      selectedEps: document.getElementById('selected-company-eps'),
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

    // Select first company by default
    if (GameState.companies.length > 0) {
      this.selectCompany(GameState.companies[0].id);
    }

    // Bind UI Events
    this.elements.companySelect.addEventListener('change', (e) => {
      this.selectCompany(e.target.value);
    });

    this.elements.issueDividendBtn.addEventListener('click', () => {
        Player.forceDividend(this.selectedCompanyId);
    });

    this.elements.stockBuybackBtn.addEventListener('click', () => {
        Player.forceBuyback(this.selectedCompanyId);
    });

    this.elements.buyBtn.addEventListener('click', () => {
      const amount = parseInt(this.elements.tradeAmount.value, 10);
      Player.buy(this.selectedCompanyId, amount);
    });

    this.elements.sellBtn.addEventListener('click', () => {
      const amount = parseInt(this.elements.tradeAmount.value, 10);
      Player.sell(this.selectedCompanyId, amount);
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
    this.elements.cash.textContent = formatCurrency(GameState.player.cash);
    this.elements.netWorth.textContent = formatCurrency(GameState.player.netWorth);
    this.elements.playerDividends.textContent = formatCurrency(GameState.player.totalDividends || 0);

    // Render portfolio
    const portfolioHtml = Object.entries(GameState.player.portfolio).map(([compId, holding]) => {
      const comp = GameState.companies.find(c => c.id === compId);
      if (!comp) return '';
      const value = holding.shares * comp.price;
      const profit = value - (holding.shares * holding.averageCost);
      const colorClass = profit >= 0 ? 'color: var(--positive-color)' : 'color: var(--negative-color)';

      return `
        <li class="portfolio-item">
          <div style="font-weight: bold; cursor: pointer;" onclick="document.getElementById('company-select').value='${compId}'; document.getElementById('company-select').dispatchEvent(new Event('change'))">${comp.name}</div>
          <div style="display: flex; justify-content: space-between;">
            <span>${holding.shares} shrs</span>
            <span>${formatCurrency(value)}</span>
          </div>
          <div style="font-size: 0.8em; ${colorClass}">
            Avg Cost: ${formatCurrency(holding.averageCost)} | P/L: ${formatCurrency(profit)}
          </div>
        </li>
      `;
    }).join('');

    this.elements.portfolioList.innerHTML = portfolioHtml || '<li>No active positions</li>';
  },

  updateCompanyDetails() {
    if (!this.selectedCompanyId) return;
    const comp = GameState.companies.find(c => c.id === this.selectedCompanyId);
    if (!comp) return;

    this.elements.selectedName.textContent = comp.name;
    this.elements.selectedPrice.textContent = formatCurrency(comp.price);
    this.elements.selectedSector.textContent = comp.sector;
    this.elements.selectedRevenue.textContent = formatCurrency(comp.revenue);
    this.elements.selectedEps.textContent = formatCurrency(comp.eps);
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
      this.elements.issueDividendBtn.textContent = 'Issue Special Dividend';
      this.elements.stockBuybackBtn.textContent = 'Authorize Share Buyback';
    } else {
      this.elements.boardroomMenu.classList.add('hidden');
      this.elements.issueDividendBtn.disabled = true;
      this.elements.stockBuybackBtn.disabled = true;
    }
  }
};
