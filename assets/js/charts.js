/**
 * charts.js — Renderizado SVG por sección. Sin dependencias externas.
 */

import { fmtCOP, fmtPct, fmtMonth } from './data.js';

// ── Helpers SVG ───────────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const svgTxt = (content, attrs = {}) => {
  const t = svgEl('text', { 'font-family': "'DM Sans', sans-serif", 'font-size': '11', fill: '#7a7f94', ...attrs });
  t.textContent = content;
  return t;
};
function initSVG(container) {
  container.innerHTML = '';
  const W = Math.max(container.clientWidth  || container.offsetWidth  || 400, 200);
  const H = Math.max(container.clientHeight || container.offsetHeight || 240, 100);
  const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'overflow:visible' });
  container.appendChild(svg);
  return { svg, W, H };
}

const YEAR_COLORS = { 2022: '#5b8dee', 2023: '#3ecf8e', 2024: '#c8a96e', 2025: '#a855f7', 2026: '#e05c5c' };
const CITY_COLORS = ['#5b8dee', '#3ecf8e', '#c8a96e', '#a855f7', '#e08c5c'];
const BAR_COLORS  = ['#5b8dee', '#3ecf8e', '#c8a96e', '#e08c5c', '#e05c5c', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];
const threshColor = r => r >= 98 ? '#3ecf8e' : r >= 95 ? '#e08c5c' : '#e05c5c';
const yearColor   = y => YEAR_COLORS[y] ?? '#7a7f94';

function gridLines(svg, M, plotW, plotH, ticks = 4) {
  for (let i = 0; i <= ticks; i++) {
    const y = M.top + (i / ticks) * plotH;
    svg.appendChild(svgEl('line', {
      x1: M.left, y1: y, x2: M.left + plotW, y2: y,
      stroke: 'rgba(255,255,255,0.04)', 'stroke-width': 1,
    }));
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tip = document.getElementById('chart-tooltip');

function showTip(evt, html) {
  if (!tip) return;
  tip.innerHTML = html;
  tip.hidden = false;
  moveTip(evt);
}
function moveTip(evt) {
  if (!tip || tip.hidden) return;
  const x = evt.clientX + 14;
  const y = evt.clientY - 10;
  tip.style.left = `${Math.min(x, window.innerWidth  - tip.offsetWidth  - 16)}px`;
  tip.style.top  = `${Math.max(8, y - tip.offsetHeight)}px`;
}
function hideTip() { if (tip) tip.hidden = true; }

function tipBar(el, html) {
  el.addEventListener('mouseenter', e => showTip(e, html));
  el.addEventListener('mousemove',  moveTip);
  el.addEventListener('mouseleave', hideTip);
}

// ── Barras verticales (mensuales) ─────────────────────────────────────────────
export function renderVBars(container, items, colorFn) {
  if (!items?.length) return;
  const { svg, W, H } = initSVG(container);
  const M = { top: 12, right: 12, bottom: 42, left: 36 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const maxVal = Math.max(...items.map(d => d.value ?? d.count), 1);
  const n   = items.length;
  const gap = Math.max(1, plotW * 0.04 / n);
  const bw  = (plotW - gap * (n + 1)) / n;

  gridLines(svg, M, plotW, plotH);

  items.forEach((d, i) => {
    const val   = d.value ?? d.count;
    const bh    = (val / maxVal) * plotH;
    const x     = M.left + gap + i * (bw + gap);
    const y     = M.top + plotH - bh;
    const color = colorFn ? colorFn(d) : BAR_COLORS[i % BAR_COLORS.length];

    const rect = svgEl('rect', { x, y, width: Math.max(bw, 1), height: Math.max(bh, 1), fill: color, rx: 2 });
    const label = d.label ? fmtMonth(d.label) : String(i);
    tipBar(rect, `<strong>${label}</strong><br>${val.toLocaleString('es-CO')} audiencias`);
    svg.appendChild(rect);

    const labelEvery = Math.max(1, Math.ceil(n / (plotW / 38)));
    if (i % labelEvery === 0) {
      const t = svgTxt(label, { x: x + bw / 2, y: M.top + plotH + 14, 'text-anchor': 'middle', 'font-size': 9 });
      t.setAttribute('transform', `rotate(-35, ${x + bw / 2}, ${M.top + plotH + 14})`);
      svg.appendChild(t);
    }
  });

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = Math.round((maxVal / yTicks) * i);
    const y = M.top + plotH - (v / maxVal) * plotH;
    svg.appendChild(svgTxt(v, { x: M.left - 4, y: y + 4, 'text-anchor': 'end', 'font-size': 9 }));
  }
}

// ── Línea + área con eje Y dinámico (Resumen y Conciliación) ──────────────────
export function renderLineArea(container, items, refLine = 95) {
  if (!items?.length) return;
  const { svg, W, H } = initSVG(container);
  const M = { top: 24, right: 36, bottom: 42, left: 44 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = items.length;

  // Eje Y dinámico con ~10% de padding
  const vals   = items.map(p => p.rate);
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  const pad     = Math.max((dataMax - dataMin) * 0.12, 3);
  const yMin    = Math.max(0,   dataMin - pad);
  const yMax    = Math.min(100, dataMax + pad);
  const yRange  = yMax - yMin || 1;

  const xS = i  => M.left + (n > 1 ? (i / (n - 1)) : 0.5) * plotW;
  const yS = v  => M.top + plotH - ((v - yMin) / yRange) * plotH;

  gridLines(svg, M, plotW, plotH);

  // Línea de referencia (solo si refLine cae en el rango visible)
  if (refLine >= yMin && refLine <= yMax) {
    const refY = yS(refLine);
    svg.appendChild(svgEl('line', {
      x1: M.left, y1: refY, x2: M.left + plotW, y2: refY,
      stroke: '#7a7f94', 'stroke-width': 1.5, 'stroke-dasharray': '5,4',
    }));
    svg.appendChild(svgTxt(`${refLine}%`, { x: M.left + plotW + 4, y: refY + 4, 'font-size': 9 }));
  }

  // Área
  const areaD = items.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xS(i)} ${yS(p.rate)}`).join(' ')
    + ` L ${xS(n - 1)} ${M.top + plotH} L ${xS(0)} ${M.top + plotH} Z`;
  svg.appendChild(svgEl('path', { d: areaD, fill: 'rgba(91,141,238,0.1)', stroke: 'none' }));

  // Línea
  const lineD = items.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xS(i)} ${yS(p.rate)}`).join(' ');
  svg.appendChild(svgEl('path', { d: lineD, fill: 'none', stroke: '#5b8dee', 'stroke-width': 2, 'stroke-linejoin': 'round' }));

  // Puntos con tooltip
  items.forEach((p, i) => {
    // Hit area invisible más grande
    const hit = svgEl('circle', { cx: xS(i), cy: yS(p.rate), r: 10, fill: 'transparent' });
    tipBar(hit, `<strong>${fmtMonth(p.label)}</strong><br>Tasa: ${p.rate.toFixed(1)}%`);
    svg.appendChild(hit);

    svg.appendChild(svgEl('circle', {
      cx: xS(i), cy: yS(p.rate), r: 3.5,
      fill: threshColor(p.rate), stroke: '#0d0f14', 'stroke-width': 1.5,
      style: 'pointer-events:none',
    }));
  });

  // Eje X
  const labelEvery = Math.max(1, Math.ceil(n / (plotW / 38)));
  items.forEach((p, i) => {
    if (i % labelEvery !== 0) return;
    const t = svgTxt(fmtMonth(p.label), { x: xS(i), y: M.top + plotH + 14, 'text-anchor': 'middle', 'font-size': 9 });
    t.setAttribute('transform', `rotate(-35, ${xS(i)}, ${M.top + plotH + 14})`);
    svg.appendChild(t);
  });

  // Eje Y dinámico
  const yTickValues = [yMin, yMin + yRange * 0.25, yMin + yRange * 0.5, yMin + yRange * 0.75, yMax];
  yTickValues.forEach(v => {
    svg.appendChild(svgTxt(`${v.toFixed(0)}%`, { x: M.left - 4, y: yS(v) + 4, 'text-anchor': 'end', 'font-size': 9 }));
  });
}

// ── Barras horizontales ───────────────────────────────────────────────────────
export function renderHBars(container, items, colorFn) {
  if (!items?.length) return;
  const { svg, W, H } = initSVG(container);
  const maxLabel = Math.max(...items.map(d => (d.label ?? d.rango ?? '').length));
  const M  = { top: 4, right: 56, bottom: 4, left: Math.max(80, maxLabel * 6.5) };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n   = items.length;
  const bh  = Math.min(22, (plotH / n) - 4);
  const rowH = plotH / n;
  const maxVal = Math.max(...items.map(d => d.value ?? d.count), 1);

  items.forEach((d, i) => {
    const val   = d.value ?? d.count;
    const y     = M.top + i * rowH + (rowH - bh) / 2;
    const bw    = Math.max((val / maxVal) * plotW, val > 0 ? 2 : 0);
    const color = colorFn ? colorFn(d) : d.color ?? BAR_COLORS[i % BAR_COLORS.length];
    const lbl   = d.label ?? d.rango ?? '';

    svg.appendChild(svgEl('rect', { x: M.left, y, width: plotW, height: bh, fill: 'rgba(255,255,255,0.04)', rx: 3 }));

    if (bw > 0) {
      const rect = svgEl('rect', { x: M.left, y, width: bw, height: bh, fill: color, rx: 3 });
      const tipContent = d.pct !== undefined
        ? `<strong>${lbl}</strong><br>${val.toLocaleString('es-CO')} · ${d.pct}%`
        : `<strong>${lbl}</strong><br>${val.toLocaleString('es-CO')}`;
      tipBar(rect, tipContent);
      svg.appendChild(rect);
    }

    svg.appendChild(svgTxt(lbl, { x: M.left - 6, y: y + bh / 2 + 4, 'text-anchor': 'end', fill: '#e8e9ee', 'font-size': 11 }));
    svg.appendChild(svgTxt(val.toLocaleString('es-CO'), { x: M.left + bw + 6, y: y + bh / 2 + 4, 'font-size': 10 }));
    if (d.pct !== undefined) {
      svg.appendChild(svgTxt(`${d.pct}%`, { x: M.left + plotW + 4, y: y + bh / 2 + 4, 'font-size': 10 }));
    }
  });
}

// ── Barras horizontales apiladas (Ciudades) ───────────────────────────────────
export function renderStackedHBars(container, items) {
  if (!items?.length) return;
  const { svg, W, H } = initSVG(container);
  const maxLabel = Math.max(...items.map(d => d.city.length));
  const M  = { top: 4, right: 80, bottom: 24, left: Math.max(80, maxLabel * 6.5) };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = items.length;
  const bh  = Math.min(20, (plotH / n) - 4);
  const rowH = plotH / n;
  const maxVal = Math.max(...items.map(d => d.total), 1);

  [['#5b8dee', 'Activos'], ['#3ecf8e', 'Cerrados']].forEach(([c, lbl], i) => {
    const x = M.left + plotW + 8;
    const y = M.top + i * 18;
    svg.appendChild(svgEl('rect', { x, y, width: 8, height: 8, fill: c, rx: 2 }));
    svg.appendChild(svgTxt(lbl, { x: x + 12, y: y + 8, 'font-size': 9 }));
  });

  items.forEach((d, i) => {
    const y    = M.top + i * rowH + (rowH - bh) / 2;
    const wAct = (d.activos  / maxVal) * plotW;
    const wCer = (d.cerrados / maxVal) * plotW;

    svg.appendChild(svgEl('rect', { x: M.left, y, width: plotW, height: bh, fill: 'rgba(255,255,255,0.04)', rx: 3 }));

    if (wAct > 0) {
      const r = svgEl('rect', { x: M.left, y, width: wAct, height: bh, fill: '#5b8dee', rx: 3 });
      tipBar(r, `<strong>${d.city}</strong><br>Activos: ${d.activos.toLocaleString('es-CO')}`);
      svg.appendChild(r);
    }
    if (wCer > 0) {
      const r = svgEl('rect', { x: M.left + wAct, y, width: wCer, height: bh, fill: '#3ecf8e', rx: 0 });
      tipBar(r, `<strong>${d.city}</strong><br>Cerrados: ${d.cerrados.toLocaleString('es-CO')}`);
      svg.appendChild(r);
    }

    svg.appendChild(svgTxt(d.city, { x: M.left - 6, y: y + bh / 2 + 4, 'text-anchor': 'end', fill: '#e8e9ee', 'font-size': 11 }));
    svg.appendChild(svgTxt(d.total.toLocaleString('es-CO'), { x: M.left + wAct + wCer + 6, y: y + bh / 2 + 4, 'font-size': 10 }));
  });
}

// ── Multilínea por ciudad — eje Y dinámico ────────────────────────────────────
export function renderMultiLines(container, { months, cities, series }) {
  if (!months?.length || !cities?.length) return;
  const { svg, W, H } = initSVG(container);
  const M = { top: 28, right: 20, bottom: 42, left: 32 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const n = months.length;

  // Eje Y dinámico
  const allVals = series.flat().filter(v => v > 0);
  const dataMin = allVals.length ? Math.min(...allVals) : 0;
  const dataMax = allVals.length ? Math.max(...allVals) : 1;
  const pad     = Math.max((dataMax - dataMin) * 0.12, 1);
  const yMin    = Math.max(0, dataMin - pad);
  const yMax    = dataMax + pad;
  const yRange  = yMax - yMin || 1;

  const xS = i => M.left + (n > 1 ? (i / (n - 1)) : 0.5) * plotW;
  const yS = v => M.top + plotH - ((v - yMin) / yRange) * plotH;

  gridLines(svg, M, plotW, plotH);

  series.forEach((pts, ci) => {
    const color = CITY_COLORS[ci % CITY_COLORS.length];
    const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xS(i)} ${yS(v)}`).join(' ');
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    // Leyenda
    svg.appendChild(svgEl('rect', { x: M.left + ci * (plotW / cities.length), y: 4, width: 10, height: 6, fill: color, rx: 2 }));
    svg.appendChild(svgTxt(cities[ci].split(' ')[0], { x: M.left + ci * (plotW / cities.length) + 14, y: 12, 'font-size': 9 }));

    // Puntos con tooltip
    pts.forEach((v, i) => {
      if (v === 0) return;
      const hit = svgEl('circle', { cx: xS(i), cy: yS(v), r: 10, fill: 'transparent' });
      tipBar(hit, `<strong>${cities[ci]}</strong><br>${fmtMonth(months[i])}: ${v.toLocaleString('es-CO')}`);
      svg.appendChild(hit);
      svg.appendChild(svgEl('circle', { cx: xS(i), cy: yS(v), r: 3, fill: color, stroke: '#0d0f14', 'stroke-width': 1.5, style: 'pointer-events:none' }));
    });
  });

  // Eje X
  const labelEvery = Math.max(1, Math.ceil(n / (plotW / 38)));
  months.forEach((m, i) => {
    if (i % labelEvery !== 0) return;
    const t = svgTxt(fmtMonth(m), { x: xS(i), y: M.top + plotH + 14, 'text-anchor': 'middle', 'font-size': 9 });
    t.setAttribute('transform', `rotate(-35, ${xS(i)}, ${M.top + plotH + 14})`);
    svg.appendChild(t);
  });

  // Eje Y dinámico
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (yRange / 4) * i;
    svg.appendChild(svgTxt(Math.round(v), { x: M.left - 4, y: yS(v) + 4, 'text-anchor': 'end', 'font-size': 9 }));
  }
}

// ── Tabla de abogados ─────────────────────────────────────────────────────────
export function renderAbogadoTable(container, tableData) {
  container.innerHTML = '';
  if (!tableData?.length) { container.innerHTML = '<p style="color:#7a7f94;padding:16px">Sin datos</p>'; return; }
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr><th>Abogado</th><th class="num">Audiencias</th><th class="num">Tasa</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  tableData.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.name}</td><td class="num serif">${d.total}</td><td class="num muted">${d.tasa}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// ── KPIs genéricos ────────────────────────────────────────────────────────────
export function renderKPICards(sectionId, kpiDefs) {
  kpiDefs.forEach(({ id, value }) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

// ── Render por sección ────────────────────────────────────────────────────────
export function renderResumen({ KPIs, monthlyBars, monthlyRate }) {
  renderKPICards('s-resumen', [
    { id: 'kpi-r-total', value: KPIs.total.toLocaleString('es-CO') },
    { id: 'kpi-r-tasa',  value: fmtPct(KPIs.tasa) },
    { id: 'kpi-r-conc',  value: fmtCOP(KPIs.totalConc) },
    { id: 'kpi-r-sin',   value: KPIs.sinMonto.toLocaleString('es-CO') },
  ]);
  renderVBars(document.getElementById('c-r-bars'),
    monthlyBars.map(d => ({ label: d.label, value: d.count, year: d.year })),
    d => yearColor(d.year),
  );
  renderLineArea(document.getElementById('c-r-line'), monthlyRate);
}

export function renderConciliacion({ KPIs, monthlyRate }) {
  renderKPICards('s-conciliacion', [
    { id: 'kpi-c-celebradas',  value: KPIs.celebradas.toLocaleString('es-CO') },
    { id: 'kpi-c-conciliadas', value: KPIs.conciliadas.toLocaleString('es-CO') },
    { id: 'kpi-c-noconc',      value: KPIs.noConc.toLocaleString('es-CO') },
    { id: 'kpi-c-racha',       value: `${KPIs.racha} mes${KPIs.racha !== 1 ? 'es' : ''}` },
  ]);
  // Idéntica a Resumen: LineArea con colores de umbral y ref 95%
  renderLineArea(document.getElementById('c-con-bars'), monthlyRate);
}

export function renderMontos({ KPIs, rangeData, classified }) {
  const total = classified || 1;
  renderKPICards('s-montos', [
    { id: 'kpi-m-total', value: fmtCOP(KPIs.total) },
    { id: 'kpi-m-prom',  value: fmtCOP(KPIs.promedio) },
    { id: 'kpi-m-max',   value: fmtCOP(KPIs.maximo) },
  ]);
  renderHBars(
    document.getElementById('c-mon-bars'),
    rangeData.map((d, i) => ({
      label: d.rango, value: d.count,
      pct: (d.count / total * 100).toFixed(1),
      color: BAR_COLORS[i % BAR_COLORS.length],
    })),
  );
}

export function renderAbogados({ KPIs, barData, tableData }) {
  const sinEl = document.getElementById('kpi-ab-sin');
  if (sinEl) sinEl.innerHTML = `${KPIs.sinAsignar.toLocaleString('es-CO')}${KPIs.sinAsignar > 0 ? ' <span class="alert-badge">⚠</span>' : ''}`;
  renderKPICards('s-abogados', [
    { id: 'kpi-ab-total', value: KPIs.totalAbogados.toLocaleString('es-CO') },
    { id: 'kpi-ab-mayor', value: KPIs.mayorVolumen },
    { id: 'kpi-ab-prom',  value: KPIs.promedio.toFixed(1) },
  ]);
  renderHBars(document.getElementById('c-ab-bars'), barData, d => d.color ?? '#5b8dee');
  renderAbogadoTable(document.getElementById('c-ab-table'), tableData);
}

export function renderCiudades({ KPIs, stackedBars, monthlyLines }) {
  renderKPICards('s-ciudades', [
    { id: 'kpi-ciu-total',   value: KPIs.totalCiudades.toLocaleString('es-CO') },
    { id: 'kpi-ciu-primera', value: KPIs.primera },
    { id: 'kpi-ciu-segunda', value: KPIs.segunda },
    { id: 'kpi-ciu-tercera', value: KPIs.tercera },
  ]);
  renderStackedHBars(document.getElementById('c-ciu-stacked'), stackedBars.slice(0, 12));
  renderMultiLines(document.getElementById('c-ciu-lines'), monthlyLines);
}

export function renderProcesos({ KPIs, activeByCity, scheduledByMonth }) {
  renderKPICards('s-procesos', [
    { id: 'kpi-p-activos',  value: KPIs.activos.toLocaleString('es-CO') },
    { id: 'kpi-p-cerrados', value: KPIs.cerrados.toLocaleString('es-CO') },
    { id: 'kpi-p-prog',     value: KPIs.programadas.toLocaleString('es-CO') },
    { id: 'kpi-p-sinprog',  value: KPIs.sinProgramar.toLocaleString('es-CO') },
  ]);
  renderHBars(document.getElementById('c-pro-city'), activeByCity);
  renderVBars(document.getElementById('c-pro-months'),
    scheduledByMonth.map(d => ({ label: d.label, value: d.count })),
    () => '#5b8dee',
  );
}
