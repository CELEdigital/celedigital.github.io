// Visor de las galerías del shortcode galeria: un <dialog> compartido por todas
// las galerías de la página. Sin JS, cada miniatura es un link a la imagen.
(function () {
  var visor, imagen, contador, fotos = [], actual = 0;

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

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-galeria]").forEach(function (galeria) {
      var links = Array.prototype.slice.call(galeria.querySelectorAll(".galeria__foto"));
      links.forEach(function (link, i) {
        link.addEventListener("click", function (e) {
          if (!window.HTMLDialogElement) return; // navegador viejo: abre el link
          e.preventDefault();
          if (!visor) crearVisor();
          rotular(galeria);
          fotos = links;
          mostrar(i);
          visor.showModal();
        });
      });
    });
  });
})();
