// Carga las rutas desde los GeoJSON, calcula sus datos, crea las tarjetas,
// aplica los filtros y dibuja las líneas en el mapa.

const ARCHIVOS = ['data/ruta-1.geojson', 'data/ruta-2.geojson', 'data/ruta-3.geojson'];

// Estilo de línea según la dificultad: así no depende solo del color
const TRAZOS = {
  'Fácil': { dashArray: null, texto: 'línea continua' },
  'Moderada': { dashArray: '12 8', texto: 'línea discontinua' },
  'Difícil': { dashArray: '2 9', texto: 'línea de puntos' },
};

// ---------- Cálculos ----------

// Distancia en metros entre dos puntos [lon, lat] (fórmula de Haversine)
export function distanciaMetros(a, b) {
  const R = 6371000; // radio de la Tierra
  const rad = (grados) => (grados * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "Esfuerzo": cada 100 m de subida cuentan como 1 km más en llano
function calcularDificultad(km, subida) {
  const esfuerzo = km + subida / 100;
  if (esfuerzo < 7) return 'Fácil';
  if (esfuerzo < 11) return 'Moderada';
  return 'Difícil';
}

// Convierte un GeoJSON en un objeto con todos los datos que usa la web
function prepararRuta(geojson) {
  const linea = geojson.features.find((f) => f.geometry.type === 'LineString');
  if (!linea) throw new Error('El archivo no tiene ninguna línea de ruta');

  const puntos = linea.geometry.coordinates; // [lon, lat, altitud]
  const acumulado = [0]; // metros desde la salida hasta cada punto
  let subida = 0;
  let bajada = 0;

  for (let i = 1; i < puntos.length; i++) {
    acumulado.push(acumulado[i - 1] + distanciaMetros(puntos[i - 1], puntos[i]));
    const cambio = puntos[i][2] - puntos[i - 1][2];
    if (cambio > 0) subida += cambio;
    else bajada -= cambio;
  }

  // A cada parada se le asigna el kilómetro del punto de la línea más cercano
  const hitos = geojson.features
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => {
      const distancias = puntos.map((p) => distanciaMetros(p, f.geometry.coordinates));
      const cercano = distancias.indexOf(Math.min(...distancias));
      return { ...f.properties, coordenadas: f.geometry.coordinates, km: acumulado[cercano] / 1000 };
    })
    .sort((a, b) => a.km - b.km);

  const km = acumulado[acumulado.length - 1] / 1000;

  return {
    ...linea.properties,
    // Leaflet usa [lat, lon], al revés que GeoJSON
    latlngs: puntos.map(([lon, lat]) => [lat, lon]),
    km,
    subida: Math.round(subida),
    bajada: Math.round(bajada),
    dificultad: calcularDificultad(km, subida),
    hitos,
  };
}

async function cargarArchivo(url) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`${url}: error ${respuesta.status}`);
  return prepararRuta(await respuesta.json());
}

// ---------- Utilidades ----------

const formatoKm = (km) => `${km.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

// Crea un elemento con texto (con textContent, sin HTML en cadenas)
function crear(etiqueta, texto, clase) {
  const el = document.createElement(etiqueta);
  if (texto) el.textContent = texto;
  if (clase) el.className = clase;
  return el;
}

// ---------- Interfaz ----------

export async function iniciarRutas(mapa) {
  const lista = document.getElementById('lista-rutas');
  const estado = document.getElementById('rutas-estado');
  const filtros = document.getElementById('filtros');
  const filtroDificultad = document.getElementById('f-dificultad');
  const filtroDistancia = document.getElementById('f-distancia');

  // allSettled: si un archivo falla, los demás se siguen mostrando
  const resultados = await Promise.allSettled(ARCHIVOS.map(cargarArchivo));
  const rutas = resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const fallos = resultados.filter((r) => r.status === 'rejected');
  fallos.forEach((f) => console.warn('No se pudo cargar una ruta:', f.reason));

  if (rutas.length === 0) {
    estado.textContent = 'No se han podido cargar las rutas. Comprueba tu conexión y recarga la página.';
    return;
  }

  let seleccionada = null;

  // Crea la tarjeta y las capas del mapa de cada ruta
  rutas.forEach((ruta) => {
    const tarjeta = crear('li', '', 'ruta');
    const meta = crear('p', '', 'ruta-meta');
    meta.append(
      crear('span', `Distancia: ${formatoKm(ruta.km)}.`),
      crear('span', `Subida: ${ruta.subida} m.`),
      crear('span', `Bajada: ${ruta.bajada} m.`),
      crear('span', `Dificultad: ${ruta.dificultad}.`, 'chip'),
    );

    const boton = crear('button', 'Ver en el mapa', 'boton');
    boton.type = 'button';
    boton.setAttribute('aria-pressed', 'false');
    // El lector de pantalla oye también de qué ruta es el botón
    boton.append(crear('span', `: ${ruta.nombre}`, 'oculto'));
    boton.addEventListener('click', () => seleccionar(ruta));

    const paradas = crear('div', '', 'paradas');
    paradas.hidden = true;
    const listaParadas = crear('ol');
    ruta.hitos.forEach((h) => listaParadas.append(crear('li', `${h.nombre} (km ${formatoKm(h.km).replace(' km', '')}).`)));
    paradas.append(crear('h4', 'Paradas'), listaParadas);

    tarjeta.append(
      crear('h3', ruta.nombre),
      crear('p', ruta.descripcion, 'ruta-desc'),
      meta,
      crear('p', `En el mapa: ${TRAZOS[ruta.dificultad].texto}.`, 'ruta-trazo'),
      boton,
      paradas,
    );
    lista.append(tarjeta);
    Object.assign(ruta, { tarjeta, boton, paradas });

    if (mapa) crearCapas(ruta);
  });

  function crearCapas(ruta) {
    // Borde blanco por debajo para que la línea se vea sobre cualquier mapa base
    const borde = L.polyline(ruta.latlngs, { className: 'linea-borde', weight: 9, interactive: false });
    const linea = L.polyline(ruta.latlngs, {
      className: 'linea-ruta',
      weight: 5,
      dashArray: TRAZOS[ruta.dificultad].dashArray,
    });
    linea.bindTooltip(`${ruta.nombre} (${ruta.dificultad})`, { sticky: true });
    linea.on('click', () => seleccionar(ruta, false));

    // Paradas (la salida ya tiene su propio marcador)
    const puntos = L.layerGroup(ruta.hitos.filter((h) => h.km > 0).map((h) => {
      const [lon, lat] = h.coordenadas;
      const popup = crear('div');
      popup.append(
        crear('strong', h.nombre),
        crear('p', h.descripcion),
        crear('p', `A ${formatoKm(h.km)} de la salida.`),
      );
      return L.circleMarker([lat, lon], { className: 'punto-hito', radius: 8 }).bindPopup(popup);
    }));

    Object.assign(ruta, { borde, linea, puntos, grupo: L.layerGroup([borde, linea]).addTo(mapa) });
  }

  function marcarSeleccion() {
    document.dispatchEvent(new CustomEvent('ruta-seleccionada', { detail: seleccionada }));
    rutas.forEach((r) => {
      const activa = r === seleccionada;
      r.tarjeta.classList.toggle('activa', activa);
      r.boton.setAttribute('aria-pressed', String(activa));
      r.paradas.hidden = !activa;
      if (!mapa) return;
      if (activa) {
        r.puntos.addTo(mapa);
        r.borde.bringToFront();
        r.linea.bringToFront();
        r.puntos.eachLayer((p) => p.bringToFront());
      } else {
        r.puntos.remove();
      }
      r.linea.getElement()?.classList.toggle('activa', activa);
    });
  }

  function seleccionar(ruta, moverVista = true) {
    seleccionada = ruta;
    marcarSeleccion();
    estado.textContent = `Ruta seleccionada: ${ruta.nombre}.`;

    if (!mapa || !moverVista) return;
    mapa.fitBounds(ruta.linea.getBounds(), { padding: [40, 40] });
    // En móvil el mapa está arriba: se desplaza la página para que se vea
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.getElementById('mapa').scrollIntoView({ block: 'start' });
    }
  }

  // ---------- Filtros ----------

  function filtrar() {
    const dificultad = filtroDificultad.value; // '' = todas
    const maximo = Number(filtroDistancia.value) || Infinity; // '' = sin límite
    let visibles = 0;

    rutas.forEach((r) => {
      const cumple = (!dificultad || r.dificultad === dificultad) && r.km <= maximo;
      r.tarjeta.hidden = !cumple;
      if (cumple) visibles++;
      if (!cumple && seleccionada === r) seleccionada = null;
      if (mapa) {
        if (cumple) r.grupo.addTo(mapa);
        else r.grupo.remove();
      }
    });

    marcarSeleccion();

    if (visibles === 0) estado.textContent = 'Ninguna ruta cumple los filtros. Prueba a cambiarlos.';
    else estado.textContent = `Mostrando ${visibles} de ${rutas.length} rutas.`;
    if (fallos.length) estado.textContent += ` No se han podido cargar ${fallos.length}.`;
  }

  filtros.addEventListener('change', filtrar);
  // El botón "reset" cambia los valores después del evento, por eso se espera un instante
  filtros.addEventListener('reset', () => setTimeout(filtrar));
  filtros.addEventListener('submit', (e) => e.preventDefault());
  filtros.hidden = false;
  filtrar();

  // Vista inicial con todas las rutas
  if (mapa) {
    mapa.fitBounds(L.latLngBounds(rutas.flatMap((r) => r.latlngs)), { padding: [30, 30] });
  }
}
