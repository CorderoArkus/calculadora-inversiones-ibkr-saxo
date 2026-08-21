const $ = (id) => document.getElementById(id);

const fields = [
  "instrumentName", "instrumentTicker", "instrumentExchange", "operationNotes",
  "broker", "market", "accountCurrency", "assetCurrency", "resultCurrency", "tickSize",
  "shares", "positionLong", "positionShort", "buyPrice", "currentPrice", "sellPrice", "targetProfit", "targetModePrice", "targetModeProfit", "stopModePrice", "stopModeLoss", "stopPrice", "maxLoss",
  "fxBuyRate", "fxSellRate", "fxResultRate", "fxBuyPct", "fxSellPct", "applyFxBuy", "applyFxSell",
  "buyFeeMode", "buyFeeValue", "buyFeeMin", "buyFeeMax",
  "sellFeeMode", "sellFeeValue", "sellFeeMin", "sellFeeMax",
  "taxPreset", "taxBuyPct", "taxSellPct", "scenarioLow", "scenarioMid", "scenarioHigh",
  "chartMin", "chartMax", "chartMetric"
];

const currencySymbols = { EUR: "€", USD: "$", AUD: "A$" };

const brokerPresets = {
  saxo: {
    buyFeeMode: "percent", sellFeeMode: "percent",
    buyFeeValue: 0.08, sellFeeValue: 0.08,
    buyFeeMin: 6, sellFeeMin: 6,
    buyFeeMax: "", sellFeeMax: "",
    fxBuyPct: 0.25, fxSellPct: 0.25,
  },
  ibkr: {
    buyFeeMode: "perShare", sellFeeMode: "perShare",
    buyFeeValue: 0.005, sellFeeValue: 0.005,
    buyFeeMin: 1, sellFeeMin: 1,
    buyFeeMax: "", sellFeeMax: "",
    fxBuyPct: 0.03, fxSellPct: 0.03,
  },
  manual: {}
};

const marketPresets = {
  europe: { assetCurrency: "EUR", tickSize: 0.005 },
  usa: { assetCurrency: "USD", tickSize: 0.01 },
  australia: { assetCurrency: "AUD", tickSize: 0.005 },
  spain: { assetCurrency: "EUR", tickSize: 0.005, taxPreset: "spain" },
  manual: {}
};

const taxPresets = {
  belgium: { taxBuyPct: 0.35, taxSellPct: 0.35 },
  spain: { taxBuyPct: 0.20, taxSellPct: 0.00 },
  none: { taxBuyPct: 0.00, taxSellPct: 0.00 },
  manual: {}
};

function n(id) {
  const el = $(id);
  if (!el) return 0;
  const value = parseFloat(String(el.value).replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

function rawValue(id) {
  const el = $(id);
  return el ? String(el.value).trim() : "";
}

function s(id) { const el = $(id); return el ? el.value : ""; }
function textValue(id) { const el = $(id); return el ? String(el.value || "").trim() : ""; }
function checked(id) { const el = $(id); return el ? Boolean(el.checked) : false; }
function pct(value) { return value / 100; }
function isShort() { return checked("positionShort"); }
function getStopMode() { return checked("stopModeLoss") ? "loss" : "price"; }

function getTargetMode() {
  const profitMode = $("targetModeProfit");
  return profitMode && profitMode.checked ? "profit" : "price";
}

function setTargetModeUi(activePrice) {
  const mode = getTargetMode();
  const sellInput = $("sellPrice");
  const targetProfitInput = $("targetProfit");
  const tickButtons = document.querySelectorAll('button[data-tick="sellPrice"]');

  if (sellInput) sellInput.readOnly = mode === "profit";
  if (targetProfitInput) targetProfitInput.readOnly = mode === "price";
  tickButtons.forEach(btn => { btn.disabled = mode === "profit"; });

  if (mode === "price" && Number.isFinite(activePrice)) {
    const result = calculateOperation(activePrice);
    const profit = convertAccountToResult(result.profitAccount);
    if (Number.isFinite(profit) && targetProfitInput) {
      targetProfitInput.value = profit.toFixed(2);
    }
  }
}

function setStopModeUi() {
  const automatic = getStopMode() === "loss";
  const stopInput = $("stopPrice");
  const lossInput = $("maxLoss");
  const tickButtons = document.querySelectorAll('button[data-tick="stopPrice"]');
  if (stopInput) stopInput.readOnly = automatic;
  if (lossInput) lossInput.readOnly = !automatic;
  tickButtons.forEach(btn => { btn.disabled = automatic; });
}

function targetProfitAccountValue() {
  return convertResultToAccount(n("targetProfit"));
}

function activeTargetPriceFromInputs() {
  const mode = getTargetMode();
  if (mode === "price") return n("sellPrice");
  const targetProfitAccount = targetProfitAccountValue();
  if (!Number.isFinite(targetProfitAccount)) return NaN;
  return findPriceForProfit(targetProfitAccount);
}

function applyPreset(values) {
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    if (!$(key)) continue;
    if ($(key).type === "checkbox") $(key).checked = Boolean(value);
    else $(key).value = value;
  }
}

function formatMoney(value, currency) {
  const symbol = currencySymbols[currency] || currency;
  const decimals = Math.abs(value) >= 1000 ? 2 : 4;
  return `${symbol} ${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: decimals })}`;
}

function formatPlainNumber(value, decimals = 2) {
  return value.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPct(value) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatPrice(value, currency) {
  const symbol = currencySymbols[currency] || currency;
  return `${symbol} ${value.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

function roundToTick(price, tick) {
  // Regla general: si un precio no encaja exactamente con el tick,
  // siempre se redondea hacia arriba para no quedarse corto.
  return ceilToTick(price, tick);
}

function ceilToTick(price, tick) {
  if (!tick || tick <= 0) return price;
  const decimals = Math.max(0, Math.ceil(-Math.log10(tick)) + 4);
  return Number((Math.ceil((price - 1e-12) / tick) * tick).toFixed(decimals));
}

function floorToTick(price, tick) {
  if (!tick || tick <= 0) return price;
  const decimals = Math.max(0, Math.ceil(-Math.log10(tick)) + 4);
  return Number((Math.floor((price + 1e-12) / tick) * tick).toFixed(decimals));
}

function convertAssetToAccount(amountAsset, side) {
  const asset = s("assetCurrency");
  const account = s("accountCurrency");
  if (asset === account) return amountAsset;
  const rate = side === "buy" ? n("fxBuyRate") : n("fxSellRate");
  if (rate <= 0) return NaN;
  return amountAsset / rate;
}

function convertAccountToAsset(amountAccount, side) {
  const asset = s("assetCurrency");
  const account = s("accountCurrency");
  if (asset === account) return amountAccount;
  const rate = side === "buy" ? n("fxBuyRate") : n("fxSellRate");
  if (rate <= 0) return NaN;
  return amountAccount * rate;
}

function convertAccountToResult(amountAccount) {
  const result = s("resultCurrency");
  const account = s("accountCurrency");
  const asset = s("assetCurrency");
  if (result === account) return amountAccount;
  if (result === asset) return convertAccountToAsset(amountAccount, "sell");

  // Si la divisa resultado no es ni la cuenta ni la acción, hace falta una tasa extra:
  // 1 divisa de cuenta = X divisa resultado. Ej.: cuenta EUR, acción AUD, resultado USD.
  const rate = n("fxResultRate");
  if (rate <= 0) return NaN;
  return amountAccount * rate;
}

function convertResultToAccount(amountResult) {
  const result = s("resultCurrency");
  const account = s("accountCurrency");
  const asset = s("assetCurrency");
  if (result === account) return amountResult;
  if (result === asset) return convertAssetToAccount(amountResult, "sell");

  const rate = n("fxResultRate");
  if (rate <= 0) return NaN;
  return amountResult / rate;
}

function brokerFee({ grossAsset, shares, side }) {
  const mode = s(side === "buy" ? "buyFeeMode" : "sellFeeMode");
  const value = n(side === "buy" ? "buyFeeValue" : "sellFeeValue");
  const min = n(side === "buy" ? "buyFeeMin" : "sellFeeMin");
  const maxRaw = rawValue(side === "buy" ? "buyFeeMax" : "sellFeeMax");
  const max = maxRaw === "" ? null : parseFloat(maxRaw.replace(",", "."));
  let fee;
  if (mode === "percent") fee = grossAsset * pct(value);
  else if (mode === "perShare") fee = shares * value;
  else fee = value;
  fee = Math.max(fee, min);
  if (max !== null && Number.isFinite(max) && max > 0) fee = Math.min(fee, max);
  return { asset: fee, account: convertAssetToAccount(fee, side) };
}

function calculateOperation(sellPrice) {
  const shares = n("shares");
  const buyPrice = n("buyPrice");
  const assetCurrency = s("assetCurrency");
  const accountCurrency = s("accountCurrency");

  const grossBuyAsset = shares * buyPrice;
  const grossSellAsset = shares * sellPrice;

  const short = isShort();
  // En corto, la entrada es una venta y la salida es una compra. Por eso se
  // invierten también el FX, la comisión y la tasa aplicables a cada pata.
  const grossBuyAccount = convertAssetToAccount(grossBuyAsset, short ? "sell" : "buy");
  const grossSellAccount = convertAssetToAccount(grossSellAsset, short ? "buy" : "sell");

  const buyFee = brokerFee({ grossAsset: grossBuyAsset, shares, side: short ? "sell" : "buy" });
  const sellFee = brokerFee({ grossAsset: grossSellAsset, shares, side: short ? "buy" : "sell" });

  const taxBuyAsset = grossBuyAsset * pct(n(short ? "taxSellPct" : "taxBuyPct"));
  const taxSellAsset = grossSellAsset * pct(n(short ? "taxBuyPct" : "taxSellPct"));
  const taxBuyAccount = convertAssetToAccount(taxBuyAsset, short ? "sell" : "buy");
  const taxSellAccount = convertAssetToAccount(taxSellAsset, short ? "buy" : "sell");

  // Modelo contable usado:
  // - Compra: conviertes a divisa de cuenta el total necesario para pagar acción + broker + tasa.
  // - Venta: primero se descuentan broker + tasa en la divisa de la acción y después conviertes el neto.
  // Así el coste FX se aplica sobre el dinero realmente cambiado, no solo sobre el bruto de la acción.
  const preFxBuyAccount = short ? grossBuyAccount - buyFee.account - taxBuyAccount : grossBuyAccount + buyFee.account + taxBuyAccount;
  const preFxSellAccount = short ? grossSellAccount + sellFee.account + taxSellAccount : grossSellAccount - sellFee.account - taxSellAccount;

  const fxBuyAccount = assetCurrency !== accountCurrency && checked(short ? "applyFxSell" : "applyFxBuy")
    ? Math.abs(preFxBuyAccount) * pct(n(short ? "fxSellPct" : "fxBuyPct")) : 0;
  const fxSellAccount = assetCurrency !== accountCurrency && checked(short ? "applyFxBuy" : "applyFxSell")
    ? Math.abs(preFxSellAccount) * pct(n(short ? "fxBuyPct" : "fxSellPct")) : 0;

  const totalBuyAccount = short ? preFxBuyAccount - fxBuyAccount : preFxBuyAccount + fxBuyAccount;
  const netSellAccount = short ? preFxSellAccount + fxSellAccount : preFxSellAccount - fxSellAccount;
  // Largo: compra de entrada y venta de salida.
  // Corto: venta de entrada al precio indicado como entrada y recompra al precio objetivo.
  // Los costes se mantienen en ambas patas y el beneficio bruto cambia de dirección.
  const costsAccount = buyFee.account + sellFee.account + taxBuyAccount + taxSellAccount + fxBuyAccount + fxSellAccount;
  const profitAccount = short
    ? totalBuyAccount - netSellAccount
    : netSellAccount - totalBuyAccount;
  const capitalBaseAccount = short ? grossBuyAccount : totalBuyAccount;
  const returnPct = capitalBaseAccount !== 0 ? profitAccount / capitalBaseAccount * 100 : 0;

  return {
    shares, buyPrice, sellPrice,
    grossBuyAsset, grossSellAsset, grossBuyAccount, grossSellAccount,
    buyFee, sellFee, taxBuyAccount, taxSellAccount,
    preFxBuyAccount, preFxSellAccount, fxBuyAccount, fxSellAccount,
    totalBuyAccount, netSellAccount, costsAccount, profitAccount, returnPct
  };
}

function findPriceForProfit(targetProfitAccount) {
  const tick = n("tickSize") || 0.0001;
  if (isShort()) {
    // En un corto el beneficio disminuye al subir el precio. Buscamos el precio
    // más alto (y, por tanto, más conservador) que todavía alcanza el objetivo.
    let low = 0;
    let high = Math.max(n("buyPrice") * 3, n("sellPrice") * 3, 1);
    while (calculateOperation(high).profitAccount > targetProfitAccount && high < 1000000) high *= 2;
    if (calculateOperation(low).profitAccount < targetProfitAccount) return NaN;
    for (let i = 0; i < 90; i++) {
      const mid = (low + high) / 2;
      if (calculateOperation(mid).profitAccount >= targetProfitAccount) low = mid;
      else high = mid;
    }
    let price = floorToTick(low, tick);
    let guard = 0;
    while (calculateOperation(price).profitAccount < targetProfitAccount && guard < 20) {
      price = Math.max(0, floorToTick(price - tick, tick));
      guard += 1;
    }
    return price;
  }
  let low = 0;
  let high = Math.max(n("buyPrice") * 3, n("sellPrice") * 3, 1);

  while (calculateOperation(high).profitAccount < targetProfitAccount && high < 1000000) {
    high *= 2;
  }

  for (let i = 0; i < 90; i++) {
    const mid = (low + high) / 2;
    if (calculateOperation(mid).profitAccount >= targetProfitAccount) high = mid;
    else low = mid;
  }

  // Importante: para un objetivo de beneficio NO se redondea al tick más cercano,
  // se redondea SIEMPRE hacia arriba. Si no, puede devolver 3,000 aunque el
  // beneficio objetivo exija 3,008 y el resultado se queda corto.
  let price = ceilToTick(high, tick);
  let guard = 0;
  while (calculateOperation(price).profitAccount < targetProfitAccount && guard < 20) {
    price = ceilToTick(price + tick, tick);
    guard += 1;
  }
  return price;
}

function updateLabels() {
  const account = s("accountCurrency");
  const asset = s("assetCurrency");
  const result = s("resultCurrency");
  $("fxBuyLabel").textContent = account === asset ? "Misma divisa: no hace falta FX" : `1 ${account} = ? ${asset}`;
  $("fxSellLabel").textContent = account === asset ? "Misma divisa: no hace falta FX" : `1 ${account} = ? ${asset}`;
  const resultLabel = $("fxResultLabel");
  if (resultLabel) {
    resultLabel.textContent = (result === account || result === asset)
      ? "No necesario para esta combinación"
      : `1 ${account} = ? ${result}`;
  }
}

function setText(id, text, className = "") {
  const el = $(id);
  el.textContent = text;
  el.className = className;
}

function setAutoChartRange() {
  const tick = n("tickSize") || 0.0001;
  const buy = n("buyPrice");
  const stop = n("stopPrice");
  const target = n("sellPrice");
  const current = n("currentPrice");
  const lowScenario = n("scenarioLow");
  const highScenario = n("scenarioHigh");
  const minPrice = Math.max(tick, Math.min(stop || buy, target || buy, current || buy, lowScenario || buy, buy * 0.75));
  const maxPrice = Math.max(stop || buy, target || buy, current || buy, highScenario || buy, buy * 1.25) * 1.08;
  $("chartMin").value = roundToTick(minPrice, tick).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  $("chartMax").value = roundToTick(maxPrice, tick).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

let chartRangeIsAuto = true;

function getChartRange() {
  let min = n("chartMin");
  let max = n("chartMax");
  if (min <= 0 || max <= 0 || max <= min) {
    setAutoChartRange();
    min = n("chartMin");
    max = n("chartMax");
  }
  return { min, max };
}

function drawChart(result, breakEven, targetPrice, stopForMaxLoss, currentPrice) {
  const canvas = $("profitChart");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = rect.width || 900;
  const height = rect.height || 350;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { min: minPrice, max: maxPrice } = getChartRange();
  const metric = s("chartMetric");
  const resultCurrency = s("resultCurrency");
  const assetCurrency = s("assetCurrency");
  const tick = n("tickSize") || 0.0001;

  // Nuevo gráfico: precio en eje Y, beneficio/pérdida o rentabilidad en eje X.
  // Es más visual para responder: "¿a qué precio gano/pierdo X?".
  const plot = { left: 92, right: 26, top: 18, bottom: 48 };
  const innerW = width - plot.left - plot.right;
  const innerH = height - plot.top - plot.bottom;

  const data = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const rawPrice = minPrice + (maxPrice - minPrice) * (i / steps);
    const price = ceilToTick(rawPrice, tick);
    const op = calculateOperation(price);
    const xValue = metric === "return" ? op.returnPct : convertAccountToResult(op.profitAccount);
    if (Number.isFinite(xValue) && Number.isFinite(price)) data.push({ price, x: xValue });
  }

  if (!data.length) {
    ctx.fillStyle = "#cbd6f3";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText("No hay datos suficientes para dibujar la gráfica.", 20, 40);
    return;
  }

  let minX = Math.min(...data.map(d => d.x), 0);
  let maxX = Math.max(...data.map(d => d.x), 0);
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  const xPad = (maxX - minX) * 0.12;
  minX -= xPad;
  maxX += xPad;

  const yPad = (maxPrice - minPrice) * 0.04;
  const yMin = Math.max(0, minPrice - yPad);
  const yMax = maxPrice + yPad;

  const xToPx = (x) => plot.left + ((x - minX) / (maxX - minX)) * innerW;
  const yToPx = (price) => plot.top + (1 - (price - yMin) / (yMax - yMin)) * innerH;

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.fillStyle = "rgba(219,229,255,0.74)";
  ctx.font = "12px Inter, sans-serif";

  // X grid: beneficio/pérdida o rentabilidad
  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const value = minX + (maxX - minX) * (i / xTicks);
    const px = xToPx(value);
    ctx.beginPath();
    ctx.moveTo(px, plot.top);
    ctx.lineTo(px, height - plot.bottom);
    ctx.stroke();
    const label = metric === "return" ? formatPct(value) : formatMoney(value, resultCurrency);
    const measured = ctx.measureText(label).width;
    ctx.fillText(label, Math.min(Math.max(px - measured / 2, plot.left), width - plot.right - measured), height - 16);
  }

  // Y grid: precio
  const yTicks = 6;
  for (let i = 0; i <= yTicks; i++) {
    const value = yMin + (yMax - yMin) * (i / yTicks);
    const py = yToPx(value);
    ctx.beginPath();
    ctx.moveTo(plot.left, py);
    ctx.lineTo(width - plot.right, py);
    ctx.stroke();
    ctx.fillText(formatPlainNumber(ceilToTick(value, tick), 3), 10, py + 4);
  }

  // Línea cero vertical: punto donde pasas de pérdida a beneficio.
  if (minX <= 0 && maxX >= 0) {
    const zeroX = xToPx(0);
    ctx.strokeStyle = "rgba(255, 209, 102, 0.85)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(zeroX, plot.top);
    ctx.lineTo(zeroX, height - plot.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Relleno hasta el eje cero.
  ctx.beginPath();
  data.forEach((point, index) => {
    const px = xToPx(point.x);
    const py = yToPx(point.price);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  const zeroBase = xToPx(Math.max(minX, Math.min(maxX, 0)));
  ctx.lineTo(zeroBase, yToPx(data[data.length - 1].price));
  ctx.lineTo(zeroBase, yToPx(data[0].price));
  ctx.closePath();
  const areaGradient = ctx.createLinearGradient(plot.left, 0, width - plot.right, 0);
  areaGradient.addColorStop(0, "rgba(217,122,93,0.12)");
  areaGradient.addColorStop(0.5, "rgba(214,167,95,0.10)");
  areaGradient.addColorStop(1, "rgba(168,189,116,0.16)");
  ctx.fillStyle = areaGradient;
  ctx.fill();

  // Línea principal.
  ctx.beginPath();
  data.forEach((point, index) => {
    const px = xToPx(point.x);
    const py = yToPx(point.price);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  const lineGradient = ctx.createLinearGradient(plot.left, plot.top, width - plot.right, plot.top);
  lineGradient.addColorStop(0, "#d97a5d");
  lineGradient.addColorStop(0.48, "#d6a75f");
  lineGradient.addColorStop(1, "#a8bd74");
  ctx.strokeStyle = lineGradient;
  ctx.lineWidth = 3;
  ctx.stroke();

  function drawMarker(price, color, label) {
    if (!Number.isFinite(price) || price < yMin || price > yMax) return;
    const op = calculateOperation(price);
    const xValue = metric === "return" ? op.returnPct : convertAccountToResult(op.profitAccount);
    if (!Number.isFinite(xValue)) return;
    const px = xToPx(xValue);
    const py = yToPx(price);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plot.left, py);
    ctx.lineTo(width - plot.right, py);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 4.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "12px Inter, sans-serif";
    const xLabel = metric === "return" ? formatPct(xValue) : formatMoney(xValue, resultCurrency);
    const text = `${label}: ${formatPlainNumber(price, 3)} / ${xLabel}`;
    const boxW = ctx.measureText(text).width + 12;
    const boxX = Math.min(Math.max(px - boxW / 2, plot.left), width - plot.right - boxW);
    const boxY = Math.min(Math.max(py - 32, plot.top + 6), height - plot.bottom - 28);
    ctx.fillStyle = "rgba(10, 15, 28, 0.9)";
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1;
    roundRect(ctx, boxX, boxY, boxW, 24, 8, true, true);
    ctx.fillStyle = "#eef3ff";
    ctx.fillText(text, boxX + 6, boxY + 16);
  }

  drawMarker(n("stopPrice"), "#d97a5d", "Stop");
  drawMarker(currentPrice, "#c9a15b", "Actual");
  drawMarker(breakEven, "#e1b866", "BEP");
  drawMarker(targetPrice, "#a8bd74", "Objetivo");
  drawMarker(stopForMaxLoss, "#8ea36a", "Pérd. máx.");

  $("chartMeta").innerHTML = [
    {
      label: metric === "return" ? "Rentabilidad mínima" : "Pérdida máxima visible",
      value: metric === "return" ? formatPct(Math.min(...data.map(d => d.x))) : formatMoney(Math.min(...data.map(d => d.x)), resultCurrency)
    },
    {
      label: metric === "return" ? "Rentabilidad máxima" : "Beneficio máximo visible",
      value: metric === "return" ? formatPct(Math.max(...data.map(d => d.x))) : formatMoney(Math.max(...data.map(d => d.x)), resultCurrency)
    },
    { label: "Precio actual", value: Number.isFinite(currentPrice) ? formatPrice(currentPrice, assetCurrency) : "—" },
    { label: "Precio break-even", value: formatPrice(breakEven, assetCurrency) },
    { label: "Precio objetivo", value: Number.isFinite(targetPrice) ? formatPrice(targetPrice, assetCurrency) : "—" }
  ].map(item => `
    <div class="chart-meta-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `).join("");
}


function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function buildSummaryText(result, breakEven, targetPrice, stop, stopForMaxLoss) {
  const resultCurrency = s("resultCurrency");
  const accountCurrency = s("accountCurrency");
  const assetCurrency = s("assetCurrency");
  const profit = convertAccountToResult(result.profitAccount);
  const currentPrice = n("currentPrice");
  const currentOp = Number.isFinite(currentPrice) && currentPrice > 0 ? calculateOperation(currentPrice) : null;
  const currentProfit = currentOp ? convertAccountToResult(currentOp.profitAccount) : NaN;
  const currentToTarget = currentPrice > 0 && Number.isFinite(targetPrice) ? ((targetPrice / currentPrice) - 1) * 100 : NaN;
  const stopProfit = convertAccountToResult(stop.profitAccount);
  const totalCosts = result.costsAccount;
  const rr = Math.abs(stop.profitAccount) > 0 ? result.profitAccount / Math.abs(stop.profitAccount) : 0;

  const name = textValue("instrumentName") || "Instrumento sin nombre";
  const ticker = textValue("instrumentTicker") || "—";
  const exchange = textValue("instrumentExchange") || "—";
  const notes = textValue("operationNotes");
  const now = new Date();
  const date = now.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

  const lines = [
    `OPERACIÓN DE INVERSIÓN — ${name}`,
    `Fecha cálculo: ${date}`,
    `Ticker / símbolo: ${ticker}`,
    `Bolsa / mercado: ${exchange}`,
    `Broker: ${s("broker").toUpperCase()} | Mercado preset: ${s("market")}`,
    `Divisas: cuenta ${accountCurrency} | acción ${assetCurrency} | resultado ${resultCurrency}`,
    "",
    "POSICIÓN",
    `Acciones: ${n("shares").toLocaleString("es-ES")}`,
    `Tipo de posición: ${isShort() ? "CORTO" : "LARGO"}`,
    `Precio de entrada: ${formatPrice(n("buyPrice"), assetCurrency)}`,
    `Importe neto de entrada: ${formatMoney(convertAccountToResult(result.totalBuyAccount), resultCurrency)}`,
    "",
    "OBJETIVO / SALIDA",
    `Precio objetivo de salida: ${Number.isFinite(targetPrice) ? formatPrice(targetPrice, assetCurrency) : "—"}`,
    `Movimiento desde la entrada: ${Number.isFinite(targetPrice) && n("buyPrice") > 0 ? formatPct((targetPrice / n("buyPrice") - 1) * 100) : "—"}`,
    `Venta neta estimada: ${formatMoney(convertAccountToResult(result.netSellAccount), resultCurrency)}`,
    `Beneficio neto estimado: ${formatMoney(profit, resultCurrency)} (${formatPct(result.returnPct)})`,
    `Break-even real: ${Number.isFinite(breakEven) ? formatPrice(breakEven, assetCurrency) : "—"}`,
    `Precio actual: ${Number.isFinite(currentPrice) && currentPrice > 0 ? formatPrice(currentPrice, assetCurrency) : "—"}`,
    `Resultado si vendes al precio actual: ${Number.isFinite(currentProfit) ? formatMoney(currentProfit, resultCurrency) : "—"}${currentOp ? ` (${formatPct(currentOp.returnPct)})` : ""}`,
    `Distancia desde precio actual al objetivo: ${Number.isFinite(currentToTarget) ? formatPct(currentToTarget) : "—"}`,
    `Precio para ganar ${formatMoney(n("targetProfit"), resultCurrency)} netos: ${Number.isFinite(targetPrice) ? formatPrice(targetPrice, assetCurrency) : "—"}`,
    "",
    "RIESGO",
    `Stop actual: ${formatPrice(n("stopPrice"), assetCurrency)}`,
    `Resultado al stop: ${formatMoney(stopProfit, resultCurrency)}`,
    `Máxima pérdida aceptada: ${formatMoney(n("maxLoss"), resultCurrency)}`,
    `Stop para pérdida máxima: ${Number.isFinite(stopForMaxLoss) ? formatPrice(stopForMaxLoss, assetCurrency) : "—"}`,
    `Ratio beneficio/riesgo: ${Number.isFinite(rr) ? rr.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}x`,
    "",
    "COSTES Y FX",
    `Costes totales ida y vuelta: ${formatMoney(totalCosts, accountCurrency)}`,
    `Comisión broker entrada: ${formatMoney(result.buyFee.account, accountCurrency)} | salida: ${formatMoney(result.sellFee.account, accountCurrency)}`,
    `TOB/Tobin entrada: ${formatMoney(result.taxBuyAccount, accountCurrency)} | salida: ${formatMoney(result.taxSellAccount, accountCurrency)}`,
    `FX entrada: ${formatMoney(result.fxBuyAccount, accountCurrency)} | FX salida: ${formatMoney(result.fxSellAccount, accountCurrency)}`,
    `Tipo FX compra: 1 ${accountCurrency} = ${n("fxBuyRate")} ${assetCurrency} | venta: 1 ${accountCurrency} = ${n("fxSellRate")} ${assetCurrency}`
  ];

  if (notes) {
    lines.push("", "NOTAS", notes);
  }

  return lines.join("\n");
}

function copySummary(text) {
  const buttons = [$("copySummaryBtn"), $("copyOperationBtn")].filter(Boolean);
  const setButtonText = (label) => buttons.forEach(btn => { btn.textContent = label; });

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      setButtonText("Operación copiada");
      setTimeout(() => {
        if ($("copySummaryBtn")) $("copySummaryBtn").textContent = "Copiar operación";
        if ($("copyOperationBtn")) $("copyOperationBtn").textContent = "Copiar operación";
      }, 1600);
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const area = $("operationText");
  if (!area) return;
  area.focus();
  area.select();
  document.execCommand("copy");
}

function renderCore() {
  updateLabels();
  const accountCurrency = s("accountCurrency");
  const assetCurrency = s("assetCurrency");
  const resultCurrency = s("resultCurrency");
  const targetMode = getTargetMode();
  let activeSellPrice = activeTargetPriceFromInputs();
  const requestedTargetWasImpossible = !Number.isFinite(activeSellPrice);
  if (requestedTargetWasImpossible) activeSellPrice = n("sellPrice");
  const tick = n("tickSize") || 0.0001;
  activeSellPrice = Math.max(0, isShort() ? floorToTick(activeSellPrice, tick) : roundToTick(activeSellPrice, tick));
  if (targetMode === "profit" && $("sellPrice")) {
    $("sellPrice").value = activeSellPrice.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }
  const result = calculateOperation(activeSellPrice);
  const warnings = [];

  if (!Number.isFinite(result.totalBuyAccount) || !Number.isFinite(result.netSellAccount)) warnings.push("Revisa los tipos de cambio: hay una conversión imposible o un FX en cero.");
  if (accountCurrency !== assetCurrency && (!n("fxBuyRate") || !n("fxSellRate"))) warnings.push("La divisa de cuenta y la de la acción son distintas: necesitas FX compra y venta.");
  if (s("resultCurrency") !== accountCurrency && s("resultCurrency") !== assetCurrency && !n("fxResultRate")) warnings.push("La divisa resultado es una tercera divisa: introduce FX resultado para convertir correctamente.");
  if (requestedTargetWasImpossible && targetMode === "profit") warnings.push("Ese beneficio objetivo no es alcanzable con estos datos, especialmente en un corto cuyo beneficio máximo está limitado por el precio cero.");

  const resultTotalBuy = convertAccountToResult(result.totalBuyAccount);
  const resultNetSell = convertAccountToResult(result.netSellAccount);
  const resultProfit = convertAccountToResult(result.profitAccount);

  setText("totalBuy", Number.isFinite(resultTotalBuy) ? formatMoney(resultTotalBuy, resultCurrency) : "—");
  setText("netSell", Number.isFinite(resultNetSell) ? formatMoney(resultNetSell, resultCurrency) : "—");
  setText("netProfit", Number.isFinite(resultProfit) ? formatMoney(resultProfit, resultCurrency) : "—", result.profitAccount >= 0 ? "positive" : "negative");
  setText("netReturn", formatPct(result.returnPct), result.returnPct >= 0 ? "positive" : "negative");

  const rows = [
    ["Bruto", result.grossBuyAccount, result.grossSellAccount, isShort() ? result.grossBuyAccount - result.grossSellAccount : result.grossSellAccount - result.grossBuyAccount],
    ["Comisión broker", result.buyFee.account, result.sellFee.account, result.buyFee.account + result.sellFee.account],
    ["TOB / Tobin", result.taxBuyAccount, result.taxSellAccount, result.taxBuyAccount + result.taxSellAccount],
    ["Comisión cambio FX", result.fxBuyAccount, result.fxSellAccount, result.fxBuyAccount + result.fxSellAccount],
    ["Total costes", result.buyFee.account + result.taxBuyAccount + result.fxBuyAccount, result.sellFee.account + result.taxSellAccount + result.fxSellAccount, result.costsAccount]
  ];
  $("breakdownBody").innerHTML = rows.map(([name, buy, sell, total]) => `
    <tr>
      <td>${name}</td>
      <td>${formatMoney(buy, accountCurrency)}</td>
      <td>${formatMoney(sell, accountCurrency)}</td>
      <td>${formatMoney(total, accountCurrency)}</td>
    </tr>
  `).join("");

  const breakEven = findPriceForProfit(0);
  const targetProfitAccount = targetProfitAccountValue();
  const maxLossAccount = convertResultToAccount(n("maxLoss"));
  const targetPrice = activeSellPrice;
  const stopForMaxLoss = Number.isFinite(maxLossAccount) ? findPriceForProfit(-maxLossAccount) : NaN;
  let activeStopPrice = n("stopPrice");
  if (getStopMode() === "loss" && Number.isFinite(stopForMaxLoss)) {
    activeStopPrice = stopForMaxLoss;
    $("stopPrice").value = activeStopPrice.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }
  const stop = calculateOperation(activeStopPrice);
  const stopOnWrongSide = n("buyPrice") > 0 && (isShort() ? activeStopPrice <= n("buyPrice") : activeStopPrice >= n("buyPrice"));
  if (stopOnWrongSide) warnings.push(isShort() ? "En una posición corta, el stop de pérdida debe estar por encima del precio de entrada." : "En una posición larga, el stop de pérdida debe estar por debajo del precio de entrada.");
  const risk = Math.max(0, -stop.profitAccount);
  const reward = Math.max(0, result.profitAccount);
  const rr = risk > 0 ? reward / risk : 0;

  const warnBox = $("warningBox");
  warnBox.textContent = warnings.join(" ");
  warnBox.classList.toggle("hidden", warnings.length === 0);

  const targetGrowth = n("buyPrice") > 0 && Number.isFinite(targetPrice) ? ((targetPrice / n("buyPrice")) - 1) * 100 : NaN;
  const currentPrice = n("currentPrice");
  const currentOp = currentPrice > 0 ? calculateOperation(currentPrice) : null;
  const currentProfit = currentOp ? convertAccountToResult(currentOp.profitAccount) : NaN;
  const currentToTarget = currentPrice > 0 && Number.isFinite(targetPrice) ? ((targetPrice / currentPrice) - 1) * 100 : NaN;
  const currentToBep = currentPrice > 0 && Number.isFinite(breakEven) ? ((breakEven / currentPrice) - 1) * 100 : NaN;
  setText("breakEvenPrice", formatPrice(breakEven, assetCurrency));
  setText("priceForTarget", Number.isFinite(targetPrice) ? formatPrice(targetPrice, assetCurrency) : "—");
  setText("activeTargetPrice", Number.isFinite(targetPrice) ? formatPrice(targetPrice, assetCurrency) : "—");
  const targetDirectionGood = isShort() ? targetGrowth <= 0 : targetGrowth >= 0;
  setText("targetGrowthPct", Number.isFinite(targetGrowth) ? formatPct(targetGrowth) : "—", targetDirectionGood ? "positive" : "negative");
  setText("currentProfit", Number.isFinite(currentProfit) ? formatMoney(currentProfit, resultCurrency) : "—", currentProfit >= 0 ? "positive" : "negative");
  setText("currentReturn", currentOp ? formatPct(currentOp.returnPct) : "—", currentOp && currentOp.returnPct >= 0 ? "positive" : "negative");
  setText("currentToTarget", Number.isFinite(currentToTarget) ? formatPct(currentToTarget) : "—", (isShort() ? currentToTarget <= 0 : currentToTarget >= 0) ? "positive" : "negative");
  setText("currentToBep", Number.isFinite(currentToBep) ? formatPct(currentToBep) : "—", (isShort() ? currentToBep >= 0 : currentToBep <= 0) ? "positive" : "negative");
  setText("stopLossResult", formatMoney(convertAccountToResult(stop.profitAccount), resultCurrency), stop.profitAccount >= 0 ? "positive" : "negative");
  setText("riskReward", `${rr.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`, rr >= 2 ? "positive" : rr > 0 ? "" : "negative");
  setText("stopForMaxLoss", Number.isFinite(stopForMaxLoss) ? formatPrice(stopForMaxLoss, assetCurrency) : "—");

  const scenarios = [
    ["Bajo", n("scenarioLow")],
    ["Medio", n("scenarioMid")],
    ["Alto", n("scenarioHigh")],
    ["Objetivo calculado", activeSellPrice]
  ];
  $("scenarioBody").innerHTML = scenarios.map(([name, price]) => {
    const op = calculateOperation(price);
    const profit = convertAccountToResult(op.profitAccount);
    return `
      <tr>
        <td>${name}</td>
        <td>${formatPrice(price, assetCurrency)}</td>
        <td class="${op.profitAccount >= 0 ? "positive" : "negative"}">${formatMoney(profit, resultCurrency)}</td>
        <td class="${op.returnPct >= 0 ? "positive" : "negative"}">${formatPct(op.returnPct)}</td>
      </tr>`;
  }).join("");

  const totalCosts = result.costsAccount;
  const costsVsProfit = result.profitAccount !== 0 ? Math.abs(totalCosts / result.profitAccount * 100) : 0;
  const moveNeeded = (breakEven / n("buyPrice") - 1) * 100;
  let judgement = "";
  if (rr >= 3) judgement = "Muy buena relación beneficio/riesgo si el stop es realista.";
  else if (rr >= 2) judgement = "Relación beneficio/riesgo razonable.";
  else if (rr >= 1) judgement = "La operación puede salir, pero el premio no es enorme frente al riesgo.";
  else judgement = "Ojo: estás arriesgando más de lo que aspiras a ganar.";

  $("commentary").innerHTML = `
    <p><strong>${judgement}</strong></p>
    <p>Posición <strong>${isShort() ? "corta" : "larga"}</strong>. Objetivo activo: <strong>${formatPrice(targetPrice, assetCurrency)}</strong>. Movimiento necesario desde la entrada: <strong>${Number.isFinite(targetGrowth) ? formatPct(targetGrowth) : "—"}</strong>.</p>
    <p>Precio actual: <strong>${currentPrice > 0 ? formatPrice(currentPrice, assetCurrency) : "—"}</strong>. Si cierras ahora, el resultado neto estimado sería <strong>${Number.isFinite(currentProfit) ? formatMoney(currentProfit, resultCurrency) : "—"}</strong>. Desde el precio actual hasta el objetivo falta <strong>${Number.isFinite(currentToTarget) ? formatPct(currentToTarget) : "—"}</strong>.</p>
    <p>El break-even real exige un movimiento de <strong>${formatPct(moveNeeded)}</strong> desde tu entrada.</p>
    <p>Costes totales estimados de ida y vuelta: <strong>${formatMoney(totalCosts, accountCurrency)}</strong>. Eso equivale al <strong>${formatPct(costsVsProfit)}</strong> del beneficio neto objetivo actual.</p>
    <p>En el objetivo actual, el importe neto de entrada sería <strong>${formatMoney(resultTotalBuy, resultCurrency)}</strong> y el importe neto de salida <strong>${formatMoney(resultNetSell, resultCurrency)}</strong>.</p>
  `;

  setTargetModeUi(activeSellPrice);
  setStopModeUi();
  if (chartRangeIsAuto) setAutoChartRange();
  try {
    drawChart(result, breakEven, targetPrice, stopForMaxLoss, currentPrice);
  } catch (chartError) {
    console.error("Error dibujando la gráfica", chartError);
    const chartMeta = $("chartMeta");
    if (chartMeta) chartMeta.innerHTML = `<div class="chart-meta-card"><span>Gráfica</span><strong>No disponible</strong></div>`;
  }
  const summaryText = buildSummaryText(result, breakEven, targetPrice, stop, stopForMaxLoss);
  if ($("operationText")) $("operationText").value = summaryText;
  if ($("copySummaryBtn")) $("copySummaryBtn").onclick = () => copySummary(summaryText);
  if ($("copyOperationBtn")) $("copyOperationBtn").onclick = () => copySummary(summaryText);
}


function render() {
  try {
    renderCore();
  } catch (error) {
    console.error("Error en calculadora", error);
    const warnBox = $("warningBox");
    if (warnBox) {
      warnBox.textContent = "Error interno de cálculo. Revisa que todos los campos numéricos tengan valores válidos.";
      warnBox.classList.remove("hidden");
    }
  }
}


function applyTargetNetPrice() {
  if ($("targetModeProfit")) $("targetModeProfit").checked = true;
  if ($("targetModePrice")) $("targetModePrice").checked = false;
  setAutoChartRange();
  render();
}

function resetDefaults() {
  location.reload();
}

function init() {
  fields.forEach(id => {
    const el = $(id);
    if (!el) return;
    const update = () => {
      if (id === "chartMin" || id === "chartMax") chartRangeIsAuto = false;
      render();
    };
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  $("broker").addEventListener("change", () => {
    applyPreset(brokerPresets[s("broker")]);
    render();
  });

  $("market").addEventListener("change", () => {
    applyPreset(marketPresets[s("market")]);
    if (marketPresets[s("market")].taxPreset) {
      $("taxPreset").value = marketPresets[s("market")].taxPreset;
      applyPreset(taxPresets[s("taxPreset")]);
    }
    render();
  });

  $("taxPreset").addEventListener("change", () => {
    applyPreset(taxPresets[s("taxPreset")]);
    render();
  });

  document.querySelectorAll("button[data-tick]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tick;
      const dir = parseInt(btn.dataset.dir, 10);
      const tick = n("tickSize") || 0.0001;
      $(target).value = Math.max(0, roundToTick(n(target) + dir * tick, tick)).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
      render();
    });
  });

  $("autoChartRangeBtn").addEventListener("click", () => {
    chartRangeIsAuto = true;
    setAutoChartRange();
    render();
  });

  if ($("applyTargetPriceBtn")) $("applyTargetPriceBtn").addEventListener("click", applyTargetNetPrice);

  $("resetBtn").addEventListener("click", resetDefaults);
  window.addEventListener("resize", render);

  applyPreset(brokerPresets[s("broker")]);
  applyPreset(marketPresets[s("market")]);
  applyPreset(taxPresets[s("taxPreset")]);
  setAutoChartRange();
  render();
}

init();
