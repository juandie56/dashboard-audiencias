/**
 * main.js — Punto de entrada. Orquesta autenticación, carga de datos y renderizado.
 */

import { getActiveAccount, login, logout, loadDashboardData } from './data.js';
import { renderKPIs, renderBars, renderDonut, renderTable, renderCities, animateBars } from './charts.js';

// ── Referencias DOM ───────────────────────────────────────────────────────────
const loginOverlay  = document.getElementById('login-overlay');
const dashboard     = document.getElementById('dashboard');
const loginBtn      = document.getElementById('btn-login');
const logoutBtn     = document.getElementById('btn-logout');
const refreshBtn    = document.getElementById('btn-refresh');
const lastUpdateEl  = document.getElementById('last-update');
const loadingEl     = document.getElementById('loading-overlay');

// ── UI helpers ────────────────────────────────────────────────────────────────
const showDashboard = () => { loginOverlay.hidden = true;  dashboard.hidden = false; };
const showLogin     = () => { loginOverlay.hidden = false; dashboard.hidden = true;  };
const setLoading    = on  => { loadingEl.hidden = !on; refreshBtn.disabled = on; };

function setLastUpdate() {
  lastUpdateEl.textContent = new Date().toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
function render({ KPIs, rangeData, cityData }) {
  // Limpiar contenedores dinámicos antes de re-renderizar
  ['bars', 'donutSvg', 'donutLegend', 'tableBody', 'cityList'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });

  renderKPIs(KPIs);
  renderBars(rangeData);
  renderDonut(rangeData);
  renderTable(rangeData, KPIs.clasificadas);
  renderCities(cityData, KPIs.totalAudiencias);
  setTimeout(animateBars, 200);
  setLastUpdate();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  if (!getActiveAccount()) {
    showLogin();
    return;
  }
  showDashboard();
  setLoading(true);
  try {
    render(await loadDashboardData());
  } catch (err) {
    console.error(err);
    alert('Error al cargar los datos: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ── Eventos ───────────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  try {
    await login();
    await init();
  } catch (err) {
    console.error('Login cancelado o fallido:', err);
  }
});

logoutBtn.addEventListener('click', () => {
  logout();
  showLogin();
});

refreshBtn.addEventListener('click', async () => {
  setLoading(true);
  try {
    render(await loadDashboardData());
  } catch (err) {
    console.error(err);
    alert('Error al actualizar: ' + err.message);
  } finally {
    setLoading(false);
  }
});

init();
