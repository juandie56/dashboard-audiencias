/**
 * data.js — MSAL + Microsoft Graph API + normalización + cómputo por sección.
 */

// ── Configuración MSAL ────────────────────────────────────────────────────────
const MSAL_CONFIG = {
  auth: {
    clientId:    '6151a3a1-2193-41cb-acbc-483082e2b85c',
    authority:   'https://login.microsoftonline.com/dc60f95d-5f6e-4d2c-a86b-320a2b60144e',
    redirectUri: 'https://juandie56.github.io/dashboard-audiencias',
  },
  cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
};
const SCOPES = ['User.Read', 'Files.Read.All'];
const SHAREPOINT_FILE_URL =
  'https://quinteropalacio-my.sharepoint.com/:x:/g/personal/squintero_qpalliance_co/IQDtJdfGY0zFSJM4MXWHlD2VAVyrIpIwyYC-eQ_x4euQ0Y8';

export const msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);
await msalInstance.initialize();
await msalInstance.handleRedirectPromise().catch(() => {});

export const getActiveAccount = () => msalInstance.getAllAccounts()[0] ?? null;

export async function login() {
  await msalInstance.loginPopup({ scopes: SCOPES });
  return getActiveAccount();
}
export function logout() {
  const a = getActiveAccount();
  if (a) msalInstance.logoutPopup({ account: a });
}
async function getToken() {
  const account = getActiveAccount();
  if (!account) throw new Error('Sin sesión activa.');
  try {
    return (await msalInstance.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
  } catch {
    return (await msalInstance.acquireTokenPopup({ scopes: SCOPES })).accessToken;
  }
}
function sharingUrlToId(url) {
  return 'u!' + btoa(url).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function graphGet(path, token) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Constantes ────────────────────────────────────────────────────────────────
export const VALID_ABOGADOS = [
  'Valentina Guio', 'Jose Rojas', 'Laura Castellanos', 'Alejandra Garzón',
  'Óscar García', 'Esteban Perea', 'Lorena Chaparro Quintero', 'Angie Rizo',
];

export const RANGE_DEFS = [
  { rango: '0 – 4M',    ganancias: '0 – 10M',    min: 0,          max: 4_000_000,  cls: 'r0'  },
  { rango: '4M – 6M',   ganancias: '10M – 20M',  min: 4_000_000,  max: 6_000_000,  cls: 'r1'  },
  { rango: '6M – 7M',   ganancias: '20M – 30M',  min: 6_000_000,  max: 7_000_000,  cls: 'r2'  },
  { rango: '7M – 8M',   ganancias: '30M – 50M',  min: 7_000_000,  max: 8_000_000,  cls: 'r3'  },
  { rango: '9M – 10M',  ganancias: '50M – 60M',  min: 9_000_000,  max: 10_000_000, cls: 'r4'  },
  { rango: '10M – 12M', ganancias: '60M – 80M',  min: 10_000_000, max: 12_000_000, cls: 'r5'  },
  { rango: '12M – 15M', ganancias: '80M – 90M',  min: 12_000_000, max: 15_000_000, cls: 'r6'  },
  { rango: '15M – 19M', ganancias: '90M – 100M', min: 15_000_000, max: 20_000_000, cls: 'r6b' },
  { rango: '+20M',      ganancias: '+ 100M',      min: 20_000_000, max: Infinity,   cls: 'r6c' },
];

export const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ── Normalización ─────────────────────────────────────────────────────────────
const COL = {
  CIUDAD: 4, FECHA_AUDIENCIA: 6, MONTO: 8,
  ABOGADO: 16, CELEBRADA: 22, CONCILIADA: 23, PROCESO_ACTIVO: 25,
};

function stripAccents(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeBool(val) {
  const s = stripAccents(String(val ?? '').trim()).toUpperCase();
  if (['SI', 'S', 'YES', 'Y', '1', 'TRUE'].includes(s)) return true;
  if (['NO', 'N', '0', 'FALSE'].includes(s)) return false;
  return null;
}

function normalizeCity(val) {
  const s = String(val ?? '').trim();
  const map = {
    'Medellin': 'Medellín', 'MEDELLIN': 'Medellín', 'MEDELLÍN': 'Medellín',
    'Bogota': 'Bogotá', 'BOGOTA': 'Bogotá', 'BOGOTÁ': 'Bogotá',
  };
  return map[s] ?? s;
}

function normalizeAbogado(val) {
  const s = stripAccents(String(val ?? '').trim()).toLowerCase();
  for (const name of VALID_ABOGADOS) {
    if (stripAccents(name).toLowerCase() === s) return name;
  }
  return 'Sin asignar';
}

function parseAmount(val) {
  if (typeof val === 'number') return val;
  const c = String(val ?? '').replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(c) || 0;
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number' && val > 1000) {
    // Excel serial (days since 1899-12-30)
    const d = new Date(Math.round((val - 25569) * 86400000));
    return isNaN(d) ? null : d;
  }
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

function isoMonth(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ── Carga y normalización de filas ────────────────────────────────────────────
export async function loadDashboardData() {
  const token = await getToken();

  // 1. Obtener driveItem via sharing link
  const shareId = sharingUrlToId(SHAREPOINT_FILE_URL);
  const item    = await graphGet(`/shares/${shareId}/driveItem`, token);

  // 2. Descargar el archivo usando la URL de descarga directa
  const downloadUrl = item['@microsoft.graph.downloadUrl'];
  const response    = await fetch(downloadUrl);
  const buffer      = await response.arrayBuffer();

  // 3. Parsear con SheetJS (cargado como global en index.html)
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet    = workbook.Sheets['Audiencias'];
  const rawRows  = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // 4. Normalizar filas (misma lógica que antes)
  const rows = rawRows.slice(1)
    .filter(r => r[COL.CIUDAD] !== null && r[COL.CIUDAD] !== '' && r[COL.CIUDAD] !== undefined)
    .map(r => ({
      ciudad:         normalizeCity(r[COL.CIUDAD]),
      fechaAudiencia: parseDate(r[COL.FECHA_AUDIENCIA]),
      monto:          parseAmount(r[COL.MONTO]),
      abogado:        normalizeAbogado(r[COL.ABOGADO]),
      celebrada:      normalizeBool(r[COL.CELEBRADA]),
      conciliada:     normalizeBool(r[COL.CONCILIADA]),
      procesoActivo:  normalizeBool(r[COL.PROCESO_ACTIVO]),
    }));

  const allCities = [...new Set(rows.map(r => r.ciudad).filter(Boolean))].sort();
  return { rows, allCities };
}

// ── Filtros ───────────────────────────────────────────────────────────────────
export function applyFilters(rows, { desde, hasta, ciudades, abogado }) {
  return rows.filter(r => {
    if (desde && r.fechaAudiencia && r.fechaAudiencia < desde) return false;
    if (hasta && r.fechaAudiencia && r.fechaAudiencia > hasta)  return false;
    if (ciudades?.length && !ciudades.includes(r.ciudad))        return false;
    if (abogado && r.abogado !== abogado)                        return false;
    return true;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildMonthMap(rows) {
  const m = {};
  for (const r of rows) {
    const k = isoMonth(r.fechaAudiencia);
    if (!k) continue;
    if (!m[k]) m[k] = { total: 0, celebradas: 0, conciliadas: 0, year: r.fechaAudiencia.getFullYear() };
    m[k].total++;
    if (r.celebrada  === true) m[k].celebradas++;
    if (r.conciliada === true) m[k].conciliadas++;
  }
  return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
}

function mejorRacha(monthEntries) {
  let max = 0, cur = 0;
  for (const [, v] of monthEntries) {
    if (v.celebradas > 0 && v.conciliadas === v.celebradas) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

export const fmtCOP = n => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
};
export const fmtPct = n => `${n.toFixed(1)}%`;
export const fmtMonth = k => {
  const [y, mo] = k.split('-');
  return `${MONTHS_ES[parseInt(mo) - 1]} ${y.slice(2)}`;
};

// ── Sección 1: Resumen ────────────────────────────────────────────────────────
export function computeResumen(rows) {
  const celebradas  = rows.filter(r => r.celebrada  === true).length;
  const conciliadas = rows.filter(r => r.conciliada === true).length;
  const totalConc   = rows.reduce((s, r) => s + (r.conciliada ? r.monto : 0), 0);
  const sinMonto    = rows.filter(r => r.monto === 0).length;
  const tasa        = celebradas > 0 ? (conciliadas / celebradas * 100) : 0;

  const todayMonth   = isoMonth(new Date());
  const monthEntries = buildMonthMap(rows);
  const monthlyBars  = monthEntries.map(([k, v]) => ({ label: k, count: v.total, year: v.year }));
  // Solo meses ya ocurridos (≤ mes actual)
  const monthlyRate  = monthEntries
    .filter(([k]) => k <= todayMonth)
    .map(([k, v]) => ({
      label: k,
      rate: v.celebradas > 0 ? (v.conciliadas / v.celebradas * 100) : 0,
    }));

  return {
    KPIs: { total: rows.length, tasa, totalConc, sinMonto },
    monthlyBars,
    monthlyRate,
  };
}

// ── Sección 2: Conciliación ───────────────────────────────────────────────────
export function computeConciliacion(rows) {
  const celebradas  = rows.filter(r => r.celebrada  === true).length;
  const conciliadas = rows.filter(r => r.conciliada === true).length;
  const noConc      = celebradas - conciliadas;

  const todayMonth   = isoMonth(new Date());
  const monthEntries = buildMonthMap(rows);
  const racha = mejorRacha(monthEntries);

  // Solo meses ya ocurridos — misma lógica que Resumen
  const monthlyRate = monthEntries
    .filter(([k]) => k <= todayMonth)
    .map(([k, v]) => ({
      label: k,
      rate: v.celebradas > 0 ? (v.conciliadas / v.celebradas * 100) : 0,
    }));

  return {
    KPIs: { celebradas, conciliadas, noConc, racha },
    monthlyRate,
  };
}

// ── Sección 3: Montos ─────────────────────────────────────────────────────────
export function computeMontos(rows) {
  const conMonto = rows.filter(r => r.conciliada === true && r.monto > 0);
  const total    = conMonto.reduce((s, r) => s + r.monto, 0);
  const promedio = conMonto.length > 0 ? total / conMonto.length : 0;
  const maximo   = conMonto.length > 0 ? Math.max(...conMonto.map(r => r.monto)) : 0;

  const counts = new Array(RANGE_DEFS.length).fill(0);
  for (const r of conMonto) {
    const idx = RANGE_DEFS.findIndex(rd => r.monto >= rd.min && r.monto < rd.max);
    if (idx !== -1) counts[idx]++;
  }
  const classified = counts.reduce((a, b) => a + b, 0);
  const rangeData  = RANGE_DEFS.map((rd, i) => ({ ...rd, count: counts[i] })).filter(d => d.count > 0);

  return {
    KPIs: { total, promedio, maximo },
    rangeData,
    classified,
  };
}

// ── Sección 4: Abogados ───────────────────────────────────────────────────────
export function computeAbogados(rows) {
  const byAb = {};
  for (const r of rows) {
    if (!byAb[r.abogado]) byAb[r.abogado] = { total: 0, celebradas: 0, conciliadas: 0 };
    byAb[r.abogado].total++;
    if (r.celebrada  === true) byAb[r.abogado].celebradas++;
    if (r.conciliada === true) byAb[r.abogado].conciliadas++;
  }

  const sinAsignar = byAb['Sin asignar']?.total ?? 0;
  const validos = VALID_ABOGADOS.map(name => ({
    name,
    total:     byAb[name]?.total      ?? 0,
    celebradas: byAb[name]?.celebradas ?? 0,
    conciliadas: byAb[name]?.conciliadas ?? 0,
  })).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

  const mayor   = validos[0] ?? null;
  const promedio = validos.length > 0
    ? validos.reduce((s, d) => s + d.total, 0) / validos.length
    : 0;

  const barData = [
    ...validos.map(d => ({ label: d.name.split(' ')[0], value: d.total, color: null })),
    ...(sinAsignar > 0 ? [{ label: 'Sin asignar', value: sinAsignar, color: '#e05c5c' }] : []),
  ];

  const tableData = validos.map(d => ({
    name: d.name,
    total: d.total,
    tasa: d.celebradas > 0 ? fmtPct(d.conciliadas / d.celebradas * 100) : '—',
  }));

  return {
    KPIs: {
      totalAbogados: validos.length,
      mayorVolumen:  mayor ? `${mayor.name.split(' ')[0]} (${mayor.total})` : '—',
      promedio,
      sinAsignar,
    },
    barData,
    tableData,
  };
}

// ── Sección 5: Ciudades ───────────────────────────────────────────────────────
export function computeCiudades(rows) {
  const byCiudad = {};
  for (const r of rows) {
    if (!r.ciudad) continue;
    if (!byCiudad[r.ciudad]) byCiudad[r.ciudad] = { activos: 0, cerrados: 0 };
    if (r.procesoActivo === true)  byCiudad[r.ciudad].activos++;
    if (r.procesoActivo === false) byCiudad[r.ciudad].cerrados++;
  }

  const stackedBars = Object.entries(byCiudad)
    .map(([city, v]) => ({ city, activos: v.activos, cerrados: v.cerrados, total: v.activos + v.cerrados }))
    .sort((a, b) => b.total - a.total);

  const top5 = stackedBars.slice(0, 5).map(d => d.city);
  const monthMap = {};
  for (const r of rows) {
    if (!r.fechaAudiencia || !top5.includes(r.ciudad)) continue;
    const k = isoMonth(r.fechaAudiencia);
    if (!monthMap[k]) monthMap[k] = {};
    if (!monthMap[k][r.ciudad]) monthMap[k][r.ciudad] = 0;
    monthMap[k][r.ciudad]++;
  }
  const months = Object.keys(monthMap).sort();
  const monthlyLines = { months, cities: top5, series: top5.map(c => months.map(m => monthMap[m]?.[c] ?? 0)) };

  const sorted = stackedBars;
  return {
    KPIs: {
      totalCiudades: sorted.length,
      primera:  sorted[0]?.city ?? '—',
      segunda:  sorted[1]?.city ?? '—',
      tercera:  sorted[2]?.city ?? '—',
    },
    stackedBars,
    monthlyLines,
  };
}

// ── Sección 6: Procesos activos ───────────────────────────────────────────────
export function computeProcesos(rows) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const activos      = rows.filter(r => r.procesoActivo === true).length;
  const cerrados     = rows.filter(r => r.procesoActivo === false).length;
  const programadas  = rows.filter(r =>
    r.procesoActivo === true &&
    r.fechaAudiencia && r.fechaAudiencia > today &&
    r.celebrada !== true,
  ).length;
  const sinProgramar = rows.filter(r =>
    r.procesoActivo === true && !r.fechaAudiencia,
  ).length;

  // Activos por ciudad
  const byCiudad = {};
  for (const r of rows.filter(r => r.procesoActivo === true)) {
    if (!r.ciudad) continue;
    byCiudad[r.ciudad] = (byCiudad[r.ciudad] ?? 0) + 1;
  }
  const activeByCity = Object.entries(byCiudad)
    .map(([city, count]) => ({ label: city, value: count }))
    .sort((a, b) => b.value - a.value);

  // Programadas por mes futuro
  const futureMonths = {};
  for (const r of rows) {
    if (r.procesoActivo !== true) continue;
    if (!r.fechaAudiencia || r.fechaAudiencia <= today) continue;
    if (r.celebrada === true) continue;
    const k = isoMonth(r.fechaAudiencia);
    futureMonths[k] = (futureMonths[k] ?? 0) + 1;
  }
  const scheduledByMonth = Object.entries(futureMonths)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, count]) => ({ label: k, count }));

  return {
    KPIs: { activos, cerrados, programadas, sinProgramar },
    activeByCity,
    scheduledByMonth,
  };
}
