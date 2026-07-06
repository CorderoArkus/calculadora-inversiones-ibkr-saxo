import { calculateOperationAtSellPrice, calculateScenario } from './calculations.js';

function niceMinMax(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const padding = (max - min) * 0.08;
  return [min - padding, max + padding];
}

function drawText(ctx, text, x, y, align = 'left') {
  ctx.font = '12px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function inputForChart(input, options) {
  const chartInput = JSON.parse(JSON.stringify(input));
  if (!options.showTaxes) {
    chartInput.tax.applyTob = false;
    chartInput.tax.spanishItfSubject = false;
    chartInput.tax.applyCustomTax = false;
  }
  if (!options.showCommissions) {
    chartInput.commissionMin = 0;
    chartInput.buyCommission = { fixed: 0, percent: 0, perShare: 0 };
    chartInput.sellCommission = { fixed: 0, percent: 0, perShare: 0 };
  }
  if (!options.showFxImpact) {
    chartInput.fx.enabled = false;
  }
  return chartInput;
}

export function drawInvestmentChart(canvas, input, scenario, options) {
  const chartInput = inputForChart(input, options);
  const chartScenario = calculateScenario(chartInput);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 22, right: 28, bottom: 42, left: 68 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const auto = options.autoRange;
  const minPrice = auto ? Math.max(0.0001, Math.min(chartInput.buyPrice, chartInput.currentPrice, chartScenario.adjustedTargetPrice, chartScenario.breakEvenPrice) * 0.85) : Number(options.minPrice);
  const maxPrice = auto ? Math.max(chartInput.buyPrice, chartInput.currentPrice, chartScenario.adjustedTargetPrice, chartScenario.breakEvenPrice) * 1.15 : Number(options.maxPrice);
  const step = Math.max(Number(options.stepPrice || chartInput.tickSize), Number(chartInput.tickSize));

  const data = [];
  for (let price = minPrice; price <= maxPrice + step / 2; price += step) {
    const r = calculateOperationAtSellPrice(chartInput, price);
    data.push({ price, netPL: r.netPL });
  }

  if (data.length < 2) return;

  const xValues = data.map(d => d.netPL);
  if (options.showBreakEven) xValues.push(0);
  const [xMin, xMax] = niceMinMax(xValues);
  const yMin = minPrice;
  const yMax = maxPrice;

  const x = value => padding.left + ((value - xMin) / (xMax - xMin)) * plotW;
  const y = price => padding.top + plotH - ((price - yMin) / (yMax - yMin)) * plotH;

  // Fondo y zonas.
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, width, height);
  const zeroX = x(0);
  if (zeroX > padding.left && zeroX < padding.left + plotW) {
    ctx.fillStyle = 'rgba(171, 92, 78, 0.10)';
    ctx.fillRect(padding.left, padding.top, zeroX - padding.left, plotH);
    ctx.fillStyle = 'rgba(71, 138, 96, 0.12)';
    ctx.fillRect(zeroX, padding.top, padding.left + plotW - zeroX, plotH);
  }

  // Grid.
  ctx.strokeStyle = 'rgba(67, 91, 67, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const yy = padding.top + (plotH * i) / 5;
    ctx.beginPath(); ctx.moveTo(padding.left, yy); ctx.lineTo(padding.left + plotW, yy); ctx.stroke();
  }
  for (let i = 0; i <= 5; i += 1) {
    const xx = padding.left + (plotW * i) / 5;
    ctx.beginPath(); ctx.moveTo(xx, padding.top); ctx.lineTo(xx, padding.top + plotH); ctx.stroke();
  }

  // Ejes.
  ctx.strokeStyle = '#45634f';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(padding.left, padding.top); ctx.lineTo(padding.left, padding.top + plotH); ctx.lineTo(padding.left + plotW, padding.top + plotH); ctx.stroke();
  if (zeroX > padding.left && zeroX < padding.left + plotW) {
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(zeroX, padding.top); ctx.lineTo(zeroX, padding.top + plotH); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Línea P/L neto, X=P/L, Y=precio.
  ctx.strokeStyle = '#267f57';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  data.forEach((d, idx) => {
    const xx = x(d.netPL);
    const yy = y(d.price);
    if (idx === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  });
  ctx.stroke();

  const point = (label, price, netPL, visible = true) => {
    if (!visible || price < yMin || price > yMax || netPL < xMin || netPL > xMax) return;
    const xx = x(netPL);
    const yy = y(price);
    ctx.fillStyle = '#1f5138';
    ctx.beginPath(); ctx.arc(xx, yy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#27352c';
    drawText(ctx, label, xx + 8, yy - 8);
  };

  point('Compra', chartInput.buyPrice, calculateOperationAtSellPrice(chartInput, chartInput.buyPrice).netPL, true);
  point('Actual', chartInput.currentPrice, calculateOperationAtSellPrice(chartInput, chartInput.currentPrice).netPL, options.showCurrent);
  point('Break-even', chartScenario.breakEvenPrice, 0, options.showBreakEven);
  point('Objetivo', chartScenario.adjustedTargetPrice, chartScenario.result.netPL, options.showTarget);

  ctx.fillStyle = '#27352c';
  drawText(ctx, `X = Beneficio/Pérdida neta (${chartInput.operationCurrency})`, padding.left + plotW / 2, height - 12, 'center');
  ctx.save();
  ctx.translate(17, padding.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  drawText(ctx, 'Y = Precio de la acción', 0, 0, 'center');
  ctx.restore();

  for (let i = 0; i <= 5; i += 1) {
    const val = xMin + ((xMax - xMin) * i) / 5;
    drawText(ctx, val.toFixed(0), x(val), padding.top + plotH + 18, 'center');
  }
  for (let i = 0; i <= 5; i += 1) {
    const val = yMin + ((yMax - yMin) * i) / 5;
    drawText(ctx, val.toFixed(3), padding.left - 9, y(val) + 4, 'right');
  }
}
