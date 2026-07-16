package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"TikTokDownloader-HTML/internal/db"
	"TikTokDownloader-HTML/internal/models"
)

// VolumeDir is the root directory containing user media folders.
var VolumeDir string

// ── GET /api/users ───────────────────────────────────────────

// ListUsers returns a summary of all users from the database.
func ListUsers(c *gin.Context) {
	summaries, err := db.ListUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if summaries == nil {
		summaries = []models.UserSummary{}
	}
	c.Header("Cache-Control", "public, max-age=300")
	c.JSON(http.StatusOK, summaries)
}

// ── GET /api/users/:uid ──────────────────────────────────────

// GetUserPosts returns paginated posts for a single user from the database.
func GetUserPosts(c *gin.Context) {
	uid := c.Param("uid")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	orderAsc := c.DefaultQuery("order", "desc") == "asc"
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	nickname, posts, total, err := db.GetUserPosts(uid, offset, limit, orderAsc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if posts == nil {
		posts = []models.Post{}
	}

	c.Header("Cache-Control", "public, max-age=300")
	c.JSON(http.StatusOK, models.UserDetail{
		UID:      uid,
		Nickname: nickname,
		Posts:    posts,
		HasMore:  offset+len(posts) < total,
		Total:    total,
	})
}

// ── GET /api/random ──────────────────────────────────────────

// GetRandomPosts returns a random selection of posts across all users.
func GetRandomPosts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	posts, total, err := db.GetRandomPosts(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if posts == nil {
		posts = []models.Post{}
	}

	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, models.FeedResponse{
		Posts:   posts,
		HasMore: len(posts) == limit, // always more until empty
		Total:   total,
	})
}

// ── GET /api/users/:uid/date-index ────────────────────────────

// GetDateIndex returns per-date post counts and cumulative offsets for a user.
func GetDateIndex(c *gin.Context) {
	uid := c.Param("uid")
	orderAsc := c.DefaultQuery("order", "desc") == "asc"

	items, err := db.GetDateIndex(uid, orderAsc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []models.DateIndexItem{}
	}
	c.Header("Cache-Control", "public, max-age=300")
	c.JSON(http.StatusOK, items)
}

// ── GET /api/timeline ────────────────────────────────────────

// GetTimelinePosts returns video/mixed posts from all users ordered by time.
func GetTimelinePosts(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	posts, total, err := db.GetTimelinePosts(offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if posts == nil {
		posts = []models.Post{}
	}

	c.Header("Cache-Control", "public, max-age=60")
	c.JSON(http.StatusOK, models.FeedResponse{
		Posts:   posts,
		HasMore: offset+len(posts) < total,
		Total:   total,
	})
}
