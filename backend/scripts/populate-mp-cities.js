const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FETCH_TO = 15000;

const ML_TO_MP_STATE = {
  'Bs.As. Costa Atlántica': 'Buenos Aires',
  'Bs.As. G.B.A. Norte': 'Buenos Aires',
  'Bs.As. G.B.A. Oeste': 'Buenos Aires',
  'Bs.As. G.B.A. Sur': 'Buenos Aires',
  'Buenos Aires Interior': 'Buenos Aires',
};

function normalizeStateName(name) {
  return ML_TO_MP_STATE[name] || name;
}

function log(msg) { process.stdout.write('LOG: ' + msg + '\n'); }
function success(msg) { process.stdout.write('SUCCESS: ' + msg + '\n'); }
function error(msg) { process.stderr.write('ERROR: ' + msg + '\n'); }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTO(url, opts) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TO);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

async function main() {
  log('Iniciando poblacion de tabla mp_city_mappings...');
  log('Obteniendo estados AR desde MercadoLibre...');

  const sr = await fetchTO('https://api.mercadolibre.com/classified_locations/countries/AR', {});
  const sd = await sr.json();
  const skip = new Set(['Brasil','Chile','República Dominicana','USA','Uruguay','Província de Buenos Aires']);
  const arStates = (sd.states||[]).filter(s => !skip.has(s.name));
  log(arStates.length + ' estados argentinos');
  let count = 0, ci = 0;

  for (const state of arStates) {
    ci++;
    log('['+ci+'/'+arStates.length+'] ' + state.name);
    let cities = [];
    try {
      const cr = await fetchTO('https://api.mercadolibre.com/classified_locations/states/'+state.id, {});
      await delay(250);
      if (cr.ok) cities = ((await cr.json()).cities||[]);
    } catch(e) { log('  SKIP state: '+e.message); continue; }

    for (const city of cities) {
      let geo = null;
      try {
        const dr = await fetchTO('https://api.mercadolibre.com/classified_locations/cities/'+city.id, {});
        await delay(250);
        if (dr.ok) {
          const dd = await dr.json();
          if (dd.geo_information && dd.geo_information.location) geo = dd.geo_information.location;
        }
      } catch(e) { continue; }

      if (!geo) continue;

      try {
        const nr = await fetchTO(
          'https://nominatim.openstreetmap.org/reverse?lat='+geo.latitude+'&lon='+geo.longitude+'&format=json&addressdetails=1',
          { headers: { 'User-Agent': 'mposw/1.0' } }
        );
        await delay(1100);
        if (nr.ok) {
          const nd = await nr.json();
          const pc = nd.address && nd.address.postcode;
          if (pc) {
            await prisma.mpCityMapping.upsert({
              where: { zipCode: pc },
              create: { zipCode: pc, cityName: city.name, stateName: normalizeStateName(state.name), neighborhoodName: city.name, mlCityId: city.id },
              update: { cityName: city.name, stateName: normalizeStateName(state.name), neighborhoodName: city.name, mlCityId: city.id },
            });
            count++;
          }
        }
      } catch(e) { /* skip */ }
    }
  }

  success('Tabla mp_city_mappings poblada con ' + count + ' registros');
}

main().catch(e => { error('Error fatal: '+e); process.exit(1); }).finally(() => prisma.$disconnect());
