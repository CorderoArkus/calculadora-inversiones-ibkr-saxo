import { BROKER_DEFAULTS, brokerTobDefault } from './brokerFees.js';
import { TAX_DEFAULTS } from './taxes.js';
import { validateInput } from './validation.js';
import { calculateScenario, convertResultSummary } from './calculations.js';
import { formatPriceForTick } from './tickSize.js';
import { drawInvestmentChart } from './chart.js';

const $ = id => document.getElementById(id);
const num = id => Number($(id).value || 0);
const val = id => $(id).value;
const checked = id => $(id).checked;

function money(value, currency) {
  const decimals = Math.abs(value) >= 1000 ? 2 : 4;
  return `${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: decimals })} ${currency}`;
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
    buyPrice: num('buyPrice'),
    currentPrice: num('currentPrice'),
    targetPrice: num('targetPrice'),
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

function row(label, value, highlight = false) {
  return `<div class="result-row ${highlight ? 'highlight' : ''}"><span>${label}</span><strong>${value}</strong></div>`;
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

  $('primaryResults').innerHTML = [
    row('Divisa principal', c, true),
    row('Precio actual de mercado', priceFmt(input.currentPrice), true),
    row('P/L bruto actual si vendes ahora', money(scenario.currentResult.grossPL, c)),
    row('P/L neto actual si vendes ahora', money(scenario.currentResult.netPL, c), true),
    row('Rentabilidad neta actual', pct(scenario.currentResult.netReturnPct), true),
    row('Coste bruto de compra', money(r.grossBuy, c)),
    row('Comisión de compra', money(r.buyCommission, c)),
    row('Impuesto de compra', money(r.buyTax, c)),
    row('Coste conversión compra', money(r.buyFxCost, c)),
    row('Coste total de entrada', money(r.totalEntry, c), true),
    row('Importe bruto de venta', money(r.grossSell, c)),
    row('Comisión de venta', money(r.sellCommission, c)),
    row('Impuesto de venta', money(r.sellTax, c)),
    row('Coste conversión venta', money(r.sellFxCost, c)),
    row('Importe neto de salida', money(r.netExit, c), true),
    row('Beneficio/Pérdida bruto', money(r.grossPL, c)),
    row('Beneficio/Pérdida neto', money(r.netPL, c), true),
    row('Rentabilidad neta %', pct(r.netReturnPct), true),
    row('Precio break-even', priceFmt(scenario.breakEvenPrice)),
    row('Precio objetivo introducido/calculado', priceFmt(scenario.rawTargetPrice)),
    row('Precio objetivo ajustado al tick', priceFmt(scenario.adjustedTargetPrice), true),
    row('Beneficio neto real al precio ajustado', money(r.netPL, c), true),
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
    <p><strong>Tick:</strong> objetivos y break-even se redondean siempre hacia arriba con tick ${input.tickSize}.</p>
  `;
}

function chartOptions() {
  return {
    autoRange: checked('autoRange'),
    minPrice: num('chartMinPrice'),
    maxPrice: num('chartMaxPrice'),
    stepPrice: num('chartStepPrice'),
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
  const input = readInput();
  const errors = validateInput(input);
  setErrors(errors);
  if (errors.length) return;

  try {
    const scenario = calculateScenario(input);
    renderCurrentSnapshot(input, scenario);
    renderResults(input, scenario);
    drawInvestmentChart($('plChart'), input, scenario, chartOptions());
  } catch (error) {
    setErrors([error.message]);
  }
}

function setupEvents() {
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', recalculate);
    el.addEventListener('change', recalculate);
  });
  document.querySelectorAll('input[name="mode"]').forEach(el => el.addEventListener('change', updateModeVisibility));
  $('broker').addEventListener('change', () => { applyBrokerDefaults(); recalculate(); });
  $('taxResidency').addEventListener('change', () => { applyTaxDefaultsForBroker(); recalculate(); });
  $('manualTobForIbkr').addEventListener('change', () => { applyTaxDefaultsForBroker(); recalculate(); });
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
  recalculate();
}

init();
