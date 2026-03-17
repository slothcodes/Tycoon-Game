import { EventBus } from '../core/EventBus.js';

export const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');

    EventBus.on('TRADE_ERROR', (msg) => this.show(msg, 'error'));
    EventBus.on('TRADE_SUCCESS', (msg) => this.show(msg, 'success'));
    EventBus.on('NEWS_ALERT', (msg) => this.show(msg, 'info'));
  },

  show(message, type = 'info') {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Add icon based on type
    let icon = '<i class="fa-solid fa-circle-info" style="color: var(--accent-color);"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color: var(--negative-color);"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color: var(--positive-color);"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards';
      setTimeout(() => {
        if (this.container.contains(toast)) {
          this.container.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
};

// Add slideOut animation to style.css dynamically if not present
const style = document.createElement('style');
style.innerHTML = `
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(120%); opacity: 0; }
  }
`;
document.head.appendChild(style);
