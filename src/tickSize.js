export function decimalPlaces(value) {
  const text = String(value);
  if (text.includes('e-')) {
    const [, exponent] = text.split('e-');
    return Number(exponent);
  }
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function roundUpToTick(price, tickSize) {
  const p = Number(price);
  const t = Number(tickSize);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) {
    throw new Error('Precio y tick size deben ser números válidos y tick > 0.');
  }
  const decimals = Math.min(10, Math.max(decimalPlaces(tickSize), decimalPlaces(price)));
  const factor = 10 ** decimals;
  const tickUnits = Math.round(t * factor);
  const rawUnits = p * factor;
  const priceUnits = Math.ceil(rawUnits - 1e-9);
  const roundedUnits = Math.ceil(priceUnits / tickUnits) * tickUnits;
  return Number((roundedUnits / factor).toFixed(decimals));
}

export function roundDownToTick(price, tickSize) {
  const p = Number(price);
  const t = Number(tickSize);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) {
    throw new Error('Precio y tick size deben ser números válidos y tick > 0.');
  }
  const decimals = Math.min(10, Math.max(decimalPlaces(tickSize), decimalPlaces(price)));
  const factor = 10 ** decimals;
  const tickUnits = Math.round(t * factor);
  const rawUnits = p * factor;
  const priceUnits = Math.floor(rawUnits + 1e-9);
  const roundedUnits = Math.floor(priceUnits / tickUnits) * tickUnits;
  return Number((roundedUnits / factor).toFixed(decimals));
}

export function roundToNearestTick(price, tickSize) {
  const p = Number(price);
  const t = Number(tickSize);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) {
    throw new Error('Precio y tick size deben ser números válidos y tick > 0.');
  }
  const decimals = Math.min(10, Math.max(decimalPlaces(tickSize), decimalPlaces(price)));
  const factor = 10 ** decimals;
  const tickUnits = Math.round(t * factor);
  const rawUnits = p * factor;
  const roundedUnits = Math.round(rawUnits / tickUnits) * tickUnits;
  return Number((roundedUnits / factor).toFixed(decimals));
}

export function formatPriceForTick(price, tickSize) {
  const decimals = Math.max(2, decimalPlaces(tickSize));
  return Number(price).toFixed(decimals);
}
