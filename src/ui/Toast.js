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
    toast.textContent = message;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in forwards';
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
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);
