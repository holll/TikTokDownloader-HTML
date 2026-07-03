package handler

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
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

	// Locate the user directory by UID
	pattern := filepath.Join(VolumeDir, "UID"+uid+"_*_发布作品")
	matches, err := filepath.Glob(pattern)
	if err != nil || len(matches) == 0 {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.File(filepath.Join(matches[0], cleanFile))
}
