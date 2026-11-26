export const ORIGEN = {
  nombre: 'Parque Tecnológico de Fuerteventura',
  direccion: 'Antiguo Aeropuerto de Los Estancos, s/n, 35612 Puerto del Rosario',
  lat: 28.523652,
  lon: -13.892905,
};

const ENLACE_OSM = '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function iniciarMapa() {
  const lienzo = document.getElementById('mapa-lienzo');
  const aviso = document.getElementById('mapa-aviso');

  // Si Leaflet no se ha cargado (sin internet, por ejemplo) se avisa y el resto de la página sigue funcionando
  if (typeof L === 'undefined') {
    aviso.textContent = 'No se ha podido cargar el mapa. Comprueba tu conexión a internet y recarga la página.';
    return null;
  }

  //  Capas base 
  const callejero = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: `© ${ENLACE_OSM} contributors`,
  });

  const topografico = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    subdomains: 'abc',
    attribution: `Datos © ${ENLACE_OSM} contributors, SRTM. Estilo © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
  });

  const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 17,
    attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics y la comunidad de usuarios GIS',
  });

  //  Mapa 
  const mapa = L.map(lienzo, {
    center: [ORIGEN.lat, ORIGEN.lon],
    zoom: 13,
    minZoom: 9,
    maxZoom: 17,
    zoomControl: false, // se añade abajo para poder ponerle los textos en español
    layers: [callejero],
  });

  // Con el foco en el mapa, las flechas lo mueven y + / − lo acercan o alejan (lo hace Leaflet)
  lienzo.setAttribute('role', 'group');
  lienzo.setAttribute('aria-label', 'Mapa interactivo. Con el foco en el mapa, usa las flechas para moverte y los signos más y menos para acercar o alejar.');

  //  Controles 
  L.control.zoom({
    position: 'topright',
    zoomInTitle: 'Acercar',
    zoomOutTitle: 'Alejar',
  }).addTo(mapa);

  const capas = L.control.layers(
    { 'Callejero': callejero, 'Topográfico': topografico, 'Satélite': satelite },
    null,
    { position: 'topright' }
  ).addTo(mapa);

  // El botón de capas viene en inglés: se traduce para lectores de pantalla y para el ratón
  const botonCapas = capas.getContainer().querySelector('.leaflet-control-layers-toggle');
  botonCapas.title = 'Capas del mapa';
  botonCapas.setAttribute('aria-label', 'Capas del mapa');

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(mapa);

  //  Marcador del Parque Tecnológico 
  const descripcion = `${ORIGEN.nombre}, punto de salida de todas las rutas`;

  const icono = L.divIcon({
    className: 'marcador-origen',
    html: '<span class="pin"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });

  const marcador = L.marker([ORIGEN.lat, ORIGEN.lon], {
    icon: icono,
    title: descripcion,
    keyboard: true, // se puede enfocar con Tab y abrir con Enter
  }).addTo(mapa);

  const elemento = marcador.getElement();
  elemento.setAttribute('role', 'button');
  elemento.setAttribute('aria-label', descripcion);

  // El contenido del popup se construye con textContent (nada de HTML en cadenas)
  const popup = document.createElement('div');
  const titulo = document.createElement('strong');
  titulo.textContent = ORIGEN.nombre;
  const salida = document.createElement('p');
  salida.textContent = 'Punto de salida de todas las rutas.';
  const direccion = document.createElement('p');
  direccion.textContent = ORIGEN.direccion;
  popup.append(titulo, salida, direccion);
  marcador.bindPopup(popup);

  // El botón de cerrar del popup también viene en inglés
  mapa.on('popupopen', (e) => {
    const cerrar = e.popup.getElement().querySelector('.leaflet-popup-close-button');
    if (cerrar) cerrar.setAttribute('aria-label', 'Cerrar');
  });

  aviso.hidden = true;
  return mapa;
}