import { convertAmount } from './currency.js';

export const BROKERS = {
  IBKR: 'Interactive Brokers',
  SAXO: 'Saxo Trader'
};

export const BROKER_DEFAULTS = {
  IBKR: {
    fxAutoRatePct: 0.03,
    fxManualRatePct: 0.002,
    fxManualMinAmount: 2,
    fxManualMinCurrency: 'USD',
    commissionCurrency: 'USD',
    perShareBuy: 0.005,
    perShareSell: 0.005,
    commissionMin: 1,
    commissionFixedBuy: 0,
    commissionFixedSell: 0,
    commissionPctBuy: 0,
    commissionPctSell: 0
  },
  SAXO: {
    fxAutoRatePct: 0.25,
    fxManualRatePct: 0.25,
    fxManualMinAmount: 0,
    fxManualMinCurrency: 'EUR',
    commissionCurrency: 'EUR',
    perShareBuy: 0,
    perShareSell: 0,
    commissionMin: 3,
    commissionFixedBuy: 0,
    commissionFixedSell: 0,
    commissionPctBuy: 0.08,
    commissionPctSell: 0.08
  }
};

export function pctToRate(pct) {
  return Number(pct || 0) / 100;
}

export function calculateTradeCommission({
  grossAmount,
  shares,
  fixed = 0,
  percent = 0,
  perShare = 0,
  minimum = 0,
  commissionCurrency,
  operationCurrency,
  rates
}) {
  const gross = Number(grossAmount);
  const n = Number(shares);
  const fixedOp = convertAmount(Number(fixed || 0), commissionCurrency, operationCurrency, rates);
  const perShareOp = convertAmount(Number(perShare || 0), commissionCurrency, operationCurrency, rates) * n;
  const minimumOp = convertAmount(Number(minimum || 0), commissionCurrency, operationCurrency, rates);
  const pctOp = gross * pctToRate(percent);
  const beforeMin = fixedOp + pctOp + perShareOp;
  return Math.max(beforeMin, minimumOp);
}

export function getDefaultFxRatePct(broker, mode) {
  const defaults = BROKER_DEFAULTS[broker] || BROKER_DEFAULTS.IBKR;
  return mode === 'manual' ? defaults.fxManualRatePct : defaults.fxAutoRatePct;
}

export function calculateFxConversionCost({
  enabled,
  amountInOperationCurrency,
  accountCurrency,
  operationCurrency,
  fxMode,
  fxAutoRatePct,
  fxManualRatePct,
  fxManualMinAmount,
  fxManualMinCurrency,
  rates
}) {
  const base = Math.abs(Number(amountInOperationCurrency || 0));
  if (!enabled || accountCurrency === operationCurrency || base === 0) return 0;

  const ratePct = fxMode === 'manual' ? fxManualRatePct : fxAutoRatePct;
  const percentageCost = base * pctToRate(ratePct);

  if (fxMode !== 'manual') return percentageCost;

  const minCost = convertAmount(
    Number(fxManualMinAmount || 0),
    fxManualMinCurrency,
    operationCurrency,
    rates
  );

  return Math.max(percentageCost, minCost);
}

export function brokerTobDefault({ broker, taxResidency, manualTobForIbkr }) {
  if (broker === 'IBKR') return Boolean(manualTobForIbkr);
  if (broker === 'SAXO' && taxResidency === 'BE') return true;
  return false;
}
