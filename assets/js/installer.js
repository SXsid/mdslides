// Installer Slideshow & Step-through Manager
// Provides interactive tabs, Next/Previous controls, and a gentle slow auto-advance.

export function initInstaller() {
  const container = document.querySelector(".install-slideshow");
  if (!container) return;

  const slides = container.querySelectorAll(".install-slide");
  const tabs = container.querySelectorAll(".install-tab-btn");
  const prevBtn = container.getElementById ? container.getElementById("install-prev-btn") : document.getElementById("install-prev-btn");
  const nextBtn = container.getElementById ? container.getElementById("install-next-btn") : document.getElementById("install-next-btn");
  const counter = document.getElementById("install-counter");
  const progressBar = document.getElementById("install-timer-bar");

  let current = 0;
  let timer = null;
  const AUTO_PLAY_INTERVAL = 8000; // 8 seconds: slow, comfortable reading time

  function render(animate = true) {
    slides.forEach((slide, idx) => {
      slide.classList.toggle("active", idx === current);
    });

    tabs.forEach((tab, idx) => {
      tab.classList.toggle("active", idx === current);
      tab.setAttribute("aria-selected", idx === current ? "true" : "false");
    });

    if (counter) {
      counter.textContent = `${current + 1} of ${slides.length}`;
    }

    resetTimerBar();
  }

  function resetTimerBar() {
    if (!progressBar) return;
    progressBar.style.transition = "none";
    progressBar.style.width = "0%";
    // Trigger reflow to restart CSS animation smoothly
    void progressBar.offsetWidth;
    progressBar.style.transition = `width ${AUTO_PLAY_INTERVAL}ms linear`;
    progressBar.style.width = "100%";
  }

  function goToSlide(index) {
    current = (index + slides.length) % slides.length;
    render();
  }

  function nextSlide() {
    goToSlide(current + 1);
  }

  function prevSlide() {
    goToSlide(current - 1);
  }

  // Auto-advance loop
  function startAutoPlay() {
    stopAutoPlay();
    resetTimerBar();
    timer = setInterval(() => {
      nextSlide();
    }, AUTO_PLAY_INTERVAL);
  }

  function stopAutoPlay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (progressBar) {
      progressBar.style.transition = "none";
      progressBar.style.width = "0%";
    }
  }

  // Tab click handlers
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetIndex = parseInt(tab.getAttribute("data-tab-index"), 10);
      if (!isNaN(targetIndex)) {
        goToSlide(targetIndex);
        startAutoPlay(); // Restart timer on manual interaction
      }
    });
  });

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      nextSlide();
      startAutoPlay();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      prevSlide();
      startAutoPlay();
    });
  }

  // Pause slideshow on mouse hover or focus so users can read or copy peacefully
  container.addEventListener("mouseenter", stopAutoPlay);
  container.addEventListener("mouseleave", startAutoPlay);
  container.addEventListener("focusin", stopAutoPlay);
  container.addEventListener("focusout", startAutoPlay);

  // Initial render and start
  render(false);
  startAutoPlay();
}
