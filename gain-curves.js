/**
 * 50 Unique Gain Curve Configurations
 * Each engine gets: id, name, tag, color, and a curve function(phase) -> gain[0.01..1.0]
 */

export const ENGINE_CONFIGS = [
  {
    id: 1, name: 'Linear Descent', tag: '100% → 1% linear',
    color: '#4fd3c4', curve: p => 1 - p * 0.99
  },
  {
    id: 2, name: 'Exponential Decay', tag: 'Natural decay curve',
    color: '#ff8a3d', curve: p => Math.pow(0.01, p)
  },
  {
    id: 3, name: 'Logarithmic', tag: '1 / (1 + 99p)',
    color: '#7ee787', curve: p => 1 / (1 + p * 99)
  },
  {
    id: 4, name: 'Sine Tremolo', tag: 'Oscillating gain',
    color: '#ff5c5c', curve: p => 0.505 + 0.495 * Math.cos(p * Math.PI * 2)
  },
  {
    id: 5, name: 'Square Gate', tag: 'Hard on/off',
    color: '#c084fc', curve: p => p < 0.5 ? 1 : 0.01
  },
  {
    id: 6, name: 'Triangle Wave', tag: 'Up-down linear',
    color: '#fbbf24', curve: p => p < 0.5 ? 1 - p * 1.98 : 0.01 + (p - 0.5) * 1.98
  },
  {
    id: 7, name: 'Sawtooth Up', tag: '1% → 100%',
    color: '#60a5fa', curve: p => 0.01 + p * 0.99
  },
  {
    id: 8, name: 'Sawtooth Down', tag: 'Snap at 90%',
    color: '#f472b6', curve: p => p < 0.9 ? 1 : 0.01
  },
  {
    id: 9, name: 'Pulse 10%', tag: 'Short burst',
    color: '#a3e635', curve: p => p < 0.1 ? 1 : 0.01
  },
  {
    id: 10, name: 'Smoothstep', tag: 'Cubic ease',
    color: '#22d3ee', curve: p => 1 - 0.99 * (p * p * (3 - 2 * p))
  },
  {
    id: 11, name: 'Quintic Ease', tag: '5th-order smooth',
    color: '#e879f9', curve: p => 1 - 0.99 * (p * p * p * (p * (p * 6 - 15) + 10))
  },
  {
    id: 12, name: 'Bounce', tag: 'Underdamped spring',
    color: '#fb923c', curve: p => Math.max(0.01, Math.abs(Math.exp(-p * 4) * Math.cos(p * Math.PI * 6)))
  },
  {
    id: 13, name: 'Power 4', tag: 'Slow start, fast end',
    color: '#818cf8', curve: p => 1 - 0.99 * Math.pow(p, 4)
  },
  {
    id: 14, name: 'Power ¼', tag: 'Fast start, slow end',
    color: '#34d399', curve: p => 1 - 0.99 * Math.pow(p, 0.25)
  },
  {
    id: 15, name: 'Stepped 5', tag: '5 discrete levels',
    color: '#f87171', curve: p => 1 - Math.floor(p * 5) / 5 * 0.99
  },
  {
    id: 16, name: 'Hold & Decay', tag: 'Hold then drop',
    color: '#a78bfa', curve: p => p < 0.4 ? 1 : 1 - ((p - 0.4) / 0.6) * 0.99
  },
  {
    id: 17, name: 'Attack-Sustain', tag: 'Fade in, hold, fade out',
    color: '#2dd4bf', curve: p => {
      if (p < 0.2) return 0.01 + (p / 0.2) * 0.99;
      if (p > 0.8) return 1 - ((p - 0.8) / 0.2) * 0.99;
      return 1;
    }
  },
  {
    id: 18, name: 'Stutter 4×', tag: 'Rapid on/off',
    color: '#facc15', curve: p => (Math.floor(p * 4) % 2 === 0) ? 1 : 0.01
  },
  {
    id: 19, name: 'Swell', tag: '1% → 100% → 1%',
    color: '#67e8f9', curve: p => 0.01 + 0.99 * Math.sin(p * Math.PI)
  },
  {
    id: 20, name: 'Chaos LFO', tag: 'Multi-frequency interference',
    color: '#fda4af', curve: p => {
      const v = 0.5 + 0.49 * Math.sin(p * 13) * Math.cos(p * 7);
      return Math.max(0.01, Math.min(1, v + 0.01));
    }
  },
  {
    id: 21, name: 'Double Exponential', tag: 'e^(-e^p)',
    color: '#06b6d4', curve: p => Math.max(0.01, Math.exp(-Math.exp(p * 3)))
  },
  {
    id: 22, name: 'Sigmoid', tag: 'S-curve descent',
    color: '#d946ef', curve: p => 1 - 0.99 / (1 + Math.exp(-(p - 0.5) * 12))
  },
  {
    id: 23, name: 'Gaussian Bell', tag: 'Bell-shaped window',
    color: '#84cc16', curve: p => Math.max(0.01, Math.exp(-Math.pow((p - 0.5) * 6, 2)))
  },
  {
    id: 24, name: 'Parabolic', tag: 'Quadratic arc',
    color: '#f43f5e', curve: p => Math.max(0.01, 1 - 0.99 * 4 * p * (1 - p) - 0.01)
  },
  {
    id: 25, name: 'Cubic Ease In', tag: 'Accelerating drop',
    color: '#8b5cf6', curve: p => 1 - 0.99 * Math.pow(p, 3)
  },
  {
    id: 26, name: 'Cubic Ease Out', tag: 'Decelerating drop',
    color: '#14b8a6', curve: p => 1 - 0.99 * (1 - Math.pow(1 - p, 3))
  },
  {
    id: 27, name: 'Elastic', tag: 'Spring overshoot',
    color: '#e11d48', curve: p => {
      const c4 = (2 * Math.PI) / 3;
      const v = p === 0 ? 1 : p === 1 ? 0.01 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
      return Math.max(0.01, v);
    }
  },
  {
    id: 28, name: 'Back Ease', tag: 'Overshoot then settle',
    color: '#0ea5e9', curve: p => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const v = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      return Math.max(0.01, v);
    }
  },
  {
    id: 29, name: 'Circular', tag: 'Quarter-circle arc',
    color: '#f97316', curve: p => 1 - 0.99 * (1 - Math.sqrt(1 - Math.pow(p, 2)))
  },
  {
    id: 30, name: 'Pulse 25%', tag: 'Quarter burst',
    color: '#a855f7', curve: p => p < 0.25 ? 1 : 0.01
  },
  {
    id: 31, name: 'Pulse 50%', tag: 'Half burst',
    color: '#ec4899', curve: p => p < 0.5 ? 1 : 0.01
  },
  {
    id: 32, name: 'Staircase 10', tag: '10 discrete steps',
    color: '#10b981', curve: p => 1 - Math.floor(p * 10) / 10 * 0.99
  },
  {
    id: 33, name: 'Random Walk', tag: 'Perlin-like noise',
    color: '#6366f1', curve: p => {
      const v = 0.5 + 0.3 * Math.sin(p * 17) + 0.2 * Math.sin(p * 31);
      return Math.max(0.01, Math.min(1, v));
    }
  },
  {
    id: 34, name: 'Sine Squared', tag: 'sin² envelope',
    color: '#ef4444', curve: p => 0.01 + 0.99 * Math.pow(Math.sin((1 - p) * Math.PI / 2), 2)
  },
  {
    id: 35, name: 'Cosine Half', tag: 'Half cosine fall',
    color: '#3b82f6', curve: p => 0.01 + 0.99 * Math.cos(p * Math.PI / 2)
  },
  {
    id: 36, name: 'Exponential Attack', tag: 'Slow rise then hold',
    color: '#eab308', curve: p => p < 0.5 ? 0.01 + 0.99 * (1 - Math.exp(-p * 8)) : 1 - ((p - 0.5) / 0.5) * 0.99
  },
  {
    id: 37, name: 'Logarithmic Decay', tag: 'ln-based fall',
    color: '#14b8a6', curve: p => Math.max(0.01, 1 - 0.99 * Math.log(1 + p * 99) / Math.log(100))
  },
  {
    id: 38, name: 'Power 2', tag: 'Quadratic descent',
    color: '#f59e0b', curve: p => 1 - 0.99 * Math.pow(p, 2)
  },
  {
    id: 39, name: 'Power 8', tag: 'Steep descent',
    color: '#84cc16', curve: p => 1 - 0.99 * Math.pow(p, 8)
  },
  {
    id: 40, name: 'Inverse Square', tag: '1 / (1 + 9p)²',
    color: '#06b6d4', curve: p => Math.max(0.01, 1 / Math.pow(1 + p * 9, 2))
  },
  {
    id: 41, name: 'Sine Chirp', tag: 'Rising frequency',
    color: '#d946ef', curve: p => 0.505 + 0.495 * Math.cos(p * p * Math.PI * 8)
  },
  {
    id: 42, name: 'FM Modulation', tag: 'Freq-modulated',
    color: '#f43f5e', curve: p => {
      const v = 0.5 + 0.49 * Math.sin(p * Math.PI * 4 + 3 * Math.sin(p * Math.PI * 6));
      return Math.max(0.01, v + 0.01);
    }
  },
  {
    id: 43, name: 'AM Modulation', tag: 'Amp-modulated',
    color: '#8b5cf6', curve: p => {
      const carrier = 0.5 + 0.5 * Math.cos(p * Math.PI * 10);
      return Math.max(0.01, carrier * (1 - p * 0.99));
    }
  },
  {
    id: 44, name: 'Beat Frequency', tag: 'Two-tone beat',
    color: '#22c55e', curve: p => {
      const v = 0.5 + 0.49 * Math.cos(p * Math.PI * 2) * Math.cos(p * Math.PI * 2.1);
      return Math.max(0.01, v + 0.01);
    }
  },
  {
    id: 45, name: 'Fractal Noise', tag: 'Multi-octave noise',
    color: '#f97316', curve: p => {
      let v = 0;
      for (let i = 0; i < 4; i++) v += Math.sin(p * Math.PI * Math.pow(2, i + 2)) / Math.pow(2, i);
      v = 0.5 + 0.49 * v;
      return Math.max(0.01, Math.min(1, v));
    }
  },
  {
    id: 46, name: 'Damped Oscillation', tag: 'Decaying sine',
    color: '#0ea5e9', curve: p => Math.max(0.01, Math.exp(-p * 3) * Math.abs(Math.cos(p * Math.PI * 8)))
  },
  {
    id: 47, name: 'Exponential Rise', tag: '1% → 100% exp',
    color: '#ec4899', curve: p => 0.01 + 0.99 * (1 - Math.exp(-p * 5))
  },
  {
    id: 48, name: 'Logarithmic Rise', tag: '1% → 100% log',
    color: '#a855f7', curve: p => 0.01 + 0.99 * Math.log(1 + p * 99) / Math.log(100)
  },
  {
    id: 49, name: 'Hyperbolic', tag: '1 / (1 + p)',
    color: '#10b981', curve: p => Math.max(0.01, 1 / (1 + p * 99))
  },
  {
    id: 50, name: 'Arctangent', tag: 'atan-based curve',
    color: '#3b82f6', curve: p => 1 - 0.99 * (2 / Math.PI) * Math.atan(p * 10)
  }
];
