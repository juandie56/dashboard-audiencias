/**
 * main.js — Punto de entrada. Orquesta la carga de datos y el renderizado.
 *
 * Para conectar con datos en tiempo real, reemplaza las importaciones
 * estáticas por llamadas async a tu API antes de llamar a los render.
 */

import { KPIs, rangeData, cityData } from './data.js';
import { renderKPIs, renderBars, renderDonut, renderTable, renderCities, animateBars } from './charts.js';

function init() {
  renderKPIs(KPIs);
  renderBars(rangeData);
  renderDonut(rangeData);
  renderTable(rangeData, KPIs.clasificadas);
  renderCities(cityData, KPIs.totalAudiencias);
}

init();
window.addEventListener('load', () => setTimeout(animateBars, 200));
