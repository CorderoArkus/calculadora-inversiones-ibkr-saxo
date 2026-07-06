import { pctToRate } from './brokerFees.js';

export const TAX_DEFAULTS = {
  tobBuyPct: 0.35,
  tobSellPct: 0.35,
  itfBuyPct: 0.20,
  customBuyPct: 0,
  customSellPct: 0
};

export function calculateBuyTax(grossBuy, taxSettings) {
  let rate = 0;
  if (taxSettings.applyTob) rate += pctToRate(taxSettings.tobBuyPct);
  if (taxSettings.spanishItfSubject) rate += pctToRate(taxSettings.itfBuyPct);
  if (taxSettings.applyCustomTax) rate += pctToRate(taxSettings.customBuyPct);
  return Number(grossBuy) * rate;
}

export function calculateSellTax(grossSell, taxSettings) {
  let rate = 0;
  if (taxSettings.applyTob) rate += pctToRate(taxSettings.tobSellPct);
  // La ITF española se aplica solo en compra.
  if (taxSettings.applyCustomTax) rate += pctToRate(taxSettings.customSellPct);
  return Number(grossSell) * rate;
}
