package main

import (
	"embed"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"TikTokDownloader-HTML/internal/db"
	"TikTokDownloader-HTML/internal/handler"
	"TikTokDownloader-HTML/internal/sync"
)

//go:embed web
var webFS embed.FS

func main() {
	cliVolumeDir := flag.String("volume-dir", "", "Volume directory path (overrides VOLUME_DIR env)")
	cliPort := flag.String("port", "", "HTTP server port (overrides PORT env)")
	cliScanIntv := flag.Duration("scan-interval", 30*time.Minute, "Periodic full-scan interval (0 to disable)")
	flag.Parse()

	// ── Configuration ──────────────────────────────────────────
	volumeDir := *cliVolumeDir
	if volumeDir == "" {
		volumeDir = os.Getenv("VOLUME_DIR")
	}
	if volumeDir == "" {
		log.Fatal("错误: 未指定 VOLUME_DIR，请通过 --volume-dir 或 VOLUME_DIR 环境变量设置")
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "data.db"
	}

	handler.VolumeDir = volumeDir

	// ── Database ───────────────────────────────────────────────
	if err := db.Init(dbPath); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer db.Close()

	// Run initial sync in background (only if DB is empty)
	go sync.RunInitialSync(volumeDir)

	// Periodic automatic scan
	if *cliScanIntv > 0 {
		intv := *cliScanIntv
		log.Printf("[sync] 定时扫描已启用，间隔 %v", intv)
		go func() {
			ticker := time.NewTicker(intv)
			defer ticker.Stop()
			for range ticker.C {
				log.Printf("[sync] 开始定时扫描...")
				if err := sync.FullScan(volumeDir); err != nil {
					log.Printf("[sync] 定时扫描失败: %v", err)
				}
			}
		}()
	} else {
		log.Println("[sync] 定时扫描已禁用")
	}

	// ── Router ─────────────────────────────────────────────────
	r := gin.Default()

	// API (reads from SQLite)
	r.GET("/api/users", handler.ListUsers)
	r.GET("/api/users/:uid/date-index", handler.GetDateIndex)
	r.GET("/api/users/:uid", handler.GetUserPosts)
	r.GET("/api/random", handler.GetRandomPosts)
	r.GET("/api/timeline", handler.GetTimelinePosts)

	// Manual re-sync endpoint
	// NOTE: after a successful sync, CDN caches for API routes (/api/users, /api/timeline, etc.)
	// will remain stale until their max-age expires. To purge immediately, trigger a CDN cache
	// invalidation from your CDN provider after calling this endpoint.
	r.POST("/api/sync", func(c *gin.Context) {
		log.Println("[api] 收到手动同步请求...")
		if err := sync.FullScan(volumeDir); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Media files (served directly from Volume)
	r.GET("/media/:uid/:file", handler.ServeMedia)

	// SPA pages - from embedded FS
	// no-cache: CDN/browser must revalidate each time, but may serve from cache if 304.
	// This ensures users always get the latest HTML shell without forcing a full re-download.
	r.GET("/", func(c *gin.Context) {
		data, err := fs.ReadFile(webFS, "web/index.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})
	r.GET("/user/:uid", func(c *gin.Context) {
		data, err := fs.ReadFile(webFS, "web/user.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})
	r.GET("/random", func(c *gin.Context) {
		data, err := fs.ReadFile(webFS, "web/random.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})
	r.GET("/timeline", func(c *gin.Context) {
		data, err := fs.ReadFile(webFS, "web/timeline.html")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	// Static assets - from embedded FS (with cache headers)
	r.GET("/favicon.png", func(c *gin.Context) {
		data, err := fs.ReadFile(webFS, "web/favicon.png")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "public, max-age=86400")
		c.Data(http.StatusOK, "image/png", data)
	})
	r.GET("/css/*filepath", func(c *gin.Context) {
		subPath := strings.TrimPrefix(c.Param("filepath"), "/")
		data, err := fs.ReadFile(webFS, "web/css/"+subPath)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "public, max-age=3600")
		c.Data(http.StatusOK, "text/css; charset=utf-8", data)
	})
	r.GET("/js/*filepath", func(c *gin.Context) {
		subPath := strings.TrimPrefix(c.Param("filepath"), "/")
		data, err := fs.ReadFile(webFS, "web/js/"+subPath)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "public, max-age=3600")
		c.Data(http.StatusOK, "application/javascript; charset=utf-8", data)
	})

	// ── Start ──────────────────────────────────────────────────
	port := *cliPort
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = "8080"
	}

	log.Printf("TikTokDownloader server starting on :%s", port)
	log.Printf("  Volume dir: %s", volumeDir)
	log.Printf("  Web files:  embedded")
	log.Printf("  DB path:    %s", dbPath)

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
