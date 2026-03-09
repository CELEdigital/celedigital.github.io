(function () {
  function scrollToSlide(track, index) {
    var slides = track.querySelectorAll(".workshop-gallery__slide");
    if (!slides.length) return;
    var clamped = Math.max(0, Math.min(index, slides.length - 1));
    slides[clamped].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  function getCurrentIndex(track) {
    var slides = Array.from(track.querySelectorAll(".workshop-gallery__slide"));
    if (!slides.length) return 0;
    var viewportLeft = track.getBoundingClientRect().left;
    var best = 0;
    var bestDistance = Infinity;
    slides.forEach(function (slide, idx) {
      var distance = Math.abs(slide.getBoundingClientRect().left - viewportLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = idx;
      }
    });
    return best;
  }

  function initGallery(gallery) {
    var track = gallery.querySelector("[data-gallery-track]");
    if (!track) return;
    var prev = gallery.querySelector("[data-gallery-prev]");
    var next = gallery.querySelector("[data-gallery-next]");
    if (!prev || !next) return;

    prev.addEventListener("click", function () {
      scrollToSlide(track, getCurrentIndex(track) - 1);
    });

    next.addEventListener("click", function () {
      scrollToSlide(track, getCurrentIndex(track) + 1);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var galleries = document.querySelectorAll(".js-workshop-gallery");
    galleries.forEach(initGallery);
  });
})();
