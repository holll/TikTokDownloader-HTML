(function () {
  "use strict";

  /* ── State ──────────────────────────────────────────────────── */
  let lbScale = 1, lbX = 0, lbY = 0;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let dragOriginX = 0, dragOriginY = 0;
  let dragMoved = false;
  let lastPinchDist = 0;
  let swipeStartX = 0, swipeStartY = 0;
  let lbGroup = [], lbIndex = 0;

  /* ── Cached DOM references ──────────────────────────────────── */
  let $lightbox, $content, $counter, $prev, $next, $inner;

  function cacheDom() {
    $lightbox = document.getElementById("lightbox");
    $content  = document.getElementById("lightbox-content");
    $counter  = document.getElementById("lb-counter");
    $prev     = document.getElementById("lb-prev");
    $next     = document.getElementById("lb-next");
    $inner    = document.getElementById("lightbox-inner");
  }

  /* ── Transform ───────────────────────────────────────────────── */
  function applyTransform() {
    const img = $content && $content.querySelector("img");
    if (img) {
      img.style.transform =
        "translate(" + lbX + "px," + lbY + "px) scale(" + lbScale + ")";
    }
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function isImageItem() {
    return lbGroup[lbIndex] && lbGroup[lbIndex].type === "image";
  }

  /* ── Show item ───────────────────────────────────────────────── */
  function lbShowImage(idx) {
    const oldVideo = $content && $content.querySelector("video");
    if (oldVideo) {
      oldVideo.pause();
      oldVideo.removeAttribute("src");
      oldVideo.load();
    }

    lbIndex = idx;
    lbScale = 1; lbX = 0; lbY = 0;

    const item = lbGroup[idx];
    if (!item) return;

    if (item.type === "video") {
      $content.innerHTML =
        '<video src="' + item.src + '" controls playsinline ' +
        'webkit-playsinline style="max-width:90vw;max-height:90vh;"></video>';
    } else {
      $content.innerHTML =
        '<img src="' + item.src + '" ' +
        'style="max-width:90vw;max-height:90vh;object-fit:contain;' +
        'transform-origin:center center;user-select:none;pointer-events:none;' +
        'touch-action:none;">';
    }

    $counter.textContent = lbGroup.length > 1
      ? (idx + 1) + " / " + lbGroup.length
      : "";

    $prev.disabled = (idx === 0);
    $next.disabled = (idx === lbGroup.length - 1);

    const navStyle = lbGroup.length > 1 ? "flex" : "none";
    $prev.style.display = navStyle;
    $next.style.display = navStyle;
  }

  /* ── Navigation ──────────────────────────────────────────────── */
  function lbNavigate(dir) {
    const next = lbIndex + dir;
    if (next >= 0 && next < lbGroup.length) lbShowImage(next);
  }

  /* ── Open / Close ────────────────────────────────────────────── */
  window.lbOpen = function (el) {
    if (!el || !el.dataset.group) return;
    try {
      lbGroup = JSON.parse(el.dataset.group);
    } catch (e) {
      return;
    }
    if (!lbGroup.length) return;

    cacheDom();

    $lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
    lbShowImage(parseInt(el.dataset.idx, 10) || 0);
  };

  function closeLightbox() {
    const oldVideo = $content && $content.querySelector("video");
    if (oldVideo) {
      oldVideo.pause();
      oldVideo.removeAttribute("src");
    }
    $lightbox.classList.remove("active");
    $content.innerHTML = "";
    document.body.style.overflow = "";
    lbScale = 1; lbX = 0; lbY = 0;
    lbGroup = []; lbIndex = 0;
  }

  /* ── Event listeners ─────────────────────────────────────────── */

  cacheDom();

  /* Click-outside-to-close */
  $lightbox.addEventListener("click", function (e) {
    if (e.target === this) closeLightbox();
  });

  /* Keyboard */
  document.addEventListener("keydown", function (e) {
    if (!$lightbox.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft")  lbNavigate(-1);
    else if (e.key === "ArrowRight") lbNavigate(1);
  });

  /* Mouse wheel zoom */
  $lightbox.addEventListener("wheel", function (e) {
    if (!isImageItem()) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    lbScale = Math.min(Math.max(lbScale * delta, 0.5), 8);
    applyTransform();
  }, { passive: false });

  /* ── Mouse drag ─────────────────────────────── */
  $inner.addEventListener("mousedown", function (e) {
    if (e.button !== 0 || !isImageItem()) return;
    isDragging = true; dragMoved = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragOriginX = lbX; dragOriginY = lbY;
    this.classList.add("dragging");
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;
    dragMoved = true;
    lbX = dragOriginX + (e.clientX - dragStartX);
    lbY = dragOriginY + (e.clientY - dragStartY);
    applyTransform();
  });

  document.addEventListener("mouseup", function () {
    isDragging = false;
    if ($inner) $inner.classList.remove("dragging");
  });

  /* Click-on-backdrop closes (only when not dragged) */
  $inner.addEventListener("click", function (e) {
    if (e.target === this && !dragMoved) closeLightbox();
  });

  /* ── Touch: drag + pinch + swipe ─────────────── */
  $inner.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      isDragging = false;
    } else if (e.touches.length === 1) {
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
      if (isImageItem()) {
        isDragging = true;
        dragMoved = false;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragOriginX = lbX;
        dragOriginY = lbY;
      }
    }
  }, { passive: false });

  $inner.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastPinchDist > 0) {
        lbScale = Math.min(Math.max(lbScale * (dist / lastPinchDist), 0.5), 8);
        applyTransform();
      }
      lastPinchDist = dist;
    } else if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      dragMoved = true;
      lbX = dragOriginX + (e.touches[0].clientX - dragStartX);
      lbY = dragOriginY + (e.touches[0].clientY - dragStartY);
      applyTransform();
    }
  }, { passive: false });

  $inner.addEventListener("touchend", function (e) {
    if (!dragMoved && swipeStartX !== 0) {
      const touch = e.changedTouches[0];
      if (touch) {
        const dx = touch.clientX - swipeStartX;
        const dy = touch.clientY - swipeStartY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          lbNavigate(dx < 0 ? 1 : -1);
        }
      }
    }
    isDragging = false;
    lastPinchDist = 0;
    swipeStartX = 0;
    swipeStartY = 0;
  });

  // Expose for HTML onclick handlers
  window.closeLightbox = closeLightbox;
  window.lbNavigate = lbNavigate;

})();
