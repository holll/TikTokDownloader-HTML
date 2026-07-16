// ── API helpers ────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ── HTML escape helper ────────────────────────────────────────
function escapeHTML(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Hashtag highlighting ─────────────────────────────────────
function highlightHashtags(text) {
  if (!text) return '<span style="color:#bbb">(no description)</span>';
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  out = out.replace(
    /(#[\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+)/g,
    '<span class="hashtag">$1</span>'
  );
  return out;
}

// ── Media grid ────────────────────────────────────────────────
function mediaGridClass(count) {
  if (count === 1) return 'cols-1';
  if (count === 2) return 'cols-2';
  if (count === 3) return 'cols-3';
  return 'cols-4';
}

function renderMediaGrid(media) {
  if (!media.length) return '';

  var lbItems = media.map(function (m) {
    var src = m.url || '';
    return { type: m.type, src: src };
  });
  var lbJSON = JSON.stringify(lbItems);

  var items = '';
  media.forEach(function (m, i) {
    var src = m.url || '';
    var escSrc = src.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var escJSON = lbJSON.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    if (m.type === 'video') {
      items += '<div class="media-item"><video data-src="' + escSrc + '" controls playsinline webkit-playsinline preload="metadata"></video></div>';
    } else {
      items += '<div class="media-item" data-group="' + escJSON + '" data-idx="' + i + '" onclick="lbOpen(this); event.stopPropagation();"><img data-src="' + escSrc + '" loading="lazy" alt=""></div>';
    }
  });

  return '<div class="media-grid ' + mediaGridClass(media.length) + '">' + items + '</div>';
}

// ── Post card (user page) ─────────────────────────────────────
function renderPostCard(post) {
  var time = escapeHTML(post.create_time_display || post.create_time || '');
  var typeLabel = escapeHTML(post.media_type_cn || '');
  var descHTML = highlightHashtags(post.desc);
  var gridHTML = renderMediaGrid(post.media);

  return '<div class="post-card">' +
    '<div class="post-header">' +
      '<span class="post-time">' + time + '</span>' +
      '<span class="post-type">' + typeLabel + '</span>' +
    '</div>' +
    '<div class="post-desc">' + descHTML + '</div>' +
    gridHTML +
  '</div>';
}

// ── Post card (feed page) — with user badge ──────────────────
function renderFeedPostCard(post) {
  var time = escapeHTML(post.create_time_display || post.create_time || '');
  var typeLabel = escapeHTML(post.media_type_cn || '');
  var nickname = escapeHTML(post.nickname || post.uid || '');
  var uid = post.uid || '';
  var descHTML = highlightHashtags(post.desc);
  var gridHTML = renderMediaGrid(post.media);

  return '<div class="post-card">' +
    '<div class="post-header">' +
      '<a class="post-user" href="/user/' + encodeURIComponent(uid) + '">@' + nickname + '</a>' +
      '<div class="post-meta-row">' +
        '<span class="post-time">' + time + '</span>' +
        '<span class="post-type">' + typeLabel + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="post-desc">' + descHTML + '</div>' +
    gridHTML +
  '</div>';
}

// ═══════════════════════════════════════════════════════════════
// Index page
// ═══════════════════════════════════════════════════════════════

async function loadUsers() {
  var grid = document.getElementById('user-grid');
  var meta = document.getElementById('index-meta');
  try {
    var users = await fetchJSON('/api/users');
    meta.textContent = '共 ' + users.length + ' 位用户';
    if (!users.length) {
      grid.innerHTML = '<div class="empty-state"><h2>暂无存档</h2><p>未找到任何用户</p></div>';
      return;
    }
    renderUserCards(users);
    // 索引页头像懒加载
    initLazyLoad();
  } catch (err) {
    grid.innerHTML = '<div class="empty-state"><h2>加载失败</h2><p>' + err.message + '</p></div>';
  }
}

function renderUserCards(users) {
  var grid = document.getElementById('user-grid');
  grid.innerHTML = users.map(function (u) {
    var thumbHTML = u.first_thumb
      ? '<img data-src="' + u.first_thumb.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" loading="lazy" alt="">'
      : escapeHTML((u.nickname || '?')[0]);
    return '<a class="user-card" href="/user/' + encodeURIComponent(u.uid) + '">' +
      '<div class="avatar">' + thumbHTML + '</div>' +
      '<div class="nickname">' + escapeHTML(u.nickname) + '</div>' +
      '<div class="meta">' +
        '<div class="meta-uid">UID: ' + escapeHTML(u.uid) + '</div>' +
        '<div class="meta-count">' + u.post_count + ' 条作品</div>' +
      '</div>' +
    '</a>';
  }).join('');
  // Store for search filtering
  window._allUsers = users;
}

function filterUsers() {
  if (!window._allUsers) return;
  var f = document.getElementById('search-input').value.toLowerCase();
  renderUserCards(window._allUsers.filter(function (u) {
    return u.nickname.toLowerCase().indexOf(f) !== -1 ||
           u.uid.indexOf(f) !== -1;
  }));
  // 搜索重新渲染后重新启动懒加载
  initLazyLoad();
}

// ═══════════════════════════════════════════════════════════════
// User page (waterfall)
// ═══════════════════════════════════════════════════════════════

var waterfall = {
  uid: '',
  offset: 0,
  limit: 20,
  hasMore: true,
  loading: false,
  total: 0,
  orderAsc: false
};

var orderParam = function() {
  return waterfall.orderAsc ? '&order=asc' : '';
};

function toggleOrder() {
  waterfall.orderAsc = !waterfall.orderAsc;
  var btn = document.getElementById('order-trigger');
  if (btn) {
    btn.textContent = waterfall.orderAsc ? '\u23EB' : '\u23EC';
    btn.title = waterfall.orderAsc ? '最新在前' : '最早在前';
  }
  // Reload from scratch
  loadUserPosts();
}

async function loadUserPosts() {
  // Parse UID from URL: /user/{uid}
  var uid = window.location.pathname.split('/user/')[1] || '';
  if (!uid) {
    document.getElementById('posts-container').innerHTML =
      '<div class="empty-state"><h2>未指定用户</h2></div>';
    return;
  }

  waterfall.uid = uid;
  waterfall.offset = 0;

  try {
    var data = await fetchJSON('/api/users/' + uid + '?offset=0&limit=' + waterfall.limit + orderParam());
    waterfall.hasMore = data.has_more;
    waterfall.total = data.total;

    // Update header
    document.title = data.nickname + ' - 抖音作品存档';
    document.getElementById('user-nickname').textContent = '@' + data.nickname;
    document.getElementById('user-uid').textContent = 'UID: ' + data.uid;
    document.getElementById('user-stats').textContent = '共 ' + data.total + ' 条作品';

    var container = document.getElementById('posts-container');
    if (!data.posts.length) {
      container.innerHTML = '<div class="empty-state"><h2>暂无作品</h2><p>该用户目录下未找到媒体文件</p></div>';
      document.getElementById('sentinel').remove();
      return;
    }

    container.innerHTML = data.posts.map(renderPostCard).join('');
    waterfall.offset = data.posts.length;

    // 初始化懒加载，监控新渲染的 data-src 元素
    initLazyLoad();

    setupWaterfall();

    // 异步加载日期索引，不阻塞瀑布流
    loadDateIndex(uid);
  } catch (err) {

    document.getElementById('posts-container').innerHTML =
      '<div class="empty-state"><h2>加载失败</h2><p>' + err.message + '</p></div>';
  }
}

function setupWaterfall() {
  var sentinel = document.getElementById('sentinel');
  if (!sentinel) return;

  var observer = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting || !waterfall.hasMore || waterfall.loading) return;

    waterfall.loading = true;
    fetchJSON('/api/users/' + waterfall.uid + '?offset=' + waterfall.offset + '&limit=' + waterfall.limit + orderParam())
      .then(function (data) {
        waterfall.hasMore = data.has_more;

        var container = document.getElementById('posts-container');
        container.insertAdjacentHTML('beforeend',
          data.posts.map(renderPostCard).join(''));
        waterfall.offset += data.posts.length;

        // 对瀑布流新加载的内容启用懒加载
        observeLazy(container);

        if (!waterfall.hasMore) {
          sentinel.remove();
        }
      })
      .catch(function (err) {
        console.error('Waterfall load error:', err);
      })
      .finally(function () {
        waterfall.loading = false;
      });
  });

  sentinel._observer = observer;
  observer.observe(sentinel);
}

// ── Date index & navigation ─────────────────────────────────────

var dateIndexItems = [];
var datePanelOpen = false;

async function loadDateIndex(uid) {
  try {
    var items = await fetchJSON('/api/users/' + uid + '/date-index' + (waterfall.orderAsc ? '?order=asc' : ''));
    if (!items || !items.length) return;
    dateIndexItems = items;

    // Show trigger button
    var trigger = document.getElementById('date-trigger');
    if (trigger) trigger.style.display = '';

    // Populate the panel
    renderDatePanel(groupByMonth(items));
  } catch (err) {
    console.warn('Date index load failed:', err);
  }
}

function groupByMonth(items) {
  var groups = {};
  items.forEach(function (item) {
    var month = item.date.substring(0, 7);
    if (!groups[month]) groups[month] = [];
    groups[month].push(item);
  });
  var keys = Object.keys(groups).sort().reverse();
  return keys.map(function (k) {
    return { month: k, items: groups[k] };
  });
}

function renderDatePanel(monthGroups) {
  var panel = document.getElementById('date-panel');
  if (!panel) return;
  if (!monthGroups.length) return;

  var html = '';
  monthGroups.forEach(function (g) {
    var firstDate = g.items[0];
    var display = g.month.replace('-', '/');
    var total = g.items.reduce(function (s, it) { return s + it.count; }, 0);
    html += '<div class="dp-month" data-offset="' + firstDate.offset +
      '" title="' + display + ' · ' + total + '条">' +
      display + '<span class="dp-count">' + total + '</span></div>';
  });
  panel.innerHTML = html;

  // Click handler
  panel.querySelectorAll('.dp-month').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var offset = parseInt(this.getAttribute('data-offset'), 10) || 0;
      resetAndLoad(offset);
      closePanel();
    });
  });
}

function toggleDatePanel() {
  var panel = document.getElementById('date-panel');
  var backdrop = document.getElementById('date-backdrop');
  var trigger = document.getElementById('date-trigger');
  if (!panel) return;

  datePanelOpen = !datePanelOpen;
  if (datePanelOpen) {
    panel.classList.add('active');
    backdrop.classList.add('active');
    trigger.classList.add('active');
  } else {
    panel.classList.remove('active');
    backdrop.classList.remove('active');
    trigger.classList.remove('active');
  }
}

function closePanel() {
  if (!datePanelOpen) return;
  datePanelOpen = false;
  var panel = document.getElementById('date-panel');
  var backdrop = document.getElementById('date-backdrop');
  var trigger = document.getElementById('date-trigger');
  if (panel) panel.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  if (trigger) trigger.classList.remove('active');
}

function resetAndLoad(offset) {
  var oldSentinel = document.getElementById('sentinel');
  if (oldSentinel && oldSentinel._observer) {
    oldSentinel._observer.disconnect();
    oldSentinel._observer = null;
  }

  waterfall.offset = offset;
  waterfall.hasMore = true;
  waterfall.loading = false;

  var container = document.getElementById('posts-container');
  container.innerHTML = '';

  var sentinel = document.getElementById('sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'sentinel';
    sentinel.style.height = '1px';
    container.parentNode.insertBefore(sentinel, container.nextSibling);
  }

  fetchJSON('/api/users/' + waterfall.uid + '?offset=' + offset + '&limit=' + waterfall.limit + orderParam())
    .then(function (data) {
      waterfall.hasMore = data.has_more;
      container.innerHTML = data.posts.map(renderPostCard).join('');
      waterfall.offset = offset + data.posts.length;
      initLazyLoad();
      setupWaterfall();
    })
    .catch(function (err) {
      container.innerHTML = '<div class="empty-state"><h2>加载失败</h2><p>' + err.message + '</p></div>';
    });
}

// ═══════════════════════════════════════════════════════════════
// Feed pages (random / timeline) — shared waterfall logic
// ═══════════════════════════════════════════════════════════════

var feed = {
  apiPath: '',
  offset: 0,
  limit: 20,
  hasMore: true,
  loading: false,
  total: 0
};

// Generic feed initial loader
async function loadFeed(apiPath, extraQuery) {
  feed.apiPath = apiPath;
  feed.offset = 0;

  var qs = '?limit=' + feed.limit + (extraQuery || '');
  if (apiPath === '/api/timeline') qs += '&offset=0';

  try {
    var data = await fetchJSON(apiPath + qs);
    feed.hasMore = data.has_more;
    feed.total = data.total;
    feed.offset = data.posts.length;

    // Update stats
    var statsEl = document.getElementById('feed-stats');
    if (statsEl) {
      statsEl.textContent = '共 ' + data.total + ' 条作品';
    }

    var container = document.getElementById('posts-container');
    if (!data.posts.length) {
      container.innerHTML = '<div class="empty-state"><h2>暂无作品</h2><p>未找到任何媒体文件</p></div>';
      document.getElementById('sentinel').remove();
      return;
    }

    container.innerHTML = data.posts.map(renderFeedPostCard).join('');
    initLazyLoad();
    setupFeedWaterfall();
  } catch (err) {
    document.getElementById('posts-container').innerHTML =
      '<div class="empty-state"><h2>加载失败</h2><p>' + err.message + '</p></div>';
  }
}

function loadRandomPosts() {
  loadFeed('/api/random');
}

function loadTimelinePosts() {
  loadFeed('/api/timeline');
}

function setupFeedWaterfall() {
  var sentinel = document.getElementById('sentinel');
  if (!sentinel) return;

  var observer = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting || !feed.hasMore || feed.loading) return;

    feed.loading = true;

    var qs;
    if (feed.apiPath === '/api/random') {
      // Random: no offset, each batch is a fresh random set
      qs = '?limit=' + feed.limit;
    } else {
      // Timeline: standard offset pagination
      qs = '?offset=' + feed.offset + '&limit=' + feed.limit;
    }

    fetchJSON(feed.apiPath + qs)
      .then(function (data) {
        feed.hasMore = data.has_more;

        var container = document.getElementById('posts-container');
        container.insertAdjacentHTML('beforeend',
          data.posts.map(renderFeedPostCard).join(''));
        feed.offset += data.posts.length;

        observeLazy(container);

        if (!feed.hasMore) {
          sentinel.remove();
        }
      })
      .catch(function (err) {
        console.error('Feed load error:', err);
      })
      .finally(function () {
        feed.loading = false;
      });
  });

  observer.observe(sentinel);
}
