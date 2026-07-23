/**
 * Visualizer utilities — canvas drawing helpers
 */

export function fitCanvas(canvas) {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
}

export function drawScope(canvas, byteData, color) {
  if (!canvas || !byteData) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const ratio = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);

  // Center line
  ctx.strokeStyle = '#232830';
  ctx.lineWidth = 1 * ratio;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Waveform
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  const slice = w / byteData.length;
  for (let i = 0; i < byteData.length; i++) {
    const v = byteData[i] / 128.0 - 1.0;
    const y = (h / 2) + v * (h / 2) * 0.9;
    const x = i * slice;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function drawCurvePreview(canvas, curveFn, color) {
  if (!canvas) return;
  fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const ratio = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#1f242c';
  ctx.lineWidth = 1 * ratio;
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Curve shape
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    const g = curveFn(p);
    const x = p * w;
    const y = h - ((g - 0.01) / 0.99) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function drawPlayhead(canvas, phase, curveFn, color) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const ratio = window.devicePixelRatio || 1;

  const x = phase * w;
  const g = curveFn(phase);
  const y = h - ((g - 0.01) / 0.99) * h;

  // Vertical line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1 * ratio;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();

  // Dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 4 * ratio, 0, Math.PI * 2);
  ctx.fill();
}
