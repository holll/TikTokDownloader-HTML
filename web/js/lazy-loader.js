/* ── Lazy Loader + Video Manager  ────────────────────────────
   使用 IntersectionObserver 实现图片/视频延迟加载，
   以及视频互斥播放 + 离开视口自动暂停。
   用法：initLazyLoad(root?) — root 默认为 document
   ────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── 视频互斥播放：全局追踪当前正在播放的视频 ────────────────
  var _activeVideo = null;

  function pauseActiveVideo() {
    if (_activeVideo && !_activeVideo.paused) {
      _activeVideo.pause();
    }
    _activeVideo = null;
  }

  function setActiveVideo(video) {
    if (_activeVideo === video) return;
    pauseActiveVideo();
    _activeVideo = video;
  }

  // ── 视频可见性 Observer：离开视口自动暂停 ─────────────────
  var _videoObserver = null;

  function ensureVideoObserver() {
    if (_videoObserver) return;
    if (!('IntersectionObserver' in window)) return;

    _videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        // 视频离开视口（不可见）时暂停
        if (!entry.isIntersecting && !video.paused) {
          video.pause();
          if (_activeVideo === video) {
            _activeVideo = null;
          }
        }
      });
    }, {
      threshold: 0.1  // 至少 10% 可见才算在视口中
    });
  }

  function watchVideoVisibility(video) {
    ensureVideoObserver();
    if (_videoObserver) {
      _videoObserver.observe(video);
    }
  }

  function unwatchVideoVisibility(video) {
    if (_videoObserver) {
      _videoObserver.unobserve(video);
    }
  }

  // ── 给所有 video 绑定互斥播放事件 ──────────────────────────
  function bindVideoExclusive(video) {
    if (video._exclusiveBound) return;
    video._exclusiveBound = true;

    video.addEventListener('play', function () {
      setActiveVideo(video);
    });

    video.addEventListener('pause', function () {
      if (_activeVideo === video) {
        _activeVideo = null;
      }
    });

    video.addEventListener('ended', function () {
      if (_activeVideo === video) {
        _activeVideo = null;
      }
    });

    // 监听视频离开视口
    watchVideoVisibility(video);
  }

  // ── 懒加载核心 ─────────────────────────────────────────────
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
      el.load();
      // 绑定互斥播放 + 可见性检测
      bindVideoExclusive(el);
    }
  }

  // ── 统一初始化入口 ─────────────────────────────────────────
  function initLazyLoad(root) {
    var container = root || document;

    // 先处理已经存在的 video（无 data-src，直接绑定事件）
    var existingVideos = container.querySelectorAll('video:not([data-src])');
    for (var v = 0; v < existingVideos.length; v++) {
      bindVideoExclusive(existingVideos[v]);
    }

    var elements = container.querySelectorAll('[data-src]');
    if (!elements.length) return;

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

      for (var i = 0; i < elements.length; i++) {
        observer.observe(elements[i]);
      }

      if (!window.__lazyObserver) {
        window.__lazyObserver = observer;
      }
    } else {
      for (var j = 0; j < elements.length; j++) {
        loadElement(elements[j]);
      }
    }
  }

  // 观察新添加的 DOM 元素（配合动态加载内容）
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