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
      tradeAmount: document.getElementById('trade-amount'),
      buyBtn: document.getElementById('buy-btn'),
      sellBtn: document.getElementById('sell-btn'),
      boardroomMenu: document.getElementById('boardroom-menu'),
      macroInterest: document.getElementById('macro-interest'),
      macroInflation: document.getElementById('macro-inflation'),
      macroGdp: document.getElementById('macro-gdp')
    };

    this.populateCompanySelect();

    // Select first company by default
    if (GameState.companies.length > 0) {
      this.selectCompany(GameState.companies[0].id);
    }

    // Bind UI Events
    this.elements.companySelect.addEventListener('change', (e) => {
      this.selectCompany(e.target.value);
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
    this.elements.marketDay.textContent = GameState.market.day;

    if (this.elements.macroInterest) {
      this.elements.macroInterest.textContent = formatPercent(GameState.market.macro.interestRate);
      this.elements.macroInflation.textContent = formatPercent(GameState.market.macro.inflation);
      this.elements.macroGdp.textContent = formatPercent(GameState.market.macro.gdpGrowth);
    }

    this.updatePlayerPanel();
    this.updateCompanyDetails();
  },

  updatePlayerPanel() {
    this.elements.cash.textContent = formatCurrency(GameState.player.cash);
    this.elements.netWorth.textContent = formatCurrency(GameState.player.netWorth);

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
    } else {
      this.elements.boardroomMenu.classList.add('hidden');
    }
  }
};
