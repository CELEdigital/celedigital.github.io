// Visor de las galerías del shortcode galeria: un <dialog> compartido por todas
// las galerías de la página. Sin JS, cada miniatura es un link a la imagen.
(function () {
  var visor, imagen, contador, fotos = [], actual = 0, galeriaAbierta = null;

  function crearVisor() {
    visor = document.createElement("dialog");
    visor.className = "galeria-visor";
    visor.innerHTML =
      '<button type="button" class="galeria-visor__cerrar"></button>' +
      '<button type="button" class="galeria-visor__nav galeria-visor__nav--anterior"></button>' +
      '<img class="galeria-visor__imagen" alt="">' +
      '<button type="button" class="galeria-visor__nav galeria-visor__nav--siguiente"></button>' +
      '<p class="galeria-visor__contador" aria-live="polite"></p>';
    imagen = visor.querySelector(".galeria-visor__imagen");
    contador = visor.querySelector(".galeria-visor__contador");

    visor.querySelector(".galeria-visor__cerrar").addEventListener("click", function () { visor.close(); });
    visor.querySelector(".galeria-visor__nav--anterior").addEventListener("click", function () { mostrar(actual - 1); });
    visor.querySelector(".galeria-visor__nav--siguiente").addEventListener("click", function () { mostrar(actual + 1); });
    // Un clic en el fondo (fuera de la foto y de los botones) cierra.
    visor.addEventListener("click", function (e) { if (e.target === visor) visor.close(); });
    visor.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") mostrar(actual - 1);
      if (e.key === "ArrowRight") mostrar(actual + 1);
    });
    // En una galería paginada, al cerrar se muestra la página de la última foto.
    visor.addEventListener("close", function () {
      if (galeriaAbierta && galeriaAbierta.irAFoto) galeriaAbierta.irAFoto(actual);
    });
    document.body.appendChild(visor);
  }

  function rotular(galeria) {
    var botones = {
      ".galeria-visor__cerrar": ["cerrar", "×"],
      ".galeria-visor__nav--anterior": ["anterior", "‹"],
      ".galeria-visor__nav--siguiente": ["siguiente", "›"]
    };
    Object.keys(botones).forEach(function (sel) {
      var b = visor.querySelector(sel);
      b.setAttribute("aria-label", galeria.dataset[botones[sel][0]]);
      b.textContent = botones[sel][1];
    });
  }

  function mostrar(i) {
    actual = (i + fotos.length) % fotos.length;
    imagen.src = fotos[actual].href;
    imagen.alt = fotos[actual].querySelector("img").alt;
    contador.textContent = (actual + 1) + " / " + fotos.length;
    var unica = fotos.length < 2;
    visor.querySelectorAll(".galeria-visor__nav").forEach(function (b) { b.hidden = unica; });
  }

  // Paginación (shortcode con paginar="true"): oculta las fotos que no son de
  // la página actual y agrega la botonera debajo de la grilla.
  function paginar(galeria) {
    var porPagina = parseInt(galeria.dataset.porPagina, 10);
    var items = galeria.querySelectorAll(".galeria__grilla > li");
    var total = Math.ceil(items.length / porPagina);
    var pagina = 0;

    var nav = document.createElement("nav");
    nav.className = "galeria__paginas";
    nav.setAttribute("aria-label", galeria.dataset.paginas);
    var html = '<button type="button" data-paso="-1" aria-label="' + galeria.dataset.anterior + '">‹</button>';
    for (var p = 0; p < total; p++) {
      html += '<button type="button" data-pagina="' + p + '" aria-label="' +
        galeria.dataset.pagina + " " + (p + 1) + '">' + (p + 1) + "</button>";
    }
    html += '<button type="button" data-paso="1" aria-label="' + galeria.dataset.siguiente + '">›</button>';
    nav.innerHTML = html;
    galeria.querySelector(".galeria__grilla").after(nav);

    function ir(p, desplazar) {
      pagina = Math.max(0, Math.min(total - 1, p));
      items.forEach(function (li, i) {
        li.hidden = Math.floor(i / porPagina) !== pagina;
      });
      nav.querySelectorAll("[data-pagina]").forEach(function (b) {
        var activa = Number(b.dataset.pagina) === pagina;
        b.classList.toggle("is-activa", activa);
        if (activa) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
      });
      nav.querySelector('[data-paso="-1"]').disabled = pagina === 0;
      nav.querySelector('[data-paso="1"]').disabled = pagina === total - 1;
      // Si la grilla quedó arriba de la pantalla, volver a su comienzo.
      if (desplazar && galeria.getBoundingClientRect().top < 0) {
        galeria.scrollIntoView({ block: "start" });
      }
    }

    nav.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.paso) ir(pagina + Number(b.dataset.paso), true);
      else ir(Number(b.dataset.pagina), true);
    });

    galeria.irAFoto = function (i) { ir(Math.floor(i / porPagina), false); };
    ir(0, false);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-galeria]").forEach(function (galeria) {
      if (galeria.dataset.porPagina) paginar(galeria);
      var links = Array.prototype.slice.call(galeria.querySelectorAll(".galeria__foto"));
      links.forEach(function (link, i) {
        link.addEventListener("click", function (e) {
          if (!window.HTMLDialogElement) return; // navegador viejo: abre el link
          e.preventDefault();
          if (!visor) crearVisor();
          rotular(galeria);
          fotos = links;
          galeriaAbierta = galeria;
          mostrar(i);
          visor.showModal();
        });
      });
    });
  });
})();
