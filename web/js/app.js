// ── API helpers ────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
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
  var time = post.create_time_display || post.create_time || '';
  var typeLabel = post.media_type_cn || '';
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
  var time = post.create_time_display || post.create_time || '';
  var typeLabel = post.media_type_cn || '';
  var nickname = post.nickname || post.uid || '';
  var uid = post.uid || '';
  var descHTML = highlightHashtags(post.desc);
  var gridHTML = renderMediaGrid(post.media);

  return '<div class="post-card">' +
    '<div class="post-header">' +
      '<a class="post-user" href="/user/' + uid + '">@' + nickname + '</a>' +
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
      : (u.nickname || '?')[0];
    return '<a class="user-card" href="/user/' + u.uid + '">' +
      '<div class="avatar">' + thumbHTML + '</div>' +
      '<div class="nickname">' + u.nickname + '</div>' +
      '<div class="meta">UID: ' + u.uid + ' · ' + u.post_count + ' 条作品</div>' +
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
  total: 0
};

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
    var data = await fetchJSON('/api/users/' + uid + '?offset=0&limit=' + waterfall.limit);
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
    fetchJSON('/api/users/' + waterfall.uid + '?offset=' + waterfall.offset + '&limit=' + waterfall.limit)
      .then(function (data) {
        waterfall.hasMore = data.has_more;

        var container = document.getElementById('posts-container');
        container.insertAdjacentHTML('beforeend',
          data.posts.map(renderPostCard).join(''));
        waterfall.offset += data.posts.length;

        // 对瀑布流新加载的内容启用懒加载
        initLazyLoad(container);

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

  observer.observe(sentinel);
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

        initLazyLoad(container);

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
