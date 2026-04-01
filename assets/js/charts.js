/**
 * charts.js — Funciones de renderizado para cada sección del dashboard.
 * Cada función recibe los datos y el elemento DOM destino.
 */

import { DONUT_COLORS } from './data.js';

// ── KPIs ─────────────────────────────────────────────────────────────────────
export function renderKPIs({ totalAudiencias, conMonto, clasificadas, sinMonto }) {
  document.getElementById('kpi-total').textContent       = totalAudiencias.toLocaleString('es-CO');
  document.getElementById('kpi-conMonto').textContent    = conMonto.toLocaleString('es-CO');
  document.getElementById('kpi-clasificadas').textContent = clasificadas.toLocaleString('es-CO');
  document.getElementById('kpi-sinMonto').textContent    = sinMonto.toLocaleString('es-CO');
}

// ── Barras horizontales ───────────────────────────────────────────────────────
export function renderBars(rangeData) {
  const container = document.getElementById('bars');
  const maxCount  = Math.max(...rangeData.map(d => d.count));

  rangeData.forEach(d => {
    const pct = maxCount > 0 ? (d.count / maxCount * 100).toFixed(1) : 0;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <div class="bar-label">${d.rango}</div>
      <div class="bar-track">
        <div class="bar-fill ${d.cls}" data-pct="${pct}" style="width:0%">
          ${d.count > 10 ? d.count : ''}
        </div>
      </div>
      <div class="bar-count">${d.count}</div>
    `;
    container.appendChild(row);
  });
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────
export function renderDonut(rangeData) {
  const svg    = document.getElementById('donutSvg');
  const legend = document.getElementById('donutLegend');
  const cx = 100, cy = 100, r = 75, sw = 26;
  const total  = rangeData.reduce((acc, d) => acc + d.count, 0);
  let startAngle = -Math.PI / 2;

  rangeData.forEach((d, i) => {
    const angle    = (d.count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', DONUT_COLORS[i % DONUT_COLORS.length]);
    path.setAttribute('stroke-width', sw);
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);
    startAngle = endAngle;

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-dot" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></div>
      <span>${d.rango}</span>
      <span>${d.count} (${(d.count / total * 100).toFixed(1)}%)</span>
    `;
    legend.appendChild(item);
  });

  // Etiqueta central
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', cx);
  label.setAttribute('y', cy - 8);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('fill', '#e8e9ee');
  label.setAttribute('font-family', 'DM Serif Display, serif');
  label.setAttribute('font-size', '28');
  label.textContent = total.toLocaleString('es-CO');
  svg.appendChild(label);

  const sublabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  sublabel.setAttribute('x', cx);
  sublabel.setAttribute('y', cy + 14);
  sublabel.setAttribute('text-anchor', 'middle');
  sublabel.setAttribute('fill', '#7a7f94');
  sublabel.setAttribute('font-size', '11');
  sublabel.setAttribute('font-family', 'DM Sans, sans-serif');
  sublabel.textContent = 'audiencias';
  svg.appendChild(sublabel);
}

// ── Tabla de detalle ──────────────────────────────────────────────────────────
export function renderTable(rangeData, totalClasificadas) {
  const tbody = document.getElementById('tableBody');
  rangeData.forEach(d => {
    const pct = totalClasificadas > 0
      ? (d.count / totalClasificadas * 100).toFixed(1)
      : '0.0';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.rango}</td>
      <td class="muted small">${d.ganancias}</td>
      <td class="num serif">${d.count}</td>
      <td class="num muted">${pct}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Barras de ciudades ────────────────────────────────────────────────────────
export function renderCities(cityData, totalAudiencias) {
  const container = document.getElementById('cityList');
  const maxCity   = Math.max(...cityData.map(d => d.count));

  cityData.forEach(d => {
    const pctTotal = (d.count / totalAudiencias * 100).toFixed(1);
    const barPct   = (d.count / maxCity * 100).toFixed(1);
    const div = document.createElement('div');
    div.className = 'city-row';
    div.innerHTML = `
      <div class="city-header">
        <span class="city-name">${d.city}</span>
        <span class="city-pct">${d.count} · ${pctTotal}%</span>
      </div>
      <div class="city-track">
        <div class="city-fill" data-pct="${barPct}" style="width:0%"></div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ── Animación de entrada ──────────────────────────────────────────────────────
export function animateBars() {
  document.querySelectorAll('.bar-fill, .city-fill').forEach(el => {
    el.style.width = el.dataset.pct + '%';
  });
}
