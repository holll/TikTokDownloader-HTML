# TikTokDownloader · 项目架构文档

> 生成日期：2026-07-03 · 版本：基于当前 HEAD

## 一、项目概述

TikTokDownloader（抖音下载器）是一个**本地抖音作品资源归档管理工具**。它扫描硬盘上按用户分组的已下载媒体文件目录，解析文件名中的元数据（时间、类型、描述等），将其索引到 SQLite 数据库，然后通过内嵌的 Web 服务器提供浏览、搜索、瀑布流展示等功能。

### 核心价值

- 将散落在磁盘上的抖音下载文件变成**可浏览、可搜索、可滑动**的 Web 档案馆
- 纯本地运行，无需任何外部 API 或云服务
- 静态网页 + JS 前端，零前端依赖（无 npm/webpack/CDN）
- 单文件可执行程序，分发简单

## 二、技术栈

| 层 | 技术 |
|----|------|
| 后端语言 | Go 1.25 |
| HTTP 框架 | Gin (github.com/gin-gonic/gin v1.10) |
| 数据库 | SQLite（modernc.org/sqlite — 纯 Go 实现，无需 CGO） |
| 前端 | 纯 HTML + CSS + 原生 JS（ES6），零框架 |
| 资源嵌入 | `//go:embed`（编译时嵌入 web/ 目录） |
| 懒加载 | IntersectionObserver + data-src 延迟属性 |

## 三、目录结构

```
TikTokDownloader/
├── main.go                       # 入口：配置、路由、启动
├── go.mod / go.sum               # Go 模块依赖
├── build.bat                     # Windows 编译脚本
├── data.db                       # SQLite 数据库（运行时生成）
├── tikdownloader.exe             # 编译产物
│
├── internal/
│   ├── models/
│   │   └── models.go             # 数据结构定义
│   │       MediaFile             — 解析后的单个媒体文件
│   │       Media                 — 作品内的一条媒体（图/视频）
│   │       Post                  — 一条作品（含多条 Media）
│   │       UserSummary           — 用户摘要（索引页）
│   │       UserDetail            — 用户详情（作品页 API 响应）
│   │       FeedResponse          — Feed 流（随机/时间线）响应
│   │       DateIndexItem         — 日期索引条目（待开发）
│   │
│   ├── parser/
│   │   └── parser.go             # 文件名解析引擎
│   │       ParseFilename()       — 从文件名提取日期/类型/昵称/描述
│   │       CollectMediaFiles()   — 扫描目录下所有合法媒体文件
│   │       GroupPosts()          — 按日期+描述+类型分组为 Post
│   │
│   ├── scanner/
│   │   └── scanner.go            # 用户目录扫描
│   │       ScanUsers()           — 遍历 VolumeDir 找到所有用户文件夹
│   │       userDirRe             — 正则: UID{id}_{nickname}_发布作品
│   │
│   ├── db/
│   │   └── db.go                 # 数据库操作层
│   │       Init()                — 初始化 + 建表迁移
│   │       ListUsers()           — 查询所有用户摘要
│   │       GetUserPosts()        — 按 UID 分页查询作品
│   │       GetTimelinePosts()    — 所有用户视频按时间聚合
│   │       GetRandomPosts()      — 随机抽取作品
│   │       fillMedia()           — 批量回填 media 字段
│   │       fetchPostsCore()      — 通用 post 行扫描
│   │       metasToPosts()        — postMeta → Post 转换
│   │       ReplaceUser/InsertPost/InsertMedia — 写入辅助
│   │       ClearAll()            — 清空数据
│   │       LogSync()             — 记录扫描日志
│   │
│   ├── sync/
│   │   └── sync.go               # 扫描同步流程
│   │       FullScan()            — 全量扫描 + 写入数据库
│   │       RunInitialSync()      — 仅当 DB 为空时执行
│   │
│   └── handler/
│       ├── api.go                # API Handler
│       │   ListUsers()           — GET /api/users
│       │   GetUserPosts()        — GET /api/users/:uid
│       │   GetRandomPosts()      — GET /api/random
│       │   GetTimelinePosts()    — GET /api/timeline
│       │
│       └── static.go             # 静态文件 & 媒体文件服务
│           ServeMedia()          — GET /media/:uid/:file
│
├── web/
│   ├── index.html                # 总索引页（用户卡片网格）
│   ├── user.html                 # 用户作品页（瀑布流）
│   ├── random.html               # 随机推荐页（瀑布流 + 用户徽标）
│   ├── timeline.html             # 最新动态页（全部用户视频聚合）
│   │
│   ├── css/
│   │   ├── style.css             # 主样式（500+ 行）
│   │   └── nav.css               # 导航栏样式
│   │
│   └── js/
│       ├── app.js                # 前端核心逻辑
│       │   fetchJSON             — API 请求封装
│       │   renderPostCard        — 用户页卡片
│       │   renderFeedPostCard    — Feed 页卡片（含用户徽标）
│       │   renderMediaGrid       — 媒体网格（图片/视频）
│       │   loadUsers/filterUsers — 索引页逻辑
│       │   loadUserPosts         — 用户作品瀑布流
│       │   loadRandomPosts       — 随机推荐加载
│       │   loadTimelinePosts     — 时间线加载
│       │   setupWaterfall        — 用户页瀑布流观察者
│       │   setupFeedWaterfall    — Feed 瀑布流观察者
│       │
│       ├── lazy-loader.js        # 懒加载引擎
│       │   initLazyLoad(root)    — IntersectionObserver 监控 data-src
│       │   observeLazy(container)— 手动追加元素
│       │
│       └── lightbox.js           # 图片/视频灯箱
│           lbOpen()              — 打开灯箱
│           closeLightbox()       — 关闭
│           lbNavigate()          — 左右切换
│           支持：滚轮缩放、拖拽平移、双指捏合、左滑切换
```

## 四、数据流

### 4.1 全链路：磁盘 → Web 浏览器

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌───────────┐
│ 磁盘上的  │───→│  parser   │───→│  SQLite  │───→│  Gin API  │
│ 媒体文件  │    │ 文件名解析 │    │ 数据库   │    │  JSON     │
└──────────┘    └───────────┘    └──────────┘    └───────────┘
                                                       │
                  ┌────────────────────────────────────┘
                  ▼
            ┌───────────┐
            │ Web 前端   │
            │ 瀑布流展示 │
            └───────────┘
```

### 4.2 文件名格式

下载文件遵循固定命名规范（由 Python 下载脚本生成）：

```
YYYY-MM-DD HH.MM.SS-类型-昵称-描述[_序号].扩展名
```

示例：
```
2024-01-15 20.30.45-视频-张三丰-这是一条测试视频_1.mp4
2024-01-15 20.30.45-图集-李四-春日照片.jpg
2024-01-15 20.30.45-实况-王五-实况图_2.webp
```

解析字段：

| 字段 | 值 | 说明 |
|------|-----|------|
| datetime | `2024-01-15 20:30:45` | 作品发布时间 |
| type_cn | `视频` / `图集` / `实况` | 中文类型标签 |
| nickname | `张三丰` | 发布者昵称 |
| desc | `这是一条测试视频` | 作品描述 |
| part | `1` / `2` | 多图/混合媒体的序号 |
| ext | `.mp4` → `video`, `.jpg/.webp/.png` → `image` | 媒体类型 |

### 4.3 自动同步流程

```
程序启动
  │
  ├─→ 检查 DB 是否为空
  │     │
  │     ├─ 是 → FullScan（同步阻塞）
  │     │       1. 扫描 VolumeDir → 找所有用户目录
  │     │       2. 遍历每个用户 → CollectMediaFiles → ParseFilename
  │     │       3. GroupPosts：按 datetime+desc+type 聚合为 Post
  │     │       4. 事务写入 SQLite
  │     │       5. LogSync
  │     │
  │     └─ 否 → FullScan（异步 goroutine 后台执行）
  │
  └─→ 可选的定时扫描（--scan-interval 30m）
```

### 4.4 请求到响应链路（以用户页为例）

```
浏览器 GET /user/12345
  │
  ▼
main.go: r.GET("/user/:uid")
  → 返回 embed.FS 中的 web/user.html
  │
  ▼
前端 DOMContentLoaded → loadUserPosts()
  │
  ▼
GET /api/users/12345?offset=0&limit=20
  │
  ▼
handler.GetUserPosts → db.GetUserPosts
  │
  ├─ SELECT COUNT(*) FROM posts WHERE uid = '12345'
  ├─ SELECT nickname FROM users WHERE uid = '12345'
  ├─ SELECT * FROM posts WHERE uid = '12345' ORDER BY create_time DESC LIMIT 20
  └─ SELECT * FROM media WHERE post_id IN (...) (批量回填)
  │
  ▼
响应 JSON → 前端 renderPostCard → innerHTML
  │
  ▼
IntersectionObserver 监控 sentinel → 滚动触发下一页
```

### 4.5 懒加载流程

```
页面渲染 HTML
  │
  ├─ <img data-src="/media/uid/file.jpg" loading="lazy">
  └─ <video data-src="/media/uid/file.mp4" preload="metadata">
  │
  ▼
initLazyLoad() / initLazyLoad(container)
  │
  ├─ querySelectorAll('[data-src]')
  └─ IntersectionObserver (rootMargin: 200px)
       │
       ▼
元素进入视口（提前 200px）
  │
  ▼
loadElement()
  ├─ img: data-src → src
  └─ video: data-src → src, 调用 el.load()
```

## 五、前端页面结构

### 5.1 页面概览

| 页面 | URL | 数据 API | 渲染函数 | 瀑布流 |
|------|-----|---------|---------|--------|
| 总索引 | `/` | `/api/users` | `renderUserCards` | 无 |
| 用户作品 | `/user/:uid` | `/api/users/:uid` | `renderPostCard` | offset 分页 |
| 随机推荐 | `/random` | `/api/random` | `renderFeedPostCard` | 随机批次 |
| 最新动态 | `/timeline` | `/api/timeline` | `renderFeedPostCard` | offset 分页 |

### 5.2 组件复用

```
┌─────────────────────────────────────────────┐
│               nav-bar (所有页面)             │
├─────────────────────────────────────────────┤
│                页面特有 header               │
├─────────────────────────────────────────────┤
│         posts-container (瀑布流)             │
│  ┌─ post-card ──────────────────────────┐  │
│  │  post-header  [时间 + 类型标签]       │  │
│  │  post-user    [@昵称] (feed 页专属)   │  │
│  │  post-desc    [高亮 #hashtag]         │  │
│  │  media-grid   [懒加载 img/video]      │  │
│  └──────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│            sentinel (瀑布流触发)             │
├─────────────────────────────────────────────┤
│              lightbox (图片/视频灯箱)         │
└─────────────────────────────────────────────┘
```

### 5.3 CSS 文件分工

| 文件 | 职责 |
|------|------|
| `style.css` | 全局重置、Post 卡片、Media 网格、Lightbox、用户卡片、搜索栏、响应式 |
| `nav.css` | 导航栏样式（独立文件便于所有页面共享） |

## 六、安全考量

| 点 | 措施 |
|----|------|
| 路径遍历 | `ServeMedia` 中每步检查 `..`，过滤绝对路径 |
| SQL 注入 | 全部使用参数化查询 `?` |
| 媒体访问范围 | 仅限 VolumeDir 下匹配的用户目录 |
| 前端渲染 | 所有用户内容（描述、昵称）均通过 `&gt;/&lt;` 转义 |

## 七、待开发功能（已出方案）

| 功能 | 文档 | 状态 |
|------|------|------|
| 按日期定位（快速滑动 + 选择） | `docs/date-navigation-plan.md` | 方案已出，待实施 |

## 八、命名约定

- 用户目录：`UID{id}_{nickname}_发布作品`
- Post AwemeID：`{nickname}_{5位序号}`（如 `张三丰_00001`）
- 数据库 `create_time`：ISO 格式 `2024-01-15T00:00:00`
- 数据库 `create_time_display`：可读格式 `2024-01-15 00:00:00`
