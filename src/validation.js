import { SUPPORTED_CURRENCIES } from './currency.js';

export function validateInput(input) {
  const errors = [];
  const positive = [
    ['Número de acciones', input.shares],
    ['Precio de compra', input.buyPrice],
    ['Tick size', input.tickSize]
  ];

  if (input.currentPrice !== null && input.currentPrice !== undefined && Number(input.currentPrice) <= 0) {
    errors.push('Precio actual de mercado debe ser > 0 para calcular el porcentaje necesario.');
  }

  for (const [name, value] of positive) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
      errors.push(`${name} debe ser > 0.`);
    }
  }

  for (const currency of [input.operationCurrency, input.accountCurrency, input.displayCurrency, input.commissionCurrency]) {
    if (!SUPPORTED_CURRENCIES.includes(currency)) errors.push(`Divisa inválida: ${currency}.`);
  }

  const rates = input.rates || {};
  for (const [label, value] of [
    ['EUR/USD', rates.eurUsd],
    ['EUR/AUD', rates.eurAud],
    ['USD/AUD', rates.usdAud]
  ]) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) errors.push(`Tipo de cambio ${label} debe ser > 0.`);
  }

  const nonNegativeFields = [
    ['Comisión fija compra', input.buyCommission.fixed],
    ['Comisión fija venta', input.sellCommission.fixed],
    ['Comisión porcentual compra', input.buyCommission.percent],
    ['Comisión porcentual venta', input.sellCommission.percent],
    ['Comisión mínima', input.commissionMin],
    ['Comisión por acción compra', input.buyCommission.perShare],
    ['Comisión por acción venta', input.sellCommission.perShare],
    ['TOB compra', input.tax.tobBuyPct],
    ['TOB venta', input.tax.tobSellPct],
    ['ITF compra', input.tax.itfBuyPct],
    ['Impuesto personalizado compra', input.tax.customBuyPct],
    ['Impuesto personalizado venta', input.tax.customSellPct],
    ['Comisión FX automática', input.fx.fxAutoRatePct],
    ['Comisión FX manual', input.fx.fxManualRatePct],
    ['Mínimo FX manual', input.fx.fxManualMinAmount]
  ];

  for (const [name, value] of nonNegativeFields) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) errors.push(`${name} debe ser >= 0.`);
  }

  const activeModes = ['targetPrice', 'targetProfit', 'targetReturnPct'].filter(mode => input.mode === mode);
  if (activeModes.length !== 1) errors.push('Debe haber un único modo de objetivo activo.');

  if (input.mode === 'targetPrice' && (!Number.isFinite(Number(input.targetPrice)) || Number(input.targetPrice) <= 0)) {
    errors.push('En modo A, el precio de venta objetivo debe ser > 0.');
  }
  if (input.mode === 'targetProfit' && !Number.isFinite(Number(input.targetProfit))) {
    errors.push('En modo B, el beneficio neto objetivo debe ser un número válido.');
  }
  if (input.mode === 'targetReturnPct' && !Number.isFinite(Number(input.targetReturnPct))) {
    errors.push('En modo C, la rentabilidad objetivo debe ser un número válido.');
  }

  return errors;
}
