package scanner

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
)

// UserInfo holds the minimal information about a scanned user directory.
type UserInfo struct {
	UID      string
	Nickname string
	DirName  string
	DirPath  string // full absolute path to the media directory
}

// userDirRe matches "UID{id}_{nickname}_发布作品"
var userDirRe = regexp.MustCompile(`^UID(\d+)_(.*?)_发布作品$`)

// ScanUsers walks volumeDir and returns all matching user directories
// sorted alphabetically by name.
func ScanUsers(volumeDir string) ([]UserInfo, error) {
	entries, err := os.ReadDir(volumeDir)
	if err != nil {
		return nil, err
	}

	// Sort for deterministic output
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	var users []UserInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		m := userDirRe.FindStringSubmatch(name)
		if m == nil {
			continue
		}
		users = append(users, UserInfo{
			UID:      m[1],
			Nickname: m[2],
			DirName:  name,
			DirPath:  filepath.Join(volumeDir, name),
		})
	}
	return users, nil
}
