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
          borderColor: '#00f2ff',
          borderWidth: 3,
          pointRadius: 0,
          fill: true,
          tension: 0.1,
          spanGaps: true
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
            backgroundColor: 'rgba(20, 26, 38, 0.9)',
            titleColor: '#94a3b8',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            displayColors: false
          }
        },
        scales: {
          x: { display: false },
          y: {
            display: true,
            position: 'right',
            grid: {
              color: (context) => context.tick.value === 0 ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: "'JetBrains Mono', monospace", size: 11 },
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

    // Color logic: neon emerald if current price >= start price, else vivid crimson
    const startPrice = history[0];
    const currentPrice = history[history.length - 1];
    const hexColor = currentPrice >= startPrice ? '#00ff88' : '#ff3366';
    const rgbColor = currentPrice >= startPrice ? '0, 255, 136' : '255, 51, 102';

    this.chart.data.datasets[0].borderColor = hexColor;

    // Create Gradient Fill
    let gradient = this.ctx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, `rgba(${rgbColor}, 0.3)`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0.0)`);
    this.chart.data.datasets[0].backgroundColor = gradient;

    this.chart.update();
  }
}
