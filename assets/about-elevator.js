/* About elevator prototype — state / navigation handoff baseline.
   This intentionally stops at camera centering; destination scenes, doors,
   hotspots and content wiring remain disconnected pending visual approval. */
(function () {
  const root = document.getElementById('about-elevator-prototype');
  if (!root) return;

  const about = document.getElementById('about');
  const stage = root.querySelector('.ae-stage');
  const buttons = [...root.querySelectorAll('.ae-button')];
  let isMoving = false;

  about?.classList.add('about-elevator-on');
  root.dataset.ready = 'true';

  function selectFloor(floor, button) {
    if (isMoving) return;
    isMoving = true;
    button.classList.add('is-pressed');

    window.setTimeout(() => {
      button.classList.remove('is-pressed');
      buttons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      stage.classList.add('is-centering');
      stage.dataset.selectedFloor = floor;
    }, 130);

    window.setTimeout(() => {
      isMoving = false;
    }, 760);
  }

  buttons.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectFloor(button.dataset.floor, button));
  });
}());
