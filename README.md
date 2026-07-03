# TikTokDownloader

本地抖音作品资源归档管理工具 — 将硬盘上的已下载媒体文件变成可浏览、可搜索的 Web 档案馆。

## 功能

- 📁 **总索引** — 用户卡片网格，支持搜索
- 🎞️ **瀑布流浏览** — 无限滚动加载作品
- 🖼️ **图片/视频灯箱** — 缩放、拖拽、左右切换
- 🎲 **随机推荐** — 发现任意作品
- 📺 **最新动态** — 所有用户视频按时间聚合
- ⚡ **懒加载** — 视频/图片仅在可视区域加载
- 🔄 **自动扫描** — 启动时扫描硬盘文件，支持定时更新
- 📦 **单文件部署** — 前端资源编译时嵌入，无需额外文件

## 快速开始

### 1. 准备媒体文件

将下载的抖音作品按用户目录放置，命名规范：

```
{VolumeDir}/
├── UID123456789_张三丰_发布作品/
│   ├── 2024-01-15 20.30.45-视频-张三丰-这是一条测试视频.mp4
│   ├── 2024-01-15 20.30.45-图集-张三丰-春日照片_1.jpg
│   └── 2024-01-15 20.30.45-图集-张三丰-春日照片_2.webp
│
├── UID987654321_李四_发布作品/
│   └── 2024-05-20 14.30.00-图集-李四-夏日穿搭.jpg
│
└── ...
```

文件名格式：`YYYY-MM-DD HH.MM.SS-类型-昵称-描述[_序号].扩展名`

- 类型：`视频` / `图集` / `实况`
- 支持的扩展名：`.mp4`, `.mov`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

### 2. 编译（可选）

如果已下载编译好的 `tikdownloader.exe`，跳过此步。

```bash
# 需要 Go 1.25+
go build -o tikdownloader.exe .
```

### 3. 运行

```bash
# Windows
set VOLUME_DIR=D:\抖音下载
tikdownloader.exe

# Linux/macOS
export VOLUME_DIR=/path/to/downloads
./tikdownloader
```

**命令行参数**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--volume-dir` | `$VOLUME_DIR` | 媒体文件根目录 |
| `--port` | `8080`（或 `$PORT`） | HTTP 服务端口 |
| `--scan-interval` | `30m` | 定时扫描间隔（`0` 禁用） |

### 4. 打开浏览器

访问 `http://localhost:8080`。

## 页面导航

```
http://localhost:8080/
    │
    ├─ /               总索引 · 用户卡片网格
    ├─ /user/{uid}     用户作品 · 瀑布流
    ├─ /random         随机推荐 · 瀑布流
    └─ /timeline        最新动态 · 全用户视频聚合
```

每页顶部均有导航栏，当前页高亮。

## 技术架构

| 层 | 技术 |
|----|------|
| 后端 | Go 1.25 + Gin + SQLite（纯 Go，无需 CGO） |
| 前端 | 原生 HTML/CSS/JS，零框架零依赖 |
| 懒加载 | IntersectionObserver + data-src |
| 嵌入 | `//go:embed` 编译时嵌入静态资源 |

详细架构见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表 |
| GET | `/api/users/:uid` | 用户作品（分页） |
| GET | `/api/random` | 随机推荐 |
| GET | `/api/timeline` | 最新动态（分页） |
| POST | `/api/sync` | 手动触发扫描 |
| GET | `/media/:uid/:file` | 原始媒体文件 |

完整 API 文档见 [`docs/API.md`](docs/API.md)。

## 文档

| 文档 | 说明 |
|------|------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 项目架构、数据流、目录结构 |
| [`docs/API.md`](docs/API.md) | 全部 API 端点、参数、响应格式 |
| [`docs/date-navigation-plan.md`](docs/date-navigation-plan.md) | 按日期定位功能技术方案（待开发） |

## 环境变量

| 变量 | 说明 |
|------|------|
| `VOLUME_DIR` | 媒体文件根目录（必填，除非用 `--volume-dir`） |
| `DB_PATH` | SQLite 数据库文件路径（默认 `data.db`） |
| `PORT` | HTTP 服务端口（默认 `8080`） |

## 许可

MIT
