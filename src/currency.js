export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'AUD'];

export function assertCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error(`Divisa no soportada: ${currency}`);
  }
}

export function normalizeRates(rates) {
  return {
    eurUsd: Number(rates.eurUsd),
    eurAud: Number(rates.eurAud),
    usdAud: Number(rates.usdAud)
  };
}

export function getFxRate(fromCurrency, toCurrency, rates) {
  assertCurrency(fromCurrency);
  assertCurrency(toCurrency);
  if (fromCurrency === toCurrency) return 1;

  const r = normalizeRates(rates);
  for (const [key, value] of Object.entries(r)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Tipo de cambio inválido: ${key}`);
    }
  }

  const pair = `${fromCurrency}_${toCurrency}`;
  const direct = {
    EUR_USD: r.eurUsd,
    USD_EUR: 1 / r.eurUsd,
    EUR_AUD: r.eurAud,
    AUD_EUR: 1 / r.eurAud,
    USD_AUD: r.usdAud,
    AUD_USD: 1 / r.usdAud
  };

  if (direct[pair]) return direct[pair];

  // Seguridad extra por si se amplían divisas en el futuro.
  const toEur = getFxRate(fromCurrency, 'EUR', rates);
  const eurToTarget = getFxRate('EUR', toCurrency, rates);
  return toEur * eurToTarget;
}

export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  return Number(amount) * getFxRate(fromCurrency, toCurrency, rates);
}

export function convertMoney(amount, fromCurrency, toCurrency, rates) {
  return {
    amount: convertAmount(amount, fromCurrency, toCurrency, rates),
    currency: toCurrency
  };
}
