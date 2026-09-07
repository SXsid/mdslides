// Installer Slideshow & Step-through Manager
// Provides interactive tabs, Next/Previous controls, and a gentle slow auto-advance.

(function (window) {
  function initInstaller() {
    const wrapper = document.querySelector(".install-slideshow-wrapper");
    if (!wrapper) return;

    const slides = wrapper.querySelectorAll(".install-slide");
    const tabs = wrapper.querySelectorAll(".install-tab-btn");
    const progressBar = document.getElementById("install-timer-bar");

    if (slides.length === 0) return;

    let current = 0;
    let timer = null;
    const AUTO_PLAY_INTERVAL = 8000; // 8 seconds per slide

    function render() {
      // Toggle active slide
      slides.forEach((slide, idx) => {
        slide.classList.toggle("active", idx === current);
      });

      // Toggle active tab
      tabs.forEach((tab, idx) => {
        const isActive = idx === current;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      // Update counters across all slides
      wrapper.querySelectorAll(".install-step-counter").forEach((counter) => {
        counter.textContent = `${current + 1} of ${slides.length}`;
      });

      resetTimerBar();
    }

    function resetTimerBar() {
      if (!progressBar) return;
      progressBar.style.transition = "none";
      progressBar.style.width = "0%";
      void progressBar.offsetWidth; // Force reflow
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

    function startAutoPlay() {
      stopAutoPlay();
      resetTimerBar();
      timer = setInterval(nextSlide, AUTO_PLAY_INTERVAL);
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

    // Delegated click handler on wrapper for all tabs and nav buttons
    wrapper.addEventListener("click", (e) => {
      // Tab click
      const tab = e.target.closest(".install-tab-btn");
      if (tab) {
        const targetIndex = parseInt(tab.getAttribute("data-tab-index"), 10);
        if (!isNaN(targetIndex)) {
          goToSlide(targetIndex);
          startAutoPlay();
        }
        return;
      }

      // Previous button click
      const prev = e.target.closest(".install-nav-prev, [data-install-nav='prev']");
      if (prev) {
        prevSlide();
        startAutoPlay();
        return;
      }

      // Next button click
      const next = e.target.closest(".install-nav-next, [data-install-nav='next']");
      if (next) {
        nextSlide();
        startAutoPlay();
        return;
      }
    });

    // Keyboard navigation when focused inside the install card
    const card = wrapper.querySelector(".install-carousel-card");
    if (card) {
      card.tabIndex = 0;
      card.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nextSlide();
          startAutoPlay();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          prevSlide();
          startAutoPlay();
        }
      });
    }

    // Pause slideshow on mouse hover or focus so users can read or copy peacefully
    wrapper.addEventListener("mouseenter", stopAutoPlay);
    wrapper.addEventListener("mouseleave", startAutoPlay);
    wrapper.addEventListener("focusin", stopAutoPlay);
    wrapper.addEventListener("focusout", startAutoPlay);

    // Initial render and start
    render();
    startAutoPlay();
  }

  window.initInstaller = initInstaller;
})(window);
