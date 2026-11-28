import { iniciarAccesibilidad } from './accesibilidad.js';
import { iniciarMapa } from './mapa.js';
import { iniciarRutas } from './rutas.js';
import { iniciarUbicacion, iniciarAvisoConexion } from './ubicacion.js';

//  Menú hamburguesa (móvil) 
const menu = document.getElementById('menu');
const burger = document.getElementById('burger');

function abrirMenu(abrir) {
  menu.classList.toggle('open', abrir);
  burger.setAttribute('aria-expanded', String(abrir));
  burger.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
}

burger.addEventListener('click', () => {
  abrirMenu(!menu.classList.contains('open'));
});

// Esc cierra el menú y devuelve el foco al botón
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu.classList.contains('open')) {
    abrirMenu(false);
    burger.focus();
  }
});

// Al elegir un enlace del menú, se cierra
menu.addEventListener('click', (e) => {
  if (e.target.closest('nav a')) abrirMenu(false);
});

iniciarAccesibilidad();
// Si el mapa no carga, mapa vale null y la lista de rutas funciona igualmente
const mapa = iniciarMapa();
// La ubicación se prepara antes para que reciba los avisos de las rutas
iniciarUbicacion(mapa);
iniciarAvisoConexion();
iniciarRutas(mapa);