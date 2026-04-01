/**
 * data.js — Fuente de datos del dashboard.
 *
 * INTEGRACIÓN CON BASE DE DATOS:
 * Reemplaza los objetos estáticos por llamadas a tu API o endpoint.
 * Ejemplo:
 *   export async function fetchKPIs() {
 *     const res = await fetch('/api/audiencias/kpis');
 *     return res.json();
 *   }
 */

export const KPIs = {
  totalAudiencias:   840,
  conMonto:          550,
  clasificadas:      515,
  sinMonto:          290,
};

export const rangeData = [
  { rango: '0 – 4M',    ganancias: '0 – 10M',    count: 54,  cls: 'r0' },
  { rango: '4M – 6M',   ganancias: '10M – 20M',  count: 86,  cls: 'r1' },
  { rango: '6M – 7M',   ganancias: '20M – 30M',  count: 52,  cls: 'r2' },
  { rango: '7M – 8M',   ganancias: '30M – 50M',  count: 50,  cls: 'r3' },
  { rango: '9M – 10M',  ganancias: '50M – 60M',  count: 36,  cls: 'r4' },
  { rango: '10M – 12M', ganancias: '60M – 80M',  count: 43,  cls: 'r5' },
  { rango: '12M – 15M', ganancias: '80M – 90M',  count: 77,  cls: 'r6' },
  { rango: '15M – 19M', ganancias: '90M – 100M', count: 85,  cls: 'r6b' },
  { rango: '+20M',      ganancias: '+ 100M',      count: 32,  cls: 'r6c' },
];

export const cityData = [
  { city: 'Medellín',      count: 587 },
  { city: 'Bogotá',        count: 76  },
  { city: 'Neiva',         count: 57  },
  { city: 'Bucaramanga',   count: 43  },
  { city: 'Barranquilla',  count: 13  },
  { city: 'Cali',          count: 12  },
  { city: 'Envigado',      count: 10  },
  { city: 'Bello',         count: 6   },
  { city: 'Cúcuta',        count: 5   },
  { city: 'Manizales',     count: 5   },
  { city: 'Villavicencio', count: 5   },
  { city: 'Itagüí',        count: 5   },
  { city: 'Armenia',       count: 4   },
  { city: 'Montería',      count: 2   },
  { city: 'Girardot',      count: 1   },
];

// Paleta de colores para el donut (orden = orden en rangeData)
export const DONUT_COLORS = [
  '#5b8dee', '#3ecf8e', '#c8a96e', '#e08c5c', '#e05c5c',
  '#a855f7', '#ec4899', '#f59e0b', '#10b981',
];
