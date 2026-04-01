/**
 * data.js — Autenticación MSAL + lectura en tiempo real via Microsoft Graph API.
 *
 * Expone los mismos objetos que consumen charts.js y main.js,
 * ahora calculados dinámicamente desde la hoja "Audiencias" en SharePoint.
 *
 * Requiere: msal-browser cargado como global <script> en index.html.
 */

// ── Configuración ─────────────────────────────────────────────────────────────
const MSAL_CONFIG = {
  auth: {
    clientId:    '6151a3a1-2193-41cb-acbc-483082e2b85c',
    authority:   'https://login.microsoftonline.com/dc60f95d-5f6e-4d2c-a86b-320a2b60144e',
    redirectUri: 'https://juandie56.github.io/dashboard-audiencias',
  },
  cache: {
    cacheLocation:          'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

const SCOPES = ['User.Read', 'Files.Read.All'];

const SHAREPOINT_FILE_URL =
  'https://quinteropalacio-my.sharepoint.com/:x:/g/personal/squintero_qpalliance_co/IQDtJdfGY0zFSJM4MXWHlD2VAVyrIpIwyYC-eQ_x4euQ0Y8';

// ── Rangos de clasificación ───────────────────────────────────────────────────
const RANGE_DEFS = [
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

// ── Inicialización MSAL (top-level await — válido en ES modules) ──────────────
export const msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);
await msalInstance.initialize();
await msalInstance.handleRedirectPromise().catch(() => {});

// ── Auth ──────────────────────────────────────────────────────────────────────
export function getActiveAccount() {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

export async function login() {
  await msalInstance.loginPopup({ scopes: SCOPES });
  return getActiveAccount();
}

export function logout() {
  const account = getActiveAccount();
  if (account) msalInstance.logoutPopup({ account });
}

async function getToken() {
  const account = getActiveAccount();
  if (!account) throw new Error('No hay sesión activa.');
  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: SCOPES, account });
    return result.accessToken;
  } catch {
    const result = await msalInstance.acquireTokenPopup({ scopes: SCOPES });
    return result.accessToken;
  }
}

// ── Microsoft Graph API ───────────────────────────────────────────────────────

/**
 * Convierte una URL de compartir de SharePoint al ID que usa el endpoint
 * /shares de Graph API: "u!" + base64url(url)
 */
function sharingUrlToId(url) {
  const b64 = btoa(url).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return 'u!' + b64;
}

async function graphGet(path, token) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Columnas (índice 0-based; fila 0 = encabezados) ──────────────────────────
// 0:#  1:Nombre  2:Juzgado  3:Consecutivo  4:Ciudad  5:Cliente
// 6:Fecha audiencia  7:Hora  8:Monto  9:Monto cliente  10:Honorarios ...
const COL_CIUDAD = 4;
const COL_MONTO  = 8;

function parseAmount(val) {
  if (typeof val === 'number') return val;
  // Limpia formato moneda colombiano: "$1.500.000" o "1,500,000" → número
  const clean = String(val ?? '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')    // separador de miles en es-CO
    .replace(',', '.');    // separador decimal
  return parseFloat(clean) || 0;
}

// ── Procesamiento de datos ────────────────────────────────────────────────────
function processRows(rows) {
  // Fila 0 = encabezados; filtrar filas sin número de registro (#)
  const data = rows.slice(1).filter(r => r[0] !== null && r[0] !== '' && r[0] !== undefined);

  let conMonto = 0;
  let sinMonto = 0;
  const counts = new Array(RANGE_DEFS.length).fill(0);
  const cities = {};

  for (const row of data) {
    const monto  = parseAmount(row[COL_MONTO]);
    const ciudad = String(row[COL_CIUDAD] ?? '').trim();

    if (monto > 0) {
      conMonto++;
      const idx = RANGE_DEFS.findIndex(r => monto >= r.min && monto < r.max);
      if (idx !== -1) counts[idx]++;
    } else {
      sinMonto++;
    }

    if (ciudad) cities[ciudad] = (cities[ciudad] ?? 0) + 1;
  }

  return {
    KPIs: {
      totalAudiencias: data.length,
      conMonto,
      clasificadas:    counts.reduce((a, b) => a + b, 0),
      sinMonto,
    },
    rangeData: RANGE_DEFS
      .map((r, i) => ({ ...r, count: counts[i] }))
      .filter(r => r.count > 0),
    cityData: Object.entries(cities)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ── Carga principal (llamada desde main.js) ───────────────────────────────────
export async function loadDashboardData() {
  const token   = await getToken();
  const shareId = sharingUrlToId(SHAREPOINT_FILE_URL);

  // Resolver URL compartida → driveId + itemId
  const item    = await graphGet(`/shares/${shareId}/driveItem`, token);
  const driveId = item.parentReference.driveId;
  const itemId  = item.id;

  // Leer todo el rango usado de la hoja Audiencias
  const range = await graphGet(
    `/drives/${driveId}/items/${itemId}/workbook/worksheets/Audiencias/usedRange`,
    token,
  );

  return processRows(range.values);
}

// ── Export de compatibilidad para charts.js ───────────────────────────────────
export const DONUT_COLORS = [
  '#5b8dee', '#3ecf8e', '#c8a96e', '#e08c5c', '#e05c5c',
  '#a855f7', '#ec4899', '#f59e0b', '#10b981',
];
