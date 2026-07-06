import assert from 'node:assert/strict';
import { roundUpToTick } from '../src/tickSize.js';
import { brokerTobDefault } from '../src/brokerFees.js';
import { calculateOperationAtSellPrice, solveMinimumPriceForProfit, solveTargetByReturnPct, calculateScenario, calculateRequiredMovePct, convertResultSummary } from '../src/calculations.js';
import { calculateBuyTax, calculateSellTax } from '../src/taxes.js';

const rates = { eurUsd: 1.10, eurAud: 1.65, usdAud: 1.50 };

function baseInput(overrides = {}) {
  return {
    broker: 'IBKR',
    operationCurrency: 'EUR',
    accountCurrency: 'EUR',
    displayCurrency: 'USD',
    shares: 100,
    buyPrice: 10,
    currentPrice: 11,
    targetPrice: 12,
    targetProfit: 500,
    targetReturnPct: 5,
    tickSize: 0.01,
    mode: 'targetPrice',
    commissionCurrency: 'EUR',
    commissionMin: 0,
    buyCommission: { fixed: 0, percent: 0, perShare: 0 },
    sellCommission: { fixed: 0, percent: 0, perShare: 0 },
    rates,
    fx: {
      enabled: false,
      mode: 'auto',
      fxAutoRatePct: 0.03,
      fxManualRatePct: 0.002,
      fxManualMinAmount: 2,
      fxManualMinCurrency: 'USD'
    },
    tax: {
      applyTob: false,
      tobBuyPct: 0.35,
      tobSellPct: 0.35,
      spanishItfSubject: false,
      itfBuyPct: 0.20,
      applyCustomTax: false,
      customBuyPct: 0,
      customSellPct: 0
    },
    ...overrides
  };
}

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) < epsilon, `Expected ${actual} ≈ ${expected}`);
}

// 1. Operación EUR sin cambio de divisa, sin impuestos.
{
  const r = calculateOperationAtSellPrice(baseInput(), 12);
  close(r.grossBuy, 1000);
  close(r.grossSell, 1200);
  close(r.netPL, 200);
  close(r.netReturnPct, 20);
}

// 2. Operación USD con cuenta EUR, aplicando conversión de divisa en compra y venta.
{
  const input = baseInput({ operationCurrency: 'USD', accountCurrency: 'EUR', commissionCurrency: 'USD', fx: { ...baseInput().fx, enabled: true } });
  const r = calculateOperationAtSellPrice(input, 12);
  close(r.buyFxCost, 1000 * 0.0003);
  close(r.sellFxCost, 1200 * 0.0003);
  close(r.netPL, 200 - 0.3 - 0.36);
}

// 3. Operación AUD con cuenta EUR, aplicando conversión de divisa.
{
  const input = baseInput({ operationCurrency: 'AUD', accountCurrency: 'EUR', commissionCurrency: 'AUD', fx: { ...baseInput().fx, enabled: true } });
  const r = calculateOperationAtSellPrice(input, 12);
  close(r.buyFxCost, 1000 * 0.0003);
  close(r.sellFxCost, 1200 * 0.0003);
}

// 4. Interactive Brokers con TOB belga desactivada por defecto.
assert.equal(brokerTobDefault({ broker: 'IBKR', taxResidency: 'BE', manualTobForIbkr: false }), false);
assert.equal(brokerTobDefault({ broker: 'IBKR', taxResidency: 'BE', manualTobForIbkr: true }), true);

// 5. Saxo Trader con TOB belga activable.
assert.equal(brokerTobDefault({ broker: 'SAXO', taxResidency: 'BE', manualTobForIbkr: false }), true);
assert.equal(brokerTobDefault({ broker: 'SAXO', taxResidency: 'OTHER', manualTobForIbkr: false }), false);

// 6. Acción española sujeta a ITF: 0,20% solo en compra.
{
  const tax = { ...baseInput().tax, spanishItfSubject: true, itfBuyPct: 0.20 };
  close(calculateBuyTax(1000, tax), 2);
  close(calculateSellTax(1200, tax), 0);
}

// 7. Precio objetivo calculado desde beneficio neto.
{
  const input = baseInput({ mode: 'targetProfit', targetProfit: 500 });
  close(solveMinimumPriceForProfit(input, 500), 15);
}

// 8. Precio objetivo calculado desde rentabilidad %.
{
  const input = baseInput({ mode: 'targetReturnPct', targetReturnPct: 5 });
  const solved = solveTargetByReturnPct(input, 5);
  close(solved.targetProfit, 50);
  close(solved.targetPrice, 10.5);
}

// 9. Tick size 0,005 redondeando siempre hacia arriba.
close(roundUpToTick(3.1267, 0.005), 3.13);
close(roundUpToTick(1.3721, 0.01), 1.38);

// 10. Precio actual por debajo del objetivo: mostrar % necesario positivo.
close(calculateRequiredMovePct(12, 10), 20);

// 11. Precio actual por encima del objetivo: mostrar objetivo alcanzado.
close(calculateRequiredMovePct(12, 13), -7.6923076923);

// 12. Resultado principal siempre en divisa de operación.
{
  const scenario = calculateScenario(baseInput({ operationCurrency: 'AUD', accountCurrency: 'EUR', commissionCurrency: 'AUD', targetPrice: 12 }));
  assert.equal(scenario.result.currency, 'AUD');
}

// 13. Resultado adicional en EUR/USD/AUD sin eliminar el resultado principal.
{
  const r = calculateOperationAtSellPrice(baseInput({ operationCurrency: 'USD', commissionCurrency: 'USD' }), 12);
  const converted = convertResultSummary(r, 'USD', 'EUR', rates);
  close(converted.netPL, 200 / 1.10);
  assert.equal(r.currency, 'USD');
  assert.equal(converted.currency, 'EUR');
}

console.log('✅ 13 casos de prueba pasados correctamente.');
