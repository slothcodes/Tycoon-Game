import Chart from 'https://cdn.jsdelivr.net/npm/chart.js/auto/+esm';
import { GameState } from '../core/GameState.js';
import { EventBus } from '../core/EventBus.js';

export class ChartCtrl {
  constructor(canvasId) {
    this.ctx = document.getElementById(canvasId).getContext('2d');
    this.chart = null;
    this.selectedCompanyId = null;

    this.initChart();

    EventBus.on('MARKET_UPDATED', () => this.updateChart());
    EventBus.on('COMPANY_SELECTED', (companyId) => {
      this.selectedCompanyId = companyId;
      this.updateChart();
    });
  }

  initChart() {
    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Price',
          data: [],
          borderColor: '#F5A623',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#131722',
            titleColor: '#A0AEC0',
            bodyColor: '#FFFFFF',
            borderColor: '#2D3748',
            borderWidth: 1
          }
        },
        scales: {
          x: { display: false },
          y: {
            display: true,
            position: 'right',
            grid: { color: '#2D3748', drawBorder: false },
            ticks: {
              color: '#A0AEC0',
              callback: (value) => '$' + value.toFixed(2)
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }

  updateChart() {
    if (!this.selectedCompanyId || !this.chart) return;

    const company = GameState.companies.find(c => c.id === this.selectedCompanyId);
    if (!company) return;

    const history = company.priceHistory;

    this.chart.data.labels = history.map((_, i) => i);
    this.chart.data.datasets[0].data = history;

    // Color logic: green if current price >= start price, else red
    const startPrice = history[0];
    const currentPrice = history[history.length - 1];
    const color = currentPrice >= startPrice ? '#00FF00' : '#FF0000';
    this.chart.data.datasets[0].borderColor = color;

    this.chart.update();
  }
}
