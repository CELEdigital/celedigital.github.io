(function () {
  function buildInlineColumns(panel) {
    if (!panel || panel.dataset.columnsReady === "true") return;
    if (panel.classList.contains("observatory-inline-panel--boletines")) return;
    if (panel.classList.contains("observatory-inline-panel--mesas")) return;

    var children = Array.from(panel.children);
    if (!children.length) return;

    var grid = document.createElement("div");
    grid.className = "observatory-inline-grid";

    var block = null;
    children.forEach(function (node) {
      var tagName = node.tagName ? node.tagName.toUpperCase() : "";
      var startsBlock = tagName === "H1" || tagName === "H2";

      if (startsBlock) {
        block = document.createElement("section");
        block.className = "observatory-inline-block";
        grid.appendChild(block);
      }

      if (!block) {
        block = document.createElement("section");
        block.className = "observatory-inline-block";
        grid.appendChild(block);
      }

      block.appendChild(node);
    });

    if (grid.children.length) {
      panel.appendChild(grid);
      panel.dataset.columnsReady = "true";
    }
  }

  function setExpanded(toggle, expanded) {
    toggle.setAttribute("aria-expanded", String(expanded));
  }

  function scrollToSubsection(toggle) {
    if (!toggle) return;

    var container = toggle.closest(".observatory-links") || toggle;
    var fixedHeader = document.querySelector(".site-header");
    var headerOffset = fixedHeader ? fixedHeader.getBoundingClientRect().height : 0;
    var top = window.scrollY + container.getBoundingClientRect().top - headerOffset - 12;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }

  function expandPanel(panel) {
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    panel.style.maxHeight = "0px";

    window.requestAnimationFrame(function () {
      panel.style.maxHeight = panel.scrollHeight + "px";
    });

    function onTransitionEnd(event) {
      if (event.propertyName !== "max-height") return;
      if (panel.classList.contains("is-open")) {
        panel.style.maxHeight = "none";
      }
    }

    panel.addEventListener("transitionend", onTransitionEnd, { once: true });
  }

  function collapsePanel(panel) {
    if (panel.hidden) return;

    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");

    if (panel.style.maxHeight === "none" || !panel.style.maxHeight) {
      panel.style.maxHeight = panel.scrollHeight + "px";
    }

    window.requestAnimationFrame(function () {
      panel.style.maxHeight = "0px";
    });

    function onTransitionEnd(event) {
      if (event.propertyName !== "max-height") return;
      if (!panel.classList.contains("is-open")) {
        panel.hidden = true;
        panel.style.maxHeight = "";
      }
    }

    panel.addEventListener("transitionend", onTransitionEnd, { once: true });
  }

  function initObservatoryHub() {
    var toggles = document.querySelectorAll("[data-observatory-inline-toggle]");
    if (!toggles.length) return;

    toggles.forEach(function (toggle) {
      var panelId = toggle.getAttribute("aria-controls");
      if (!panelId) return;
      var panel = document.getElementById(panelId);
      if (!panel) return;

      buildInlineColumns(panel);

      panel.hidden = true;
      panel.style.maxHeight = "";
      panel.setAttribute("aria-hidden", "true");
      setExpanded(toggle, false);

      toggle.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        var isOpen = toggle.getAttribute("aria-expanded") === "true";

        toggles.forEach(function (otherToggle) {
          var otherPanelId = otherToggle.getAttribute("aria-controls");
          if (!otherPanelId) return;
          var otherPanel = document.getElementById(otherPanelId);
          if (!otherPanel) return;
          setExpanded(otherToggle, false);
          collapsePanel(otherPanel);
        });

        if (!isOpen) {
          setExpanded(toggle, true);
          expandPanel(panel);
        }

        window.requestAnimationFrame(function () {
          scrollToSubsection(toggle);
        });
      });
    });
  }

  function initBoletinesLoadMore() {
    var buttons = document.querySelectorAll("[data-observatory-boletines-more]");
    if (!buttons.length) return;

    buttons.forEach(function (button) {
      var listId = button.getAttribute("data-target");
      if (!listId) return;

      var list = document.getElementById(listId);
      if (!list) return;

      var step = parseInt(button.getAttribute("data-step") || "5", 10);
      if (!Number.isFinite(step) || step < 1) step = 5;

      var items = Array.from(list.querySelectorAll(".observatory-boletines-item"));
      var hiddenItems = items.filter(function (item) {
        return item.hidden;
      });

      if (!hiddenItems.length) return;

      button.hidden = false;
      button.addEventListener("click", function () {
        var pending = items.filter(function (item) {
          return item.hidden;
        });

        pending.slice(0, step).forEach(function (item) {
          item.hidden = false;
          item.classList.remove("is-observatory-hidden");
        });

        if (items.every(function (item) { return !item.hidden; })) {
          button.hidden = true;
        }
      });
    });
  }

  function initVisualizacionesTabs() {
    var navs = document.querySelectorAll(".js-obs-viz-links");
    if (!navs.length) return;

    navs.forEach(function (nav) {
      var links = nav.querySelectorAll("[data-obs-viz-target]");
      if (!links.length) return;

      var container = nav.closest(".observatory-inline-panel--visualizaciones") || nav.parentElement;

      function activate(targetId) {
        var panels = container ? container.querySelectorAll("[data-obs-viz-panel]") : [];

        links.forEach(function (link) {
          var item = link.closest(".workshop-links__item");
          if (link.getAttribute("data-obs-viz-target") === targetId) {
            link.setAttribute("aria-current", "page");
            if (item) item.classList.add("is-active");
          } else {
            link.removeAttribute("aria-current");
            if (item) item.classList.remove("is-active");
          }
        });

        panels.forEach(function (panel) {
          if (panel.id === targetId) {
            panel.hidden = false;
            panel.classList.add("is-active");
          } else {
            panel.hidden = true;
            panel.classList.remove("is-active");
          }
        });
      }

      function activateFromHash() {
        var hash = (window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
        if (!hash) return false;
        var matchedLink = null;
        links.forEach(function (link) {
          if (link.getAttribute("data-obs-viz-slug") === hash) matchedLink = link;
        });
        if (!matchedLink) return false;
        var targetId = matchedLink.getAttribute("data-obs-viz-target");
        if (!targetId) return false;
        activate(targetId);
        return true;
      }

      links.forEach(function (link) {
        link.addEventListener("click", function (event) {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          var targetId = link.getAttribute("data-obs-viz-target");
          if (!targetId) return;
          activate(targetId);
          var slug = link.getAttribute("data-obs-viz-slug");
          if (slug) {
            var nextHash = "#" + slug;
            if (window.location.hash !== nextHash) {
              window.history.pushState({ obsVizSlug: slug }, "", nextHash);
            }
          }
        });
      });

      if (!activateFromHash()) {
        var firstTarget = links[0].getAttribute("data-obs-viz-target");
        if (firstTarget) activate(firstTarget);
      }

      window.addEventListener("popstate", function () {
        activateFromHash();
      });
      window.addEventListener("hashchange", function () {
        activateFromHash();
      });
    });
  }

  // ── Slider de años: una pista, dos pulgares ───────────────────────────
  // Los dos <input type=range> siguen existiendo (ocultos) porque son el
  // contrato con conectarSliderDeAnios() en vega-scripts.html: esa función lee
  // .min/.max/.value y escucha "input". Acá solo se dibujan los pulgares
  // encima y se escriben esos inputs, así que el resto de la cadena (Aplicar,
  // el estado "Sin aplicar", el push a las vistas de Vega) no cambia.
  //
  // La versión anterior superponía los dos <input> nativos sobre la misma
  // pista y era imposible agarrar el pulgar que uno quería contra el tope
  // derecho: con 1874-2026 en ~840px un año mide ~5px y los pulgares miden
  // 16px, así que el hit-testing del navegador elegía por z-order. Acá el que
  // elige es elegirPulgar(): por cercanía, y si los dos valores coinciden se
  // difiere hasta ver para qué lado arrastran.
  function initYearRangeSlider() {
    var control = document.querySelector("[data-year-range]");
    if (!control) return;
    var pista = control.querySelector("[data-year-track]");
    var relleno = control.querySelector("[data-year-fill]");
    var desde = control.querySelector("[data-year-from]");
    var hasta = control.querySelector("[data-year-to]");
    var pulgarDesde = control.querySelector('[data-year-thumb="from"]');
    var pulgarHasta = control.querySelector('[data-year-thumb="to"]');
    if (!pista || !desde || !hasta || !pulgarDesde || !pulgarHasta) return;

    // Igual al margen negativo del pulgar en el CSS: la pista reserva ese
    // espacio a los costados para que en los extremos no se salga.
    var RADIO = 9;
    var min = Number(desde.min);
    var max = Number(hasta.max);
    if (!isFinite(min) || !isFinite(max) || max <= min) return;

    function limitar(valor, piso, techo) {
      return Math.min(techo, Math.max(piso, valor));
    }

    function posicionUtil() {
      var ancho = pista.clientWidth - RADIO * 2;
      return ancho > 0 ? ancho : 1;
    }

    function valorDesdeX(clientX) {
      var caja = pista.getBoundingClientRect();
      var proporcion = (clientX - caja.left - RADIO) / posicionUtil();
      return Math.round(min + limitar(proporcion, 0, 1) * (max - min));
    }

    function porcentaje(valor) {
      return ((valor - min) / (max - min)) * posicionUtil() + RADIO;
    }

    // Única salida hacia el resto de la página: se escriben los inputs y se
    // emite "input" para que vega-scripts.html marque el rango como pendiente.
    function escribir(a, b) {
      var cambio = false;
      if (String(a) !== desde.value) { desde.value = String(a); cambio = true; }
      if (String(b) !== hasta.value) { hasta.value = String(b); cambio = true; }
      pintar();
      if (cambio) {
        desde.dispatchEvent(new Event("input", { bubbles: true }));
        hasta.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    function pintar() {
      var a = Number(desde.value);
      var b = Number(hasta.value);
      var izq = porcentaje(a);
      var der = porcentaje(b);
      pulgarDesde.style.left = izq + "px";
      pulgarHasta.style.left = der + "px";
      pulgarDesde.setAttribute("aria-valuenow", String(a));
      pulgarHasta.setAttribute("aria-valuenow", String(b));
      // aria-valuetext para que el lector de pantalla diga el año y no el
      // porcentaje, y para que se entienda cuál extremo es cuál.
      pulgarDesde.setAttribute("aria-valuetext", a + "–" + b);
      pulgarHasta.setAttribute("aria-valuetext", a + "–" + b);
      if (relleno) {
        relleno.style.left = izq + "px";
        relleno.style.width = Math.max(0, der - izq) + "px";
      }
    }

    // Cuál pulgar responde al gesto. Fuera del rango no hay ambigüedad; dentro
    // gana el más cercano; si los dos están en el mismo año se devuelve null y
    // el arrastre lo resuelve con la dirección del primer movimiento.
    function elegirPulgar(valor) {
      var a = Number(desde.value);
      var b = Number(hasta.value);
      if (a === b) return valor === a ? null : (valor < a ? "from" : "to");
      if (valor <= a) return "from";
      if (valor >= b) return "to";
      return valor - a <= b - valor ? "from" : "to";
    }

    function mover(cual, valor) {
      var a = Number(desde.value);
      var b = Number(hasta.value);
      if (cual === "from") escribir(limitar(valor, min, b), b);
      else escribir(a, limitar(valor, a, max));
    }

    var arrastre = null;

    pista.addEventListener("pointerdown", function (evento) {
      var valor = valorDesdeX(evento.clientX);
      arrastre = { cual: elegirPulgar(valor), origen: valor };
      pista.setPointerCapture(evento.pointerId);
      if (arrastre.cual) {
        activar(arrastre.cual);
        mover(arrastre.cual, valor);
      }
      evento.preventDefault();
    });

    pista.addEventListener("pointermove", function (evento) {
      if (!arrastre) return;
      var valor = valorDesdeX(evento.clientX);
      if (!arrastre.cual) {
        // Los dos pulgares estaban en el mismo año: recién ahora se sabe cuál
        // quería mover. Sin esto, contra el tope derecho el rango no se puede
        // volver a abrir.
        if (valor === arrastre.origen) return;
        arrastre.cual = valor < arrastre.origen ? "from" : "to";
        activar(arrastre.cual);
      }
      mover(arrastre.cual, valor);
    });

    function soltar(evento) {
      if (!arrastre) return;
      arrastre = null;
      desactivar();
      if (evento && pista.hasPointerCapture(evento.pointerId)) {
        pista.releasePointerCapture(evento.pointerId);
      }
    }

    pista.addEventListener("pointerup", soltar);
    pista.addEventListener("pointercancel", soltar);

    function activar(cual) {
      var pulgar = cual === "from" ? pulgarDesde : pulgarHasta;
      pulgar.setAttribute("data-year-active", "");
      pulgar.focus({ preventScroll: true });
    }

    function desactivar() {
      pulgarDesde.removeAttribute("data-year-active");
      pulgarHasta.removeAttribute("data-year-active");
    }

    [["from", pulgarDesde], ["to", pulgarHasta]].forEach(function (par) {
      par[1].addEventListener("keydown", function (evento) {
        var actual = Number(par[0] === "from" ? desde.value : hasta.value);
        var paso = null;
        switch (evento.key) {
          case "ArrowLeft": case "ArrowDown": paso = actual - 1; break;
          case "ArrowRight": case "ArrowUp": paso = actual + 1; break;
          case "PageDown": paso = actual - 10; break;
          case "PageUp": paso = actual + 10; break;
          case "Home": paso = min; break;
          case "End": paso = max; break;
          default: return;
        }
        evento.preventDefault();
        mover(par[0], paso);
      });
    });

    // El ancho útil se mide del DOM, así que hay que repintar al cambiar de
    // tamaño; y "Ver todo" escribe los inputs desde vega-scripts.html sin
    // avisar, por eso también se escucha su "input".
    window.addEventListener("resize", pintar);
    desde.addEventListener("input", pintar);
    hasta.addEventListener("input", pintar);
    pintar();
  }

  // ── Tarjetas de totales atadas al slider de años ──────────────────────
  // El control de años lo maneja vega-scripts.html, que avisa del rango con el
  // evento "documentation:years" (el mismo que escuchan las dos tablas). Acá
  // solo se resuelve el número de cada tarjeta sumando su histograma.
  //
  // Las filas sin año se suman siempre, no solo cuando no hay filtro: es lo que
  // hacen el sunburst (`!isValid(datum.anio)`) y la tabla (`Number.isFinite`).
  // Si se descartaran, la tarjeta diría menos de lo que la tabla lista abajo.
  //
  // No se dispara nada al cargar: hasta que no se aprieta Aplicar, las tarjetas
  // muestran el total que pintó Hugo.
  function initYearCountCards() {
    var tarjetas = Array.prototype.slice.call(
      document.querySelectorAll("[data-year-count]")
    );
    if (!tarjetas.length) return;

    var datos = tarjetas.map(function (tarjeta) {
      var porAnio = {};
      try {
        porAnio = JSON.parse(tarjeta.getAttribute("data-counts") || "{}");
      } catch (e) {
        console.warn("Histograma de años ilegible en una tarjeta de totales", e);
      }
      var total = Number(tarjeta.getAttribute("data-total")) || 0;
      var anios = Object.keys(porAnio);
      var conAnio = anios.reduce(function (suma, anio) {
        return suma + porAnio[anio];
      }, 0);
      return {
        salida: tarjeta.querySelector("[data-year-count-out]"),
        anios: anios,
        porAnio: porAnio,
        total: total,
        sinAnio: total - conAnio
      };
    });

    window.addEventListener("documentation:years", function (evento) {
      var detalle = (evento && evento.detail) || {};
      var desde = Number(detalle.yearMin);
      var hasta = Number(detalle.yearMax);
      var todo = !isFinite(desde) || !isFinite(hasta);

      datos.forEach(function (item) {
        if (!item.salida) return;
        if (todo) {
          item.salida.textContent = item.total;
          return;
        }
        var cuenta = item.anios.reduce(function (suma, anio) {
          var n = Number(anio);
          return n >= desde && n <= hasta ? suma + item.porAnio[anio] : suma;
        }, item.sinAnio);
        item.salida.textContent = cuenta;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initObservatoryHub();
    initBoletinesLoadMore();
    initVisualizacionesTabs();
    initYearRangeSlider();
    initYearCountCards();
  });
})();
