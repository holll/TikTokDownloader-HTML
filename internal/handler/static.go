package handler

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"TikTokDownloader-HTML/internal/db"
)

// ServeMedia streams a media file from a user's directory.
//
// Security: validates the path to prevent directory traversal.
func ServeMedia(c *gin.Context) {
	uid := c.Param("uid")
	file := c.Param("file")

	// Sanitise the file name
	cleanFile := filepath.Clean(file)
	// Check each path component for ".." instead of using substring match,
	// so that legitimate filenames containing "..." are not rejected.
	for _, part := range strings.Split(cleanFile, string(filepath.Separator)) {
		if part == ".." {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
	}
	if filepath.IsAbs(cleanFile) {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	// Look up dir_path from DB (fast), fallback to Glob if not found
	dirPath, err := db.GetUserDirPath(uid)
	if err != nil || dirPath == "" {
		pattern := filepath.Join(VolumeDir, "UID"+uid+"_*_发布作品")
		matches, globErr := filepath.Glob(pattern)
		if globErr != nil || len(matches) == 0 {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		dirPath = matches[0]
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.File(filepath.Join(dirPath, cleanFile))
}
