(function (window) {
  function initSimulator() {
    const screens = document.querySelectorAll(".sim-screen");
    if (screens.length === 0) return;

    const prevBtn = document.getElementById("sim-prev-btn");
    const nextBtn = document.getElementById("sim-next-btn");
    const counter = document.getElementById("sim-counter");
    const progressBar = document.getElementById("sim-progress-bar");
    const simulatorCard = document.querySelector(".deck-frame");

    let current = 0;
    let autoTimer = null;
    const AUTO_INTERVAL = 7000; // 7 seconds

    function render() {
      screens.forEach((screen, index) => {
        screen.classList.toggle("active", index === current);
      });

      if (counter) {
        counter.textContent = `${current + 1} / ${screens.length}`;
      }

      if (progressBar) {
        const percent = screens.length > 1 ? ((current + 1) / screens.length) * 100 : 100;
        progressBar.style.width = `${percent}%`;
      }
    }

    function showNext() {
      current = (current + 1) % screens.length;
      render();
    }

    function showPrev() {
      current = (current - 1 + screens.length) % screens.length;
      render();
    }

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(showNext, AUTO_INTERVAL);
    }

    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        showNext();
        startAuto();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        showPrev();
        startAuto();
      });
    }

    // Keyboard navigation & pause on hover
    if (simulatorCard) {
      simulatorCard.tabIndex = 0;
      simulatorCard.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          showNext();
          startAuto();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          showPrev();
          startAuto();
        }
      });

      simulatorCard.addEventListener("mouseenter", stopAuto);
      simulatorCard.addEventListener("mouseleave", startAuto);
      simulatorCard.addEventListener("focusin", stopAuto);
      simulatorCard.addEventListener("focusout", startAuto);
    }

    render();
    startAuto();
  }

  window.initSimulator = initSimulator;
})(window);
