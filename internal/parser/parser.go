package parser

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"TikTokDownloader/internal/models"
)

// ── Constants (mirrors Python's MEDIA_EXTENSIONS / TYPE_MAP) ──

var mediaExts = map[string]bool{
	".mp4": true, ".jpeg": true, ".jpg": true,
	".png": true, ".webp": true, ".gif": true, ".mov": true,
}

var typeEnMap = map[string]string{
	"视频": "video",
	"图集": "image",
	"实况": "mixed",
}

var partRe = regexp.MustCompile(`^(.+)_(\d+)$`)

// ── ParseFilename ────────────────────────────────────────────

// ParseFilename parses a downloaded media filename.
//
// Expected format: YYYY-MM-DD HH.MM.SS-TYPE-NICKNAME-DESC[_PART].ext
//
// Returns nil if the filename doesn't match the expected pattern.
func ParseFilename(filename string) *models.MediaFile {
	ext := strings.ToLower(filepath.Ext(filename))
	if !mediaExts[ext] {
		return nil
	}

	stem := strings.TrimSuffix(filename, filepath.Ext(filename))

	// Extract optional part number suffix: _N
	part := 1
	if m := partRe.FindStringSubmatch(stem); m != nil {
		stem = m[1]
		part, _ = strconv.Atoi(m[2])
	}

	parts := strings.Split(stem, "-")
	if len(parts) < 5 {
		return nil
	}

	year := parts[0]
	month := parts[1]
	dayTime := parts[2] // "DD HH.MM.SS"
	typeCN := parts[3]
	nickname := parts[4]
	desc := ""
	if len(parts) > 5 {
		desc = strings.Join(parts[5:], "-")
	}

	typeEN, ok := typeEnMap[typeCN]
	if !ok {
		return nil
	}

	dt, err := time.Parse("2006-01-02 15.04.05",
		fmt.Sprintf("%s-%s-%s", year, month, dayTime))
	if err != nil {
		return nil
	}

	return &models.MediaFile{
		DateTime:    dt,
		DateTimeStr: dt.Format("2006-01-02 15:04:05"),
		DateTimeISO: dt.Format("2006-01-02T15:04:05"),
		TypeCN:      typeCN,
		TypeEN:      typeEN,
		Nickname:    nickname,
		Desc:        desc,
		Part:        part,
		Ext:         ext,
		Filename:    filename,
	}
}

// ── GroupPosts ────────────────────────────────────────────────

// groupKey uniquely identifies a post.
type groupKey struct {
	dt       time.Time
	typeCN   string
	nickname string
	desc     string
}

// GroupPosts groups parsed MediaFiles into Posts.
//
// Files sharing the same (datetime, type_cn, nickname, desc) belong to
// one post.  Results are sorted reverse-chronologically.
func GroupPosts(files []*models.MediaFile) []models.Post {
	groups := make(map[groupKey][]*models.MediaFile)
	for _, f := range files {
		k := groupKey{f.DateTime, f.TypeCN, f.Nickname, f.Desc}
		groups[k] = append(groups[k], f)
	}

	posts := make([]models.Post, 0, len(groups))
	idx := 0
	for _, group := range groups {
		// Sort files within post by part number
		sort.Slice(group, func(i, j int) bool {
			return group[i].Part < group[j].Part
		})

		media := make([]models.Media, 0, len(group))
		for _, f := range group {
			mt := "image"
			if f.Ext == ".mp4" || f.Ext == ".mov" {
				mt = "video"
			}
			media = append(media, models.Media{
				Type:     mt,
				Filename: f.Filename,
				Part:     f.Part,
			})
		}

		first := group[0]
		posts = append(posts, models.Post{
			AwemeID:           fmt.Sprintf("%s_%05d", first.Nickname, idx),
			CreateTime:        first.DateTimeISO,
			CreateTimeDisplay: first.DateTimeStr,
			Desc:              first.Desc,
			MediaType:         typeEnMap[first.TypeCN],
			MediaTypeCN:       first.TypeCN,
			Media:             media,
			MediaCount:        len(media),
		})
		idx++
	}

	// Sort reverse-chronological
	sort.Slice(posts, func(i, j int) bool {
		return posts[i].CreateTime > posts[j].CreateTime
	})

	return posts
}

// ── Utility ──────────────────────────────────────────────────

// CollectMediaFiles reads all media files from a user directory,
// parses them, and returns the valid ones.
func CollectMediaFiles(dirPath string) []*models.MediaFile {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil
	}
	var files []*models.MediaFile
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if mf := ParseFilename(e.Name()); mf != nil {
			files = append(files, mf)
		}
	}
	return files
}

// FindFirstImage returns the filename of the first image in posts
// (used for index thumbnails).
func FindFirstImage(posts []models.Post) string {
	for _, p := range posts {
		for _, m := range p.Media {
			if m.Type == "image" {
				return m.Filename
			}
		}
	}
	return ""
}
