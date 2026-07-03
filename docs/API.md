# TikTokDownloader · API 文档

> 版本：1.0 · 日期：2026-07-03

## 概览

所有 API 端点返回 `Content-Type: application/json`。基础 URL 为 `http://{host}:{port}`（默认 `http://localhost:8080`）。

分页类端点统一接受以下查询参数：

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `offset` | int | `0` | ≥0 | 偏移量（跳过前 N 条） |
| `limit` | int | `20` | 1-100 | 每页返回条数 |

---

## 1. 用户列表

### `GET /api/users`

返回所有用户的基本信息（昵称、作品数、首图缩略图）。

**请求参数**：无

**响应示例**：

```json
[
  {
    "uid": "123456789",
    "nickname": "张三丰",
    "post_count": 42,
    "first_thumb": "/media/123456789/2024-01-15%2020.30.45-%E5%9B%BE%E9%9B%86-%E5%BC%A0%E4%B8%89%E4%B8%B0-%E6%98%A5%E6%97%A5%E7%85%A7%E7%89%87.jpg"
  },
  {
    "uid": "987654321",
    "nickname": "李四",
    "post_count": 15
  }
]
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `uid` | string | 用户 UID |
| `nickname` | string | 昵称 |
| `post_count` | int | 作品总数 |
| `first_thumb` | string? | 首张图片缩略图 URL（可缺省） |

---

## 2. 用户作品

### `GET /api/users/:uid`

返回指定用户的已发布作品列表，按时间倒序排列。支持分页。

**路径参数**：

| 参数 | 说明 |
|------|------|
| `uid` | 用户 UID |

**查询参数**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `offset` | 0 | 偏移量 |
| `limit` | 20 | 每页条数（最大 100） |

**响应示例**：

```json
{
  "uid": "123456789",
  "nickname": "张三丰",
  "posts": [
    {
      "aweme_id": "张三丰_00001",
      "create_time": "2024-01-15T20:30:45",
      "create_time_display": "2024-01-15 20:30:45",
      "desc": "这是一条测试视频 #日常",
      "media_type": "video",
      "media_type_cn": "视频",
      "media": [
        {
          "type": "video",
          "filename": "2024-01-15 20.30.45-视频-张三丰-这是一条测试视频.mp4",
          "part": 1,
          "url": "/media/123456789/2024-01-15%2020.30.45-%E8%A7%86%E9%A2%91-%E5%BC%A0%E4%B8%89%E4%B8%B0-%E8%BF%99%E6%98%AF%E4%B8%80%E6%9D%A1%E6%B5%8B%E8%AF%95%E8%A7%86%E9%A2%91.mp4"
        }
      ],
      "media_count": 1
    }
  ],
  "has_more": true,
  "total": 42
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `uid` | string | 用户 UID |
| `nickname` | string | 用户昵称 |
| `total` | int | 该用户作品总数 |
| `has_more` | bool | 是否还有更多（`offset + len(posts) < total`） |
| `posts` | Post[] | 作品列表 |

**Post 对象**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `aweme_id` | string | 作品唯一标识（`{昵称}_{序号}`） |
| `create_time` | string | ISO 时间（`2024-01-15T20:30:45`） |
| `create_time_display` | string | 可读时间（`2024-01-15 20:30:45`） |
| `desc` | string | 作品描述 |
| `media_type` | string | `video` / `image` / `mixed` |
| `media_type_cn` | string | `视频` / `图集` / `实况` |
| `media` | Media[] | 媒体列表 |
| `media_count` | int | 媒体数量 |
| `uid` | string? | 用户 UID（Feed 流专属） |
| `nickname` | string? | 用户昵称（Feed 流专属） |

**Media 对象**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | `video` / `image` |
| `filename` | string | 原始文件名 |
| `part` | int | 序号（多图场景） |
| `url` | string | 前端可直接使用的 `src` 路径 |

---

## 3. 用户日期索引

### `GET /api/users/:uid/date-index`

返回指定用户按日期分组的作品统计，含累计偏移量，用于日期导航。

**路径参数**：

| 参数 | 说明 |
|------|------|
| `uid` | 用户 UID |

**响应示例**：

```json
[
  {
    "date": "2024-01-15",
    "label": "2024-01-15",
    "count": 3,
    "offset": 0
  },
  {
    "date": "2024-01-10",
    "label": "2024-01-10",
    "count": 5,
    "offset": 3
  }
]
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | string | 日期（`YYYY-MM-DD`） |
| `label` | string | 同 `date` |
| `count` | int | 该日期作品数 |
| `offset` | int | 该日期第一条作品在总列表中的累计偏移量 |

> 前端使用 `offset` 调用 `GET /api/users/:uid?offset=N` 即可跳转到对应日期位置。

---

## 4. 随机推荐

### `GET /api/random`

返回跨用户的随机作品集。每次请求返回不同的随机组合。

**查询参数**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `limit` | 20 | 每页条数（最大 100） |

> 注意：随机推荐**不支持 `offset` 分页**。每次请求都是独立的随机选取。多次请求可能包含重复作品。

**响应示例**：

```json
{
  "posts": [
    {
      "aweme_id": "李四_00015",
      "create_time": "2024-05-20T14:30:00",
      "create_time_display": "2024-05-20 14:30:00",
      "desc": "夏日穿搭 #时尚",
      "media_type": "image",
      "media_type_cn": "图集",
      "media": [
        {
          "type": "image",
          "filename": "2024-05-20 14.30.00-图集-李四-夏日穿搭_1.jpg",
          "part": 1,
          "url": "/media/987654321/2024-05-20%2014.30.00-%E5%9B%BE%E9%9B%86-%E6%9D%8E%E5%9B%9B-%E5%A4%8F%E6%97%A5%E7%A9%BF%E6%90%AD_1.jpg"
        }
      ],
      "media_count": 1,
      "uid": "987654321",
      "nickname": "李四"
    }
  ],
  "has_more": true,
  "total": 999
}
```

**响应字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `posts` | Post[] | 作品列表（每篇含 `uid` 和 `nickname`） |
| `has_more` | bool | 是否还有更多（随机场景几乎总是 `true`） |
| `total` | int | 所有用户作品总数 |

---

## 5. 最新动态（时间线）

### `GET /api/timeline`

返回所有用户作品（视频、图集、实况），按发布时间倒序排列。支持分页。

**查询参数**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `offset` | 0 | 偏移量 |
| `limit` | 20 | 每页条数（最大 100） |

**响应格式**：同 `FeedResponse`（见随机推荐）。

---

## 6. 媒体文件服务

### `GET /media/:uid/:file`

直接返回原始媒体文件（图片/视频）。不是 JSON API，返回二进制流。

**路径参数**：

| 参数 | 说明 |
|------|------|
| `uid` | 用户 UID |
| `file` | 文件名（URL 编码） |

**安全**：路径遍历防护（过滤 `..` 和绝对路径）。

---

## 7. 手动同步

### `POST /api/sync`

触发一次全量文件扫描并更新数据库。

**请求参数**：无（请求体可为空）

**响应示例**：

```json
{
  "status": "ok"
}
```

---

## 8. 页面路由

| 路径 | 返回内容 |
|------|---------|
| `GET /` | 总索引页（`web/index.html`） |
| `GET /user/:uid` | 用户作品页（`web/user.html`） |
| `GET /random` | 随机推荐页（`web/random.html`） |
| `GET /timeline` | 最新动态页（`web/timeline.html`） |

这些路由返回 `text/html`，不是 JSON。

---

## 9. 错误响应

所有 API 在出错时返回 JSON 格式的 HTTP 错误：

```json
{
  "error": "错误描述信息"
}
```

常见状态码：

| 状态码 | 场景 |
|--------|------|
| 200 | 正常 |
| 404 | 用户/媒体不存在 |
| 403 | 路径遍历被拦截 |
| 500 | 数据库/文件系统错误 |
