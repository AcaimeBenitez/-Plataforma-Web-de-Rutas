// Ubicación del usuario en tiempo real y aviso de conexión.

import { ORIGEN } from './mapa.js';
import { distanciaMetros } from './rutas.js';

// A partir de este margen de error se avisa de que la posición es poco fiable
const PRECISION_MALA = 100; // metros

const OPCIONES = {
  enableHighAccuracy: true, // usa el GPS si el dispositivo lo tiene
  timeout: 15000,           // máximo de espera: 15 segundos
  maximumAge: 5000,         // vale una posición de hace 5 segundos como mucho
};

// Mensajes según el código de error de la Geolocation API
const ERRORES = {
  1: 'No has dado permiso para usar tu ubicación. Para activarlo, abre los permisos del sitio (junto a la barra de direcciones) y vuelve a pulsar el botón. Las rutas se pueden consultar sin ubicación.',
  2: 'No se puede obtener tu posición. Comprueba que la ubicación del dispositivo está activada.',
  3: 'La señal está tardando demasiado. Se sigue intentando; al aire libre suele mejorar.',
};

function formatoDistancia(metros) {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;
}

// Avisa cuando se pierde o se recupera la conexión
export function iniciarAvisoConexion() {
  const aviso = document.getElementById('aviso-conexion');

  function actualizar() {
    aviso.textContent = navigator.onLine
      ? ''
      : 'Sin conexión a internet. Es posible que el mapa no cargue zonas nuevas.';
  }

  window.addEventListener('online', actualizar);
  window.addEventListener('offline', actualizar);
  actualizar();
}

export function iniciarUbicacion(mapa) {
  const boton = document.getElementById('btn-ubicacion');
  const botonCentrar = document.getElementById('btn-centrar');
  const estado = document.getElementById('ubicacion-estado');
  const datos = document.getElementById('ubicacion-datos');
  const textoOrigen = document.getElementById('d-origen');
  const textoParada = document.getElementById('d-parada');
  const textoPrecision = document.getElementById('d-precision');

  let vigilancia = null; // identificador de watchPosition (null = apagado)
  let posicion = null;   // última posición recibida
  let ruta = null;       // ruta seleccionada en el panel
  let marcador = null;
  let circulo = null;

  // Solo se escribe si el texto cambia, para que el lector de pantalla no lo repita
  function anunciar(texto) {
    if (estado.textContent !== texto) estado.textContent = texto;
  }

  if (!('geolocation' in navigator)) {
    boton.disabled = true;
    anunciar('Tu navegador no permite obtener la ubicación.');
    return;
  }
  if (!window.isSecureContext) {
    boton.disabled = true;
    anunciar('La ubicación solo funciona con HTTPS o en localhost.');
    return;
  }

  // Parada de la ruta seleccionada más cercana al usuario, en línea recta
  function actualizarParada() {
    textoParada.hidden = !(posicion && ruta);
    if (textoParada.hidden) return;

    const aqui = [posicion.longitude, posicion.latitude];
    const cercana = ruta.hitos
      .map((h) => ({ nombre: h.nombre, metros: distanciaMetros(aqui, h.coordenadas) }))
      .reduce((a, b) => (b.metros < a.metros ? b : a));

    textoParada.textContent = `Parada más cercana de «${ruta.nombre}»: ${cercana.nombre}, a ${formatoDistancia(cercana.metros)} en línea recta.`;
  }

  function dibujar(latlng, precision) {
    if (!mapa) return;
    if (!marcador) {
      circulo = L.circle(latlng, { radius: precision, className: 'circulo-precision', interactive: false }).addTo(mapa);
      marcador = L.circleMarker(latlng, { radius: 9, className: 'punto-usuario' }).addTo(mapa);
      // Etiqueta fija: el punto no se reconoce solo por el color
      marcador.bindTooltip('Estás aquí', { permanent: true, direction: 'top', offset: [0, -8] });
    } else {
      circulo.setLatLng(latlng).setRadius(precision);
      marcador.setLatLng(latlng);
    }
  }

  function recibirPosicion({ coords }) {
    const esLaPrimera = posicion === null;
    posicion = coords;
    const latlng = [coords.latitude, coords.longitude];

    const metros = distanciaMetros([coords.longitude, coords.latitude], [ORIGEN.lon, ORIGEN.lat]);
    textoOrigen.textContent = `Estás a ${formatoDistancia(metros)} de la salida en línea recta.`;

    const aviso = coords.accuracy > PRECISION_MALA ? ' La señal es poco precisa.' : '';
    textoPrecision.textContent = `Margen de error: unos ${formatoDistancia(coords.accuracy)}.${aviso}`;

    datos.hidden = false;
    botonCentrar.hidden = !mapa;
    anunciar('Ubicación activa.');
    actualizarParada();
    dibujar(latlng, coords.accuracy);

    // Solo la primera vez se mueve el mapa; después el usuario lo maneja libremente
    if (esLaPrimera && mapa) {
      mapa.fitBounds(L.latLngBounds([latlng, [ORIGEN.lat, ORIGEN.lon]]), { padding: [50, 50], maxZoom: 15 });
    }
  }

  function recibirError(error) {
    // Sin permiso no tiene sentido seguir intentándolo
    if (error.code === 1) apagar();
    let mensaje = ERRORES[error.code] || 'No se ha podido obtener la ubicación.';
    if (posicion) mensaje += ' Se muestra la última posición conocida.';
    anunciar(mensaje);
  }

  function encender() {
    boton.textContent = 'Desactivar mi ubicación';
    boton.setAttribute('aria-pressed', 'true');
    anunciar('Buscando tu ubicación…');
    // watchPosition avisa cada vez que cambia la posición
    vigilancia = navigator.geolocation.watchPosition(recibirPosicion, recibirError, OPCIONES);
  }

  function apagar() {
    if (vigilancia !== null) navigator.geolocation.clearWatch(vigilancia);
    vigilancia = null;
    posicion = null;
    marcador?.remove();
    circulo?.remove();
    marcador = null;
    circulo = null;
    datos.hidden = true;
    botonCentrar.hidden = true;
    boton.textContent = 'Activar mi ubicación';
    boton.setAttribute('aria-pressed', 'false');
  }

  boton.addEventListener('click', () => {
    if (vigilancia === null) {
      encender();
    } else {
      apagar();
      anunciar('Ubicación desactivada.');
    }
  });

  botonCentrar.addEventListener('click', () => {
    if (!posicion || !mapa) return;
    mapa.setView([posicion.latitude, posicion.longitude], 15);
    if (window.matchMedia('(max-width: 900px)').matches) {
      document.getElementById('mapa').scrollIntoView({ block: 'start' });
    }
  });

  // rutas.js avisa con este evento cuando cambia la ruta seleccionada
  document.addEventListener('ruta-seleccionada', (e) => {
    ruta = e.detail;
    actualizarParada();
  });
}
