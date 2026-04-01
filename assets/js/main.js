/**
 * main.js — Navegación, filtros y orquestación del dashboard.
 */

import {
  getActiveAccount, login, logout,
  loadDashboardData, applyFilters,
  computeResumen, computeConciliacion, computeMontos,
  computeAbogados, computeCiudades, computeProcesos,
  VALID_ABOGADOS,
} from './data.js';
import {
  renderResumen, renderConciliacion, renderMontos,
  renderAbogados, renderCiudades, renderProcesos,
} from './charts.js';

// ── Estado ────────────────────────────────────────────────────────────────────
let allRows    = [];
let activeSection = 's-resumen';
const filters  = { desde: null, hasta: null, ciudades: [], abogado: '' };

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loginOverlay  = document.getElementById('login-overlay');
const loadingOvl    = document.getElementById('loading-overlay');
const appEl         = document.getElementById('app');
const navItems      = document.querySelectorAll('.sidebar-nav-item');
const topbarTitle   = document.getElementById('topbar-title');
const lastUpdateEl  = document.getElementById('last-update');
const statusDot     = document.getElementById('status-dot');
const statusTxt     = document.getElementById('status-txt');
const btnRefresh      = document.getElementById('btn-refresh');
const btnClearFilters = document.getElementById('btn-clear-filters');
const btnLogout       = document.getElementById('btn-logout');
const fDesde        = document.getElementById('f-desde');
const fHasta        = document.getElementById('f-hasta');
const fAbogado      = document.getElementById('f-abogado');
const msCiudadBtn   = document.getElementById('ms-ciudad-btn');
const msCiudadPanel = document.getElementById('ms-ciudad-panel');

const SECTION_TITLES = {
  's-resumen':      'Resumen',
  's-conciliacion': 'Conciliación',
  's-montos':       'Montos',
  's-abogados':     'Abogados',
  's-ciudades':     'Ciudades',
  's-procesos':     'Procesos activos',
};

// ── Helpers UI ────────────────────────────────────────────────────────────────
const setStatus = (state) => {
  const map = { ok: ['#3ecf8e', 'En vivo'], loading: ['#c8a96e', 'Cargando'], error: ['#e05c5c', 'Error'] };
  const [color, txt] = map[state] ?? map.ok;
  statusDot.style.background = color;
  statusTxt.textContent = txt;
};
const setLoading = on => {
  loadingOvl.hidden = !on;
  btnRefresh.disabled = on;
  setStatus(on ? 'loading' : 'ok');
};
const setLastUpdate = () => {
  lastUpdateEl.textContent = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

// ── Navegación ────────────────────────────────────────────────────────────────
function navigate(sectionId) {
  activeSection = sectionId;
  document.querySelectorAll('.dash-section').forEach(s => s.hidden = (s.id !== sectionId));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.section === sectionId));
  topbarTitle.textContent = SECTION_TITLES[sectionId] ?? '';
  renderActiveSection();
}

// ── Render sección activa ─────────────────────────────────────────────────────
function renderActiveSection() {
  const rows = applyFilters(allRows, filters);
  document.querySelectorAll('.chart-box').forEach(el => { el.innerHTML = ''; });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    switch (activeSection) {
      case 's-resumen':      return renderResumen(computeResumen(rows));
      case 's-conciliacion': return renderConciliacion(computeConciliacion(rows));
      case 's-montos':       return renderMontos(computeMontos(rows));
      case 's-abogados':     return renderAbogados(computeAbogados(rows));
      case 's-ciudades':     return renderCiudades(computeCiudades(rows));
      case 's-procesos': {
        // KPIs y ciudad usan filas filtradas; scheduledByMonth usa allRows (sin filtro)
        const filtered   = computeProcesos(rows);
        const unfiltered = computeProcesos(allRows);
        filtered.scheduledByMonth = unfiltered.scheduledByMonth;
        return renderProcesos(filtered);
      }
    }
  }));
}

// ── Multi-select ciudad ───────────────────────────────────────────────────────
function buildCityOptions(cities) {
  msCiudadPanel.innerHTML = '';
  const allLbl = document.createElement('label');
  allLbl.innerHTML = `<input type="checkbox" value="__all" checked> Todas`;
  msCiudadPanel.appendChild(allLbl);

  cities.forEach(city => {
    const lbl = document.createElement('label');
    lbl.innerHTML = `<input type="checkbox" value="${city}" checked> ${city}`;
    msCiudadPanel.appendChild(lbl);
  });
  syncCityFilter();
}

function syncCityFilter() {
  const allCb  = msCiudadPanel.querySelector('input[value="__all"]');
  const cityCbs = [...msCiudadPanel.querySelectorAll('input:not([value="__all"])')];
  const selected = cityCbs.filter(cb => cb.checked).map(cb => cb.value);
  const allChecked = selected.length === cityCbs.length;
  if (allCb) allCb.checked = allChecked;
  filters.ciudades = allChecked ? [] : selected;
  msCiudadBtn.textContent = allChecked ? 'Todas ▾' : `${selected.length} sel. ▾`;
}

msCiudadBtn.addEventListener('click', e => {
  e.stopPropagation();
  msCiudadPanel.hidden = !msCiudadPanel.hidden;
});

msCiudadPanel.addEventListener('change', e => {
  const cb = e.target;
  if (cb.value === '__all') {
    msCiudadPanel.querySelectorAll('input').forEach(c => { c.checked = cb.checked; });
  }
  syncCityFilter();
  renderActiveSection();
});

document.addEventListener('click', e => {
  if (!msCiudadBtn.contains(e.target) && !msCiudadPanel.contains(e.target)) {
    msCiudadPanel.hidden = true;
  }
});

// ── Filtros de fecha y abogado ────────────────────────────────────────────────
fDesde.addEventListener('change', () => {
  filters.desde = fDesde.value ? new Date(fDesde.value) : null;
  renderActiveSection();
});
fHasta.addEventListener('change', () => {
  filters.hasta = fHasta.value ? new Date(fHasta.value + 'T23:59:59') : null;
  renderActiveSection();
});
fAbogado.addEventListener('change', () => {
  filters.abogado = fAbogado.value;
  renderActiveSection();
});

// ── Populate abogado dropdown ─────────────────────────────────────────────────
function buildAbogadoOptions() {
  VALID_ABOGADOS.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name.split(' ')[0] + ' ' + (name.split(' ')[1] ?? '');
    fAbogado.appendChild(opt);
  });
}

// ── Inicialización ────────────────────────────────────────────────────────────
async function loadData() {
  setLoading(true);
  try {
    const { rows, allCities } = await loadDashboardData();
    allRows = rows;
    buildCityOptions(allCities);
    setLastUpdate();
    renderActiveSection();
  } catch (err) {
    console.error(err);
    setStatus('error');
    alert('Error al cargar datos: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function init() {
  buildAbogadoOptions();

  if (!getActiveAccount()) {
    loginOverlay.hidden = false;
    appEl.hidden = true;
    return;
  }
  loginOverlay.hidden = true;
  appEl.hidden = false;
  await loadData();
}

// ── Eventos ───────────────────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  try {
    await login();
    loginOverlay.hidden = true;
    appEl.hidden = false;
    await loadData();
  } catch (err) {
    console.error('Login fallido:', err);
  }
});

btnLogout.addEventListener('click', () => {
  logout();
  loginOverlay.hidden = false;
  appEl.hidden = true;
  allRows = [];
});

btnRefresh.addEventListener('click', loadData);

btnClearFilters.addEventListener('click', () => {
  filters.desde = null; filters.hasta = null;
  filters.ciudades = []; filters.abogado = '';
  fDesde.value = ''; fHasta.value = '';
  fAbogado.value = '';
  msCiudadPanel.querySelectorAll('input').forEach(cb => { cb.checked = true; });
  syncCityFilter();
  renderActiveSection();
});

navItems.forEach(n => n.addEventListener('click', () => navigate(n.dataset.section)));

// Resize: re-renderizar gráficas al cambiar tamaño
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderActiveSection, 200);
});

init();
