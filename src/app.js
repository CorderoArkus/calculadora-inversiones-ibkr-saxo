import { BROKER_DEFAULTS, brokerTobDefault } from './brokerFees.js';
import { TAX_DEFAULTS } from './taxes.js';
import { validateInput } from './validation.js';
import { calculateScenario, convertResultSummary } from './calculations.js';
import { formatPriceForTick, roundDownToTick, roundToNearestTick, roundUpToTick } from './tickSize.js';
import { drawInvestmentChart } from './chart.js';

const $ = id => document.getElementById(id);
const num = id => Number($(id).value || 0);
const val = id => $(id).value;
const checked = id => $(id).checked;

function money(value, currency) {
  if (!Number.isFinite(Number(value))) return `— ${currency}`;
  return `${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function pct(value) {
  if (value === null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function currentMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || 'targetPrice';
}

function applyBrokerDefaults() {
  const broker = val('broker');
  const d = BROKER_DEFAULTS[broker];
  $('fxAutoRatePct').value = d.fxAutoRatePct;
  $('fxManualRatePct').value = d.fxManualRatePct;
  $('fxManualMinAmount').value = d.fxManualMinAmount;
  $('fxManualMinCurrency').value = d.fxManualMinCurrency;
  $('commissionCurrency').value = d.commissionCurrency;
  $('commissionPerShareBuy').value = d.perShareBuy;
  $('commissionPerShareSell').value = d.perShareSell;
  $('commissionMin').value = d.commissionMin;
  $('commissionFixedBuy').value = d.commissionFixedBuy;
  $('commissionFixedSell').value = d.commissionFixedSell;
  $('commissionPctBuy').value = d.commissionPctBuy;
  $('commissionPctSell').value = d.commissionPctSell;
  applyTaxDefaultsForBroker();
}

function applyTaxDefaultsForBroker() {
  const broker = val('broker');
  const taxResidency = val('taxResidency');
  const manualTobForIbkr = checked('manualTobForIbkr');
  $('applyTob').checked = brokerTobDefault({ broker, taxResidency, manualTobForIbkr });
  $('ibkrManualHint').hidden = broker !== 'IBKR';
}

function updateModeVisibility() {
  const mode = currentMode();
  $('targetPriceBox').hidden = mode !== 'targetPrice';
  $('targetProfitBox').hidden = mode !== 'targetProfit';
  $('targetReturnBox').hidden = mode !== 'targetReturnPct';
}

function readInput() {
  return {
    ticker: val('ticker'),
    market: val('market'),
    broker: val('broker'),
    operationCurrency: val('operationCurrency'),
    accountCurrency: val('accountCurrency'),
    displayCurrency: val('displayCurrency'),
    shares: num('shares'),
    buyPrice: readTickedPrice('buyPrice', 'nearest'),
    currentPrice: readTickedPrice('currentPrice', 'nearest'),
    targetPrice: readTickedPrice('targetPrice', 'up'),
    targetProfit: num('targetProfit'),
    targetReturnPct: num('targetReturnPct'),
    tickSize: num('tickSize'),
    mode: currentMode(),
    commissionCurrency: val('commissionCurrency'),
    commissionMin: num('commissionMin'),
    buyCommission: {
      fixed: num('commissionFixedBuy'),
      percent: num('commissionPctBuy'),
      perShare: num('commissionPerShareBuy')
    },
    sellCommission: {
      fixed: num('commissionFixedSell'),
      percent: num('commissionPctSell'),
      perShare: num('commissionPerShareSell')
    },
    rates: {
      eurUsd: num('eurUsd'),
      eurAud: num('eurAud'),
      usdAud: num('usdAud')
    },
    fx: {
      enabled: checked('fxEnabled'),
      mode: val('fxMode'),
      fxAutoRatePct: num('fxAutoRatePct'),
      fxManualRatePct: num('fxManualRatePct'),
      fxManualMinAmount: num('fxManualMinAmount'),
      fxManualMinCurrency: val('fxManualMinCurrency')
    },
    tax: {
      applyTob: checked('applyTob'),
      tobBuyPct: num('tobBuyPct'),
      tobSellPct: num('tobSellPct'),
      spanishItfSubject: checked('spanishItfSubject'),
      itfBuyPct: num('itfBuyPct'),
      applyCustomTax: checked('applyCustomTax'),
      customBuyPct: num('customBuyPct'),
      customSellPct: num('customSellPct')
    }
  };
}

function setErrors(errors) {
  const box = $('errors');
  if (!errors.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `<strong>Revisa estos puntos:</strong><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
}

function row(label, value, highlight = false, valueClass = '') {
  const strongClass = valueClass ? ` class="${valueClass}"` : '';
  return `<div class="result-row ${highlight ? 'highlight' : ''}"><span>${label}</span><strong${strongClass}>${value}</strong></div>`;
}

function sectionTitle(title, subtitle = '') {
  return `<div class="result-section-title"><strong>${title}</strong>${subtitle ? `<span>${subtitle}</span>` : ''}</div>`;
}

const PRICE_INPUT_IDS = ['buyPrice', 'currentPrice', 'targetPrice', 'chartMinPrice', 'chartMaxPrice', 'chartStepPrice'];

function getTick() {
  const tick = num('tickSize');
  return Number.isFinite(tick) && tick > 0 ? tick : null;
}

function syncTickBasedInputs() {
  const tick = getTick();
  if (!tick) return;
  const step = String(tick);

  // TODOS los campos que representan precios del instrumento se mueven con el tick.
  // No se aplica a comisiones, impuestos, FX ni tipos de cambio.
  for (const inputId of PRICE_INPUT_IDS) {
    const field = $(inputId);
    if (field) field.step = step;
  }

  if (Number($('chartStepPrice').value || 0) <= 0) {
    $('chartStepPrice').value = formatPriceForTick(tick, tick);
  }
}

function snapPriceValueToTick(value, tick, mode = 'nearest') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isFinite(tick) || tick <= 0) return numeric;
  if (mode === 'up') return roundUpToTick(numeric, tick);
  if (mode === 'down') return roundDownToTick(numeric, tick);
  return roundToNearestTick(numeric, tick);
}

function snapInputToTick(inputId, mode = 'nearest') {
  const tick = getTick();
  const field = $(inputId);
  if (!field || !tick) return;
  const value = Number(field.value);
  if (!Number.isFinite(value)) return;

  let snapped;
  if (inputId === 'chartStepPrice') {
    // El incremento del gráfico no puede ser menor que un tick y debe ser múltiplo del tick.
    snapped = Math.max(tick, roundUpToTick(Math.max(value, tick), tick));
  } else {
    snapped = snapPriceValueToTick(value, tick, mode);
  }
  field.value = formatPriceForTick(snapped, tick);
}

function snapAllPriceInputsToTick() {
  snapInputToTick('buyPrice', 'nearest');
  snapInputToTick('currentPrice', 'nearest');
  snapInputToTick('targetPrice', 'up');
  snapInputToTick('chartMinPrice', 'down');
  snapInputToTick('chartMaxPrice', 'up');
  snapInputToTick('chartStepPrice', 'up');
}

function readTickedPrice(inputId, mode = 'nearest') {
  const tick = getTick();
  const value = num(inputId);
  return tick ? snapPriceValueToTick(value, tick, mode) : value;
}

function currentPriceSliderBounds(input, scenario) {
  const tick = Number(input.tickSize);
  const values = [
    input.buyPrice,
    input.currentPrice,
    scenario.breakEvenPrice,
    scenario.adjustedTargetPrice,
    scenario.rawTargetPrice
  ].map(Number).filter(v => Number.isFinite(v) && v > 0);

  const rawMin = checked('autoRange')
    ? Math.max(tick, Math.min(...values) * 0.85)
    : Math.max(tick, num('chartMinPrice'));
  const rawMax = checked('autoRange')
    ? Math.max(...values) * 1.15
    : Math.max(num('chartMaxPrice'), input.currentPrice + tick);

  const min = Math.max(0, roundDownToTick(rawMin, tick));
  const max = Math.max(min + tick, roundUpToTick(rawMax, tick));
  return { min, max };
}

function setCurrentPriceFromToolbar(rawValue) {
  const tick = getTick();
  if (!tick) return;
  const value = Math.max(tick, roundToNearestTick(Number(rawValue), tick));
  $('currentPrice').value = formatPriceForTick(value, tick);
  recalculate();
}

function moveCurrentPriceByTicks(deltaTicks) {
  const tick = getTick();
  const current = num('currentPrice');
  if (!Number.isFinite(tick) || tick <= 0 || !Number.isFinite(current)) return;
  setCurrentPriceFromToolbar(current + (Number(deltaTicks) * tick));
}

function syncCurrentPriceToolbar(input, scenario) {
  const slider = $('currentPriceSlider');
  const output = $('currentPriceSliderValue');
  const tick = Number(input.tickSize);
  if (!slider || !output || !Number.isFinite(tick) || tick <= 0) return;

  const bounds = currentPriceSliderBounds(input, scenario);
  const snappedCurrent = roundToNearestTick(input.currentPrice, tick);
  slider.min = String(bounds.min);
  slider.max = String(bounds.max);
  slider.step = String(tick);
  slider.value = String(Math.min(bounds.max, Math.max(bounds.min, snappedCurrent)));
  output.textContent = `${formatPriceForTick(snappedCurrent, tick)} ${input.operationCurrency}`;
}

function renderCurrentSnapshot(input, scenario) {
  const cr = scenario.currentResult;
  const c = cr.currency;
  const netClass = cr.netPL >= 0 ? 'positive' : 'negative';
  const grossClass = cr.grossPL >= 0 ? 'positive' : 'negative';
  const moveToTarget = scenario.requiredMovePct === null
    ? '—'
    : `${pct(scenario.requiredMovePct)} ${scenario.targetReached ? '· objetivo alcanzado' : '· hasta objetivo'}`;

  $('currentSnapshot').innerHTML = `
    <div class="snapshot-item">
      <span>Precio actual</span>
      <strong>${formatPriceForTick(input.currentPrice, input.tickSize)} ${c}</strong>
    </div>
    <div class="snapshot-item">
      <span>P/L neto actual si vendes ahora</span>
      <strong class="${netClass}">${money(cr.netPL, c)}</strong>
    </div>
    <div class="snapshot-item">
      <span>Rentabilidad neta actual</span>
      <strong class="${netClass}">${pct(cr.netReturnPct)}</strong>
    </div>
    <div class="snapshot-item">
      <span>P/L bruto actual</span>
      <strong class="${grossClass}">${money(cr.grossPL, c)}</strong>
    </div>
    <div class="snapshot-item">
      <span>Movimiento desde compra</span>
      <strong>${pct(scenario.currentMoveFromBuyPct)}</strong>
    </div>
    <div class="snapshot-item">
      <span>Movimiento pendiente hasta objetivo</span>
      <strong>${moveToTarget}</strong>
    </div>
  `;
}

function renderResults(input, scenario) {
  const r = scenario.result;
  const c = r.currency;
  const priceFmt = p => `${formatPriceForTick(p, input.tickSize)} ${c}`;
  const moveText = scenario.requiredMovePct === null
    ? '—'
    : `${pct(scenario.requiredMovePct)} ${scenario.targetReached ? ' · objetivo alcanzado' : ' · pendiente'}`;

  const current = scenario.currentResult;
  const currentNetClass = current.netPL >= 0 ? 'positive' : 'negative';
  const currentGrossClass = current.grossPL >= 0 ? 'positive' : 'negative';
  const targetNetClass = r.netPL >= 0 ? 'positive' : 'negative';

  $('primaryResults').innerHTML = [
    row('Divisa principal', c, true),

    sectionTitle(
      'Situación actual: P/L si vendes ahora',
      'Usa el precio actual como precio de venta y aplica la misma configuración de broker, impuestos, comisiones, FX y tick.'
    ),
    row('Precio de compra', priceFmt(input.buyPrice)),
    row('Precio actual de mercado', priceFmt(input.currentPrice), true),
    row('Movimiento del precio vs compra', pct(scenario.currentMoveFromBuyPct)),
    row('P/L bruto actual vs compra', money(current.grossPL, c), false, currentGrossClass),
    row('Coste total de entrada ya cargado', money(current.totalEntry, c)),
    row('Importe neto de salida si vendes ahora', money(current.netExit, c)),
    row('P/L neto actual después de costes', money(current.netPL, c), true, currentNetClass),
    row('Rentabilidad neta actual', pct(current.netReturnPct), true, currentNetClass),

    sectionTitle('Desglose de entrada'),
    row('Coste bruto de compra', money(r.grossBuy, c)),
    row('Comisión de compra', money(r.buyCommission, c)),
    row('Impuesto de compra', money(r.buyTax, c)),
    row('Coste conversión compra', money(r.buyFxCost, c)),
    row('Coste total de entrada', money(r.totalEntry, c), true),

    sectionTitle('Objetivo / simulación de venta'),
    row('Importe bruto de venta objetivo', money(r.grossSell, c)),
    row('Comisión de venta objetivo', money(r.sellCommission, c)),
    row('Impuesto de venta objetivo', money(r.sellTax, c)),
    row('Coste conversión venta objetivo', money(r.sellFxCost, c)),
    row('Importe neto de salida objetivo', money(r.netExit, c), true),
    row('Beneficio/Pérdida bruto objetivo', money(r.grossPL, c)),
    row('Beneficio/Pérdida neto objetivo', money(r.netPL, c), true, targetNetClass),
    row('Rentabilidad neta objetivo %', pct(r.netReturnPct), true, targetNetClass),
    row('Precio break-even', priceFmt(scenario.breakEvenPrice)),
    row('Precio objetivo introducido/calculado', priceFmt(scenario.rawTargetPrice)),
    row('Precio objetivo ajustado al tick', priceFmt(scenario.adjustedTargetPrice), true),
    row('Beneficio neto real al precio ajustado', money(r.netPL, c), true, targetNetClass),
    row('% necesario desde precio actual', moveText, true)
  ].join('');

  const dc = input.displayCurrency;
  if (dc === c) {
    $('additionalResults').innerHTML = `<p class="muted">La divisa adicional coincide con la divisa de operación. El resultado principal ya está en ${c}.</p>`;
  } else {
    const converted = convertResultSummary(
      r,
      c,
      dc,
      input.rates,
      checked('includeDisplayFxCost'),
      num('displayFxRatePct')
    );
    $('additionalResults').innerHTML = [
      row('Divisa adicional', dc, true),
      row('Coste total de entrada', money(converted.totalEntry, dc)),
      row('Importe neto de salida', money(converted.netExit, dc)),
      row('Beneficio/Pérdida bruto objetivo', money(converted.grossPL, dc)),
      row('Beneficio/Pérdida neto objetivo', money(converted.netPL, dc), true),
      row('P/L neto actual si vendes ahora', money(convertResultSummary(scenario.currentResult, c, dc, input.rates, checked('includeDisplayFxCost'), num('displayFxRatePct')).netPL, dc), true),
      checked('includeDisplayFxCost') ? row('Ajuste aplicado', `-${num('displayFxRatePct')}% por conversión visual`) : row('Ajuste aplicado', 'Sin coste de conversión visual')
    ].join('');
  }

  $('auditBox').innerHTML = `
    <p><strong>Entrada:</strong> bruto compra + comisión compra + impuesto compra + coste FX compra.</p>
    <p><strong>Salida:</strong> bruto venta − comisión venta − impuesto venta − coste FX venta.</p>
    <p><strong>FX:</strong> ${input.fx.enabled ? 'activado' : 'desactivado'}; solo se carga si divisa de cuenta (${input.accountCurrency}) y divisa de operación (${input.operationCurrency}) son distintas.</p>
    <p><strong>Tick:</strong> todos los precios del instrumento usan tick ${input.tickSize}; compra/actual se ajustan al tick más cercano, objetivo/break-even siempre hacia arriba.</p>
  `;
}

function chartOptions() {
  const tick = getTick();
  const rawStep = num('chartStepPrice');
  return {
    autoRange: checked('autoRange'),
    minPrice: tick ? roundDownToTick(num('chartMinPrice'), tick) : num('chartMinPrice'),
    maxPrice: tick ? roundUpToTick(num('chartMaxPrice'), tick) : num('chartMaxPrice'),
    stepPrice: tick ? Math.max(tick, roundUpToTick(Math.max(rawStep, tick), tick)) : rawStep,
    showBreakEven: checked('showBreakEven'),
    showCurrent: checked('showCurrent'),
    showTarget: checked('showTarget'),
    showTaxes: checked('showTaxes'),
    showCommissions: checked('showCommissions'),
    showFxImpact: checked('showFxImpact')
  };
}

function recalculate() {
  updateModeVisibility();
  syncTickBasedInputs();
  const input = readInput();
  const errors = validateInput(input);
  setErrors(errors);
  if (errors.length) return;

  try {
    const scenario = calculateScenario(input);
    renderCurrentSnapshot(input, scenario);
    renderResults(input, scenario);
    syncCurrentPriceToolbar(input, scenario);
    drawInvestmentChart($('plChart'), input, scenario, chartOptions());
  } catch (error) {
    setErrors([error.message]);
  }
}

function setupEvents() {
  document.querySelectorAll('input, select').forEach(el => {
    if (el.id === 'currentPriceSlider') return;
    el.addEventListener('input', recalculate);
    el.addEventListener('change', recalculate);
  });
  document.querySelectorAll('input[name="mode"]').forEach(el => el.addEventListener('change', updateModeVisibility));
  $('broker').addEventListener('change', () => { applyBrokerDefaults(); recalculate(); });
  $('taxResidency').addEventListener('change', () => { applyTaxDefaultsForBroker(); recalculate(); });
  $('manualTobForIbkr').addEventListener('change', () => { applyTaxDefaultsForBroker(); recalculate(); });
  $('tickSize').addEventListener('input', syncTickBasedInputs);
  $('tickSize').addEventListener('change', () => { syncTickBasedInputs(); snapAllPriceInputsToTick(); recalculate(); });
  $('buyPrice').addEventListener('blur', () => { snapInputToTick('buyPrice', 'nearest'); recalculate(); });
  $('currentPrice').addEventListener('blur', () => { snapInputToTick('currentPrice', 'nearest'); recalculate(); });
  $('targetPrice').addEventListener('blur', () => { snapInputToTick('targetPrice', 'up'); recalculate(); });
  $('chartMinPrice').addEventListener('blur', () => { snapInputToTick('chartMinPrice', 'down'); recalculate(); });
  $('chartMaxPrice').addEventListener('blur', () => { snapInputToTick('chartMaxPrice', 'up'); recalculate(); });
  $('chartStepPrice').addEventListener('blur', () => { snapInputToTick('chartStepPrice', 'up'); recalculate(); });
  $('currentPriceSlider').addEventListener('input', event => setCurrentPriceFromToolbar(event.target.value));
  $('currentPriceDown').addEventListener('click', () => moveCurrentPriceByTicks(-1));
  $('currentPriceUp').addEventListener('click', () => moveCurrentPriceByTicks(1));
  $('resetBrokerDefaults').addEventListener('click', () => { applyBrokerDefaults(); recalculate(); });
  window.addEventListener('resize', recalculate);
}

function init() {
  $('tobBuyPct').value = TAX_DEFAULTS.tobBuyPct;
  $('tobSellPct').value = TAX_DEFAULTS.tobSellPct;
  $('itfBuyPct').value = TAX_DEFAULTS.itfBuyPct;
  $('customBuyPct').value = TAX_DEFAULTS.customBuyPct;
  $('customSellPct').value = TAX_DEFAULTS.customSellPct;
  applyBrokerDefaults();
  setupEvents();
  updateModeVisibility();
  syncTickBasedInputs();
  snapAllPriceInputsToTick();
  recalculate();
}

init();
