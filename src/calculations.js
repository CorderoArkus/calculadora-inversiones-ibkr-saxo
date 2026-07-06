import { calculateTradeCommission, calculateFxConversionCost } from './brokerFees.js';
import { calculateBuyTax, calculateSellTax } from './taxes.js';
import { convertAmount } from './currency.js';
import { roundUpToTick } from './tickSize.js';

export function calculateOperationAtSellPrice(input, sellPriceRaw) {
  const shares = Number(input.shares);
  const buyPrice = Number(input.buyPrice);
  const sellPrice = Number(sellPriceRaw);

  const grossBuy = shares * buyPrice;
  const buyCommission = calculateTradeCommission({
    grossAmount: grossBuy,
    shares,
    fixed: input.buyCommission.fixed,
    percent: input.buyCommission.percent,
    perShare: input.buyCommission.perShare,
    minimum: input.commissionMin,
    commissionCurrency: input.commissionCurrency,
    operationCurrency: input.operationCurrency,
    rates: input.rates
  });
  const buyTax = calculateBuyTax(grossBuy, input.tax);
  const buyFxBase = grossBuy + buyCommission + buyTax;
  const buyFxCost = calculateFxConversionCost({
    enabled: input.fx.enabled,
    amountInOperationCurrency: buyFxBase,
    accountCurrency: input.accountCurrency,
    operationCurrency: input.operationCurrency,
    fxMode: input.fx.mode,
    fxAutoRatePct: input.fx.fxAutoRatePct,
    fxManualRatePct: input.fx.fxManualRatePct,
    fxManualMinAmount: input.fx.fxManualMinAmount,
    fxManualMinCurrency: input.fx.fxManualMinCurrency,
    rates: input.rates
  });
  const totalEntry = grossBuy + buyCommission + buyTax + buyFxCost;

  const grossSell = shares * sellPrice;
  const sellCommission = calculateTradeCommission({
    grossAmount: grossSell,
    shares,
    fixed: input.sellCommission.fixed,
    percent: input.sellCommission.percent,
    perShare: input.sellCommission.perShare,
    minimum: input.commissionMin,
    commissionCurrency: input.commissionCurrency,
    operationCurrency: input.operationCurrency,
    rates: input.rates
  });
  const sellTax = calculateSellTax(grossSell, input.tax);
  const sellFxBase = Math.max(0, grossSell - sellCommission - sellTax);
  const sellFxCost = calculateFxConversionCost({
    enabled: input.fx.enabled,
    amountInOperationCurrency: sellFxBase,
    accountCurrency: input.accountCurrency,
    operationCurrency: input.operationCurrency,
    fxMode: input.fx.mode,
    fxAutoRatePct: input.fx.fxAutoRatePct,
    fxManualRatePct: input.fx.fxManualRatePct,
    fxManualMinAmount: input.fx.fxManualMinAmount,
    fxManualMinCurrency: input.fx.fxManualMinCurrency,
    rates: input.rates
  });
  const netExit = grossSell - sellCommission - sellTax - sellFxCost;

  const grossPL = grossSell - grossBuy;
  const netPL = netExit - totalEntry;
  const netReturnPct = totalEntry === 0 ? 0 : (netPL / totalEntry) * 100;

  return {
    currency: input.operationCurrency,
    shares,
    buyPrice,
    sellPrice,
    grossBuy,
    buyCommission,
    buyTax,
    buyFxCost,
    totalEntry,
    grossSell,
    sellCommission,
    sellTax,
    sellFxCost,
    netExit,
    grossPL,
    netPL,
    netReturnPct
  };
}

export function conditionNetProfit(input, targetProfit) {
  return price => calculateOperationAtSellPrice(input, price).netPL >= Number(targetProfit) - 1e-7;
}

export function solveMinimumPriceForProfit(input, targetProfit) {
  const tick = Number(input.tickSize);
  const condition = conditionNetProfit(input, targetProfit);

  let low = 0;
  let high = Math.max(Number(input.buyPrice), Number(input.currentPrice || 0), tick) * 1.25;
  let guard = 0;

  while (!condition(high) && guard < 100) {
    high *= 2;
    guard += 1;
  }

  if (guard >= 100) throw new Error('No se pudo encontrar un precio objetivo razonable. Revisa inputs, tasas y comisiones.');

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    if (condition(mid)) high = mid;
    else low = mid;
  }

  let rounded = roundUpToTick(high, tick);
  let i = 0;
  while (!condition(rounded) && i < 10000) {
    rounded = roundUpToTick(rounded + tick, tick);
    i += 1;
  }

  return rounded;
}

export function solveBreakEvenPrice(input) {
  return solveMinimumPriceForProfit(input, 0);
}

export function solveTargetByReturnPct(input, targetReturnPct) {
  const entryOnly = calculateOperationAtSellPrice(input, input.buyPrice).totalEntry;
  const targetProfit = entryOnly * (Number(targetReturnPct) / 100);
  const targetPrice = solveMinimumPriceForProfit(input, targetProfit);
  return { targetProfit, targetPrice };
}

export function calculateRequiredMovePct(targetPrice, currentPrice) {
  const current = Number(currentPrice);
  if (!Number.isFinite(current) || current <= 0) return null;
  return ((Number(targetPrice) - current) / current) * 100;
}

export function calculateScenario(input) {
  const breakEvenPrice = solveBreakEvenPrice(input);
  const breakEven = calculateOperationAtSellPrice(input, breakEvenPrice);

  let rawTargetPrice;
  let targetProfitEquivalent = null;

  if (input.mode === 'targetPrice') {
    rawTargetPrice = Number(input.targetPrice);
  } else if (input.mode === 'targetProfit') {
    targetProfitEquivalent = Number(input.targetProfit);
    rawTargetPrice = solveMinimumPriceForProfit(input, targetProfitEquivalent);
  } else if (input.mode === 'targetReturnPct') {
    const solved = solveTargetByReturnPct(input, input.targetReturnPct);
    targetProfitEquivalent = solved.targetProfit;
    rawTargetPrice = solved.targetPrice;
  } else {
    throw new Error('Modo de cálculo no reconocido.');
  }

  const adjustedTargetPrice = roundUpToTick(rawTargetPrice, Number(input.tickSize));
  const result = calculateOperationAtSellPrice(input, adjustedTargetPrice);
  const rawTargetResult = calculateOperationAtSellPrice(input, rawTargetPrice);
  const requiredMovePct = calculateRequiredMovePct(adjustedTargetPrice, input.currentPrice);

  return {
    inputCurrency: input.operationCurrency,
    result,
    rawTargetResult,
    breakEvenPrice,
    breakEven,
    targetProfitEquivalent,
    rawTargetPrice,
    adjustedTargetPrice,
    requiredMovePct,
    targetReached: requiredMovePct !== null ? requiredMovePct <= 0 : false
  };
}

export function convertResultSummary(result, fromCurrency, toCurrency, rates, includeDisplayFxCost = false, displayFxRatePct = 0) {
  const factor = includeDisplayFxCost && fromCurrency !== toCurrency ? 1 - (Number(displayFxRatePct || 0) / 100) : 1;
  const convert = amount => convertAmount(amount, fromCurrency, toCurrency, rates) * factor;
  return {
    currency: toCurrency,
    grossBuy: convert(result.grossBuy),
    buyCommission: convert(result.buyCommission),
    buyTax: convert(result.buyTax),
    buyFxCost: convert(result.buyFxCost),
    totalEntry: convert(result.totalEntry),
    grossSell: convert(result.grossSell),
    sellCommission: convert(result.sellCommission),
    sellTax: convert(result.sellTax),
    sellFxCost: convert(result.sellFxCost),
    netExit: convert(result.netExit),
    grossPL: convert(result.grossPL),
    netPL: convert(result.netPL)
  };
}
