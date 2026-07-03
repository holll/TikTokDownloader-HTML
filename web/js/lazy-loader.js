/* ── Lazy Loader  ────────────────────────────────────────────
   使用 IntersectionObserver 实现图片/视频延迟加载。
   在可视区域（提前 200px 预加载）内才设置 data-src → src。
   用法：initLazyLoad(root?) — root 默认为 document
   ────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function initLazyLoad(root) {
    var container = root || document;
    var elements = container.querySelectorAll('[data-src]');
    if (!elements.length) return;

    function loadElement(el) {
      var src = el.getAttribute('data-src');
      if (!src) return;
      el.setAttribute('src', src);
      el.removeAttribute('data-src');

      // 对 video：主动调用 load() 触发资源加载，显示第一帧预览
      if (el.tagName === 'VIDEO') {
        if (el.dataset.poster) {
          el.setAttribute('poster', el.dataset.poster);
        }
        el.load();  // 触发浏览器开始加载视频数据
      }
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            loadElement(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '200px 0px'  // 进入视口前 200px 就开始加载
      });

      // 对已存在的元素统一观察
      for (var i = 0; i < elements.length; i++) {
        observer.observe(elements[i]);
      }

      // 保存 observer 引用，供后续动态添加的元素使用
      if (!window.__lazyObserver) {
        window.__lazyObserver = observer;
      }
    } else {
      // Fallback: 不支持 IntersectionObserver 时直接加载所有
      for (var j = 0; j < elements.length; j++) {
        loadElement(elements[j]);
      }
    }
  }

  // 观察新添加的 DOM 元素（配合 mutation observer 或手动调用）
  function observeNewElements(container) {
    if (!window.__lazyObserver) return;
    var els = (container || document).querySelectorAll('[data-src]');
    for (var i = 0; i < els.length; i++) {
      window.__lazyObserver.observe(els[i]);
    }
  }

  window.initLazyLoad  = initLazyLoad;
  window.observeLazy   = observeNewElements;
})();
