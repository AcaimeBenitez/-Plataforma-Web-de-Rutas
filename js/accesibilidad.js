const TAMANOS = [90, 100, 115, 130];
const NIVEL_NORMAL = 1;

function leerAjuste(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function guardarAjuste(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: el ajuste dura solo esta visita */ }
}

export function iniciarAccesibilidad() {
  const raiz = document.documentElement;
  const btnMenos = document.getElementById('tm');
  const btnNormal = document.getElementById('tn');
  const btnMas = document.getElementById('tp');
  const btnDalt = document.getElementById('dalt');
  const btnLeer = document.getElementById('leer');

  //  Tamaño del texto 
  let nivel = parseInt(leerAjuste('sendas-tamano'), 10);
  if (!(nivel >= 0 && nivel < TAMANOS.length)) nivel = NIVEL_NORMAL;

  function aplicarTamano(nuevo) {
    nivel = nuevo;
    raiz.style.fontSize = TAMANOS[nivel] + '%';
    btnMenos.disabled = nivel === 0;
    btnMas.disabled = nivel === TAMANOS.length - 1;
    guardarAjuste('sendas-tamano', nivel);
  }

  btnMenos.addEventListener('click', () => aplicarTamano(Math.max(0, nivel - 1)));
  btnNormal.addEventListener('click', () => aplicarTamano(NIVEL_NORMAL));
  btnMas.addEventListener('click', () => aplicarTamano(Math.min(TAMANOS.length - 1, nivel + 1)));
  aplicarTamano(nivel);

  //  Modo daltonismo 
  function aplicarDalt(activo) {
    raiz.classList.toggle('dalt', activo);
    btnDalt.setAttribute('aria-pressed', String(activo));
    guardarAjuste('sendas-dalt', activo ? '1' : '0');
  }

  btnDalt.addEventListener('click', () => {
    aplicarDalt(btnDalt.getAttribute('aria-pressed') !== 'true');
  });
  aplicarDalt(leerAjuste('sendas-dalt') === '1');

  //  Escuchar página 
  const voz = window.speechSynthesis;
  if (!voz || !window.SpeechSynthesisUtterance) {
    btnLeer.hidden = true; 
    return;
  }

  function detener() {
    voz.cancel();
    btnLeer.setAttribute('aria-pressed', 'false');
    btnLeer.textContent = 'Escuchar página';
  }

  function textoDeLaPagina() {
    return [...document.querySelectorAll('[data-leer]')]
      .map((bloque) => bloque.innerText)
      .join('. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  btnLeer.addEventListener('click', () => {
    if (btnLeer.getAttribute('aria-pressed') === 'true') {
      detener();
      return;
    }
    // Se lee por frases porque algunos navegadores cortan los textos largos
    const frases = textoDeLaPagina().match(/[^.!?]+[.!?]*/g) || [];
    btnLeer.setAttribute('aria-pressed', 'true');
    btnLeer.textContent = 'Detener lectura';
    frases.forEach((frase, i) => {
      const lectura = new SpeechSynthesisUtterance(frase);
      lectura.lang = 'es-ES';
      if (i === frases.length - 1) lectura.onend = detener;
      voz.speak(lectura);
    });
  });

  window.addEventListener('pagehide', () => voz.cancel());
}
