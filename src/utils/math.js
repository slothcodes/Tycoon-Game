// src/utils/math.js

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value) {
  return (value * 100).toFixed(2) + '%';
}

export function formatLargeNumber(value) {
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value.toString();
}

export function randomGaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function animateValue(element, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);

    // Ease-out logic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = start + (end - start) * easeProgress;

    element.textContent = formatCurrency(currentVal);

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.textContent = formatCurrency(end); // Ensure exact final value
    }
  };
  window.requestAnimationFrame(step);
}
