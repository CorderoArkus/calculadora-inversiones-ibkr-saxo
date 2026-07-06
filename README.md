# Calculadora de inversión IBKR / Saxo

Calculadora web estática para operaciones con acciones en **EUR, USD o AUD**, pensada principalmente para Interactive Brokers, con comparación/configuración para Saxo Trader.

## Ejecutar

```bash
cd investment-calculator
python3 -m http.server 5173
```

Abrir `http://localhost:5173`.

## Tests

```bash
npm test
```

No necesita instalar dependencias. Usa `node:assert` y módulos ES.

## Arquitectura

- `src/currency.js`: conversión EUR/USD/AUD.
- `src/brokerFees.js`: defaults de broker, comisiones y coste de FX.
- `src/taxes.js`: TOB, ITF española e impuesto personalizado.
- `src/tickSize.js`: redondeo obligatorio hacia arriba al tick.
- `src/calculations.js`: motor puro de cálculo, break-even, objetivos y P/L actual al precio de mercado.
- `src/chart.js`: gráfico canvas con **Y = precio** y **X = P/L neto**.
- `src/validation.js`: validaciones.
- `src/app.js`: lectura de UI y renderizado.

## Fórmulas usadas

### Compra

```text
Importe bruto compra = nº acciones × precio compra
Comisión compra = max(comisión fija + comisión porcentual + comisión por acción × acciones, comisión mínima)
Impuesto compra = importe bruto compra × tasa impuesto compra
Coste FX compra = coste sobre el importe convertido si divisa cuenta ≠ divisa operación y FX activado
Coste total entrada = bruto compra + comisión compra + impuesto compra + coste FX compra
```

### Venta

```text
Importe bruto venta = nº acciones × precio venta
Comisión venta = max(comisión fija + comisión porcentual + comisión por acción × acciones, comisión mínima)
Impuesto venta = importe bruto venta × tasa impuesto venta
Coste FX venta = coste sobre el importe neto convertido si divisa cuenta ≠ divisa operación y FX activado
Importe neto salida = bruto venta − comisión venta − impuesto venta − coste FX venta
```

### Resultado

```text
Beneficio/Pérdida bruto = bruto venta − bruto compra
Beneficio/Pérdida neto = importe neto salida − coste total entrada
Rentabilidad neta % = beneficio neto / coste total entrada × 100
% necesario desde precio actual = ((precio objetivo ajustado − precio actual) / precio actual) × 100
P/L actual neto = importe neto de salida al precio actual − coste total de entrada
Rentabilidad neta actual % = P/L actual neto / coste total entrada × 100
```

## Cambio de divisa

El coste de cambio solo se aplica si:

1. está activado el checkbox de FX, y
2. la divisa base de la cuenta es distinta de la divisa de operación.

Defaults editables:

- Interactive Brokers:
  - FX automático: 0,03%.
  - FX manual/spot: 0,002% con mínimo equivalente a 2 USD.
- Saxo Trader:
  - FX: 0,25%.

El resultado principal permanece siempre en la divisa de la operación. El resultado adicional convierte importes a EUR/USD/AUD y puede aplicar un coste visual de conversión si se marca la opción correspondiente.

## Impuestos

- TOB belga: por defecto 0,35% compra y 0,35% venta para acciones. Editable.
- IBKR: TOB belga desactivada por defecto. Solo se activa si el usuario marca “calcular TOB belga manualmente”.
- Saxo + residencia fiscal BE: TOB activada por defecto, editable.
- ITF española: 0,20% solo en compra y solo si el usuario marca “Acción española sujeta a ITF”.
- Impuesto personalizado: tasas separadas para compra y venta.

## Tick size

Para objetivos, break-even y precios calculados se usa:

```js
roundUpToTick(price, tickSize)
```

La función aplica techo/ceiling al tick válido inmediatamente superior o igual. Nunca redondea hacia abajo un precio objetivo.

Ejemplos:

```text
3,1267 con tick 0,005 → 3,130
1,3721 con tick 0,01  → 1,38
```

## Modos de cálculo

- **Modo A:** introduces precio de venta objetivo.
- **Modo B:** introduces beneficio neto objetivo; el motor busca el precio mínimo que alcanza ese beneficio neto y lo redondea hacia arriba al tick.
- **Modo C:** introduces rentabilidad objetivo; el motor traduce esa rentabilidad a beneficio neto objetivo y busca el precio mínimo ajustado al tick.

En todos los modos, el bloque superior del gráfico muestra el precio actual de mercado y el **P/L actual si vendes ahora**, incluyendo comisiones de venta, impuestos de venta y coste FX de salida si están activados.

## Supuestos configurables

Todo lo siguiente es editable por el usuario:

- Divisa operación, cuenta y resultado adicional.
- Tipos EUR/USD, EUR/AUD y USD/AUD.
- Comisión fija, porcentual, por acción y mínima.
- Divisa de comisión.
- Coste FX automático/manual y mínimo FX.
- TOB, ITF e impuesto personalizado.
- Tick size.
- Rango y elementos visibles del gráfico.
