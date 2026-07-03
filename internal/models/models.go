package models

import "time"

// ── Core data models (aligned with Python dataclasses) ────────

// MediaFile represents a single parsed media filename
type MediaFile struct {
	DateTime    time.Time
	DateTimeStr string
	DateTimeISO string
	TypeCN      string // "视频" | "图集" | "实况"
	TypeEN      string // "video" | "image" | "mixed"
	Nickname    string
	Desc        string
	Part        int
	Ext         string
	Filename    string
}

// Media is one item (image or video) inside a Post
type Media struct {
	Type     string `json:"type"` // "video" | "image"
	Filename string `json:"filename"`
	Part     int    `json:"part"`
	URL      string `json:"url"` // frontend-ready src path
}

// Post is a single 作品 containing one or more Media
type Post struct {
	AwemeID           string  `json:"aweme_id"`
	CreateTime        string  `json:"create_time"`
	CreateTimeDisplay string  `json:"create_time_display"`
	Desc              string  `json:"desc"`
	MediaType         string  `json:"media_type"`    // "video" | "image" | "mixed"
	MediaTypeCN       string  `json:"media_type_cn"` // "视频" | "图集" | "实况"
	Media             []Media `json:"media"`
	MediaCount        int     `json:"media_count"`
	UID               string  `json:"uid,omitempty"`      // filled for cross-user feeds
	Nickname          string  `json:"nickname,omitempty"` // filled for cross-user feeds
}

// UserSummary — returned by GET /api/users
type UserSummary struct {
	UID        string `json:"uid"`
	Nickname   string `json:"nickname"`
	PostCount  int    `json:"post_count"`
	FirstThumb string `json:"first_thumb,omitempty"`
}

// UserDetail — returned by GET /api/users/:uid
type UserDetail struct {
	UID      string `json:"uid"`
	Nickname string `json:"nickname"`
	Posts    []Post `json:"posts"`
	HasMore  bool   `json:"has_more"`
	Total    int    `json:"total"`
}

// FeedResponse — used by /api/random and /api/timeline (cross-user feeds)
type FeedResponse struct {
	Posts   []Post `json:"posts"`
	HasMore bool   `json:"has_more"`
	Total   int    `json:"total"`
}
