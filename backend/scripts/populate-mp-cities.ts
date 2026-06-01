import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FETCH_TIMEOUT = 15000;

const ML_TO_MP_STATE: Record<string, string> = {
  'Bs.As. Costa Atlántica': 'Buenos Aires',
  'Bs.As. G.B.A. Norte': 'Buenos Aires',
  'Bs.As. G.B.A. Oeste': 'Buenos Aires',
  'Bs.As. G.B.A. Sur': 'Buenos Aires',
  'Buenos Aires Interior': 'Buenos Aires',
};

function normalizeStateName(name: string): string {
  return ML_TO_MP_STATE[name] || name;
}

function log(msg: string) {
  process.stdout.write(`LOG: ${msg}\n`);
}

function success(msg: string) {
  process.stdout.write(`SUCCESS: ${msg}\n`);
}

function error(msg: string) {
  process.stderr.write(`ERROR: ${msg}\n`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: Record<string, unknown> = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), (options.timeout as number) || FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: ac.signal } as RequestInit);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  log('Iniciando poblacion de tabla mp_city_mappings...');

  log('Obteniendo estados de Argentina desde MercadoLibre...');
  const countriesUrl = 'https://api.mercadolibre.com/classified_locations/countries/AR';
  let states: Array<{ id: string; name: string }>;
  try {
    const res = await fetchWithTimeout(countriesUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { states?: Array<{ id: string; name: string }> };
    states = data.states ?? [];
  } catch (e) {
    error(`No se pudieron obtener los estados de Argentina: ${e}`);
    process.exit(1);
  }

  log(`Encontrados ${states.length} estados en total.`);

  const skipStates = new Set([
    'Brasil', 'Chile', 'República Dominicana', 'USA', 'Uruguay',
    'Província de Buenos Aires',
  ]);
  const arStates = states.filter((s) => !skipStates.has(s.name));

  log(`Filtrando a ${arStates.length} estados argentinos.`);
  let upsertedCount = 0;

  for (let i = 0; i < arStates.length; i++) {
    const state = arStates[i];
    log(`[${i + 1}/${arStates.length}] Procesando estado: ${state.name}`);

    let cities: Array<{ id: string; name: string }>;
    try {
      const citiesUrl = `https://api.mercadolibre.com/classified_locations/states/${state.id}`;
      const res = await fetchWithTimeout(citiesUrl);
      await delay(250);
      if (!res.ok) {
        log(`  WARNING - HTTP ${res.status} para ${state.name}`);
        continue;
      }
      const data = (await res.json()) as { cities?: Array<{ id: string; name: string }> };
      cities = data.cities ?? [];
    } catch (e) {
      log(`  WARNING - error al obtener ciudades para ${state.name}: ${e}`);
      continue;
    }

    for (const city of cities) {
      let geo: { latitude: number; longitude: number } | null = null;
      try {
        const cityUrl = `https://api.mercadolibre.com/classified_locations/cities/${city.id}`;
        const res = await fetchWithTimeout(cityUrl);
        await delay(250);
        if (res.ok) {
          const detail = (await res.json()) as {
            geo_information?: { location?: { latitude: number; longitude: number } };
          };
          if (detail.geo_information?.location) {
            geo = detail.geo_information.location;
          }
        }
      } catch (e) {
        continue;
      }

      if (!geo) continue;

      try {
        const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${geo.latitude}&lon=${geo.longitude}&format=json&addressdetails=1`;
        const res = await fetchWithTimeout(nomUrl, {
          headers: { 'User-Agent': 'mposw/1.0' },
        } as Record<string, unknown>);
        await delay(1100);

        if (!res.ok) continue;

        const nomData = (await res.json()) as { address?: { postcode?: string } };
        const postcode = nomData.address?.postcode;

        if (postcode) {
            await prisma.mpCityMapping.upsert({
              where: { zipCode: postcode },
              create: {
                zipCode: postcode,
                cityName: city.name,
                stateName: normalizeStateName(state.name),
                neighborhoodName: city.name,
                mlCityId: city.id,
              },
              update: {
                cityName: city.name,
                stateName: normalizeStateName(state.name),
                neighborhoodName: city.name,
                mlCityId: city.id,
              },
            });
          upsertedCount++;
        }
      } catch (e) {
        continue;
      }
    }
  }

  success(`Tabla mp_city_mappings poblada con ${upsertedCount} registros`);
}

main()
  .catch((e) => {
    error(`Error fatal: ${e}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
