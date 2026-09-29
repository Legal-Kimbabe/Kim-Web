/* Elevator state controller. It reuses the existing photographic door layers. */
(function () {
  const root = document.getElementById('about-elevator-prototype');
  const about = document.getElementById('about');
  if (!root || !about) return;

  const OPEN_DELAY = 400;
  const DOOR_DURATION = 1020;
  const buttons = [...root.querySelectorAll('.ae-button')];
  const stage = root.querySelector('.ae-stage');
  const rfSceneHit = root.querySelector('.ae-rf-scene-hit');
  let state = 'closed';
  let selectedFloor = null;
  let transitionTimer = null;

  about.classList.add('about-elevator-on');
  root.dataset.ready = 'true';

  function clearTransitionTimer() {
    window.clearTimeout(transitionTimer);
    transitionTimer = null;
  }

  function setSelectedFloor(floor) {
    selectedFloor = floor;
    buttons.forEach((button) => {
      const selected = button.dataset.floor === floor;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    stage.classList.toggle('is-rf-reveal', floor === 'RF');
  }

  function setRfClickable(enabled) {
    stage.classList.toggle('is-rf-clickable', enabled);
    rfSceneHit.disabled = !enabled;
  }

  function finishOpening() {
    state = 'open';
    root.dataset.doorState = state;
    setRfClickable(selectedFloor === 'RF');
  }

  function openTo(floor) {
    state = 'opening';
    root.dataset.doorState = state;
    setRfClickable(false);
    setSelectedFloor(floor);
    clearTransitionTimer();
    transitionTimer = window.setTimeout(() => {
      stage.classList.add('is-doors-open');
      transitionTimer = window.setTimeout(finishOpening, DOOR_DURATION);
    }, OPEN_DELAY);
  }

  function closeDoors(nextFloor) {
    state = 'closing';
    root.dataset.doorState = state;
    setRfClickable(false);
    clearTransitionTimer();
    stage.classList.remove('is-doors-open');
    transitionTimer = window.setTimeout(() => {
      state = 'closed';
      root.dataset.doorState = state;
      if (nextFloor) openTo(nextFloor);
    }, DOOR_DURATION);
  }

  function requestFloor(floor) {
    if (state === 'opening' || state === 'closing') return;
    if (state === 'closed') {
      openTo(floor);
      return;
    }
    if (floor === selectedFloor) {
      closeDoors(null);
      return;
    }
    closeDoors(floor);
  }

  function resetDoorTest() {
    clearTransitionTimer();
    state = 'closed';
    selectedFloor = null;
    root.dataset.doorState = state;
    stage.classList.remove('is-doors-open', 'is-rf-reveal');
    setRfClickable(false);
    buttons.forEach((button) => {
      button.classList.remove('is-selected', 'is-pressed');
      button.setAttribute('aria-pressed', 'false');
    });
  }

  buttons.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('pointerdown', () => button.classList.add('is-pressed'));
    button.addEventListener('pointerup', () => button.classList.remove('is-pressed'));
    button.addEventListener('pointercancel', () => button.classList.remove('is-pressed'));
    button.addEventListener('pointerleave', () => button.classList.remove('is-pressed'));
    button.addEventListener('click', () => requestFloor(button.dataset.floor));
  });

  window.__resetElevatorDoorTest = resetDoorTest;
  window.__getElevatorDoorState = () => state;
  window.addEventListener('keydown', (event) => {
    if (event.shiftKey && event.key.toLowerCase() === 'r') resetDoorTest();
  });
}());
