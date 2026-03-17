(function () {
  var track = document.getElementById('reading-track');
  if (!track) return;

  var prevBtn = document.getElementById('reading-prev');
  var nextBtn = document.getElementById('reading-next');
  var cards = Array.from(track.querySelectorAll('.reading-card'));
  if (!cards.length) return;

  function cardWidth() {
    return cards[0].offsetWidth + parseInt(getComputedStyle(track).gap || '0', 10);
  }

  function updateButtons() {
    if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
    if (nextBtn) nextBtn.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      track.scrollBy({ left: -cardWidth(), behavior: 'smooth' });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      track.scrollBy({ left: cardWidth(), behavior: 'smooth' });
    });
  }

  track.addEventListener('scroll', updateButtons, { passive: true });
  updateButtons();
})();
