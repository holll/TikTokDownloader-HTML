package sync

import (
	"database/sql"
	"log"

	"TikTokDownloader/internal/db"
	"TikTokDownloader/internal/parser"
	"TikTokDownloader/internal/scanner"
)

// FullScan scans the Volume directory, parses all media files,
// and writes everything into the SQLite database inside a single transaction.
func FullScan(volumeDir string) error {
	users, err := scanner.ScanUsers(volumeDir)
	if err != nil {
		return err
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() // safe no-op after Commit

	if err := db.ClearAll(tx); err != nil {
		return err
	}

	totalPosts := 0
	for _, u := range users {
		if err := db.ReplaceUser(tx, u.UID, u.Nickname, u.DirName, u.DirPath); err != nil {
			return err
		}

		files := parser.CollectMediaFiles(u.DirPath)
		if len(files) == 0 {
			continue
		}

		posts := parser.GroupPosts(files)
		for i := range posts {
			postID, err := db.InsertPost(tx, u.UID, &posts[i])
			if err != nil {
				return err
			}
			for j := range posts[i].Media {
				if err := db.InsertMedia(tx, postID, &posts[i].Media[j]); err != nil {
					return err
				}
			}
			totalPosts++
		}
	}

	if err := db.LogSync(tx, len(users), totalPosts); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("[sync] 完成: %d 位用户, %d 条作品", len(users), totalPosts)
	return nil
}

// RunInitialSync runs a full scan only if the database is empty.
func RunInitialSync(volumeDir string) {
	empty, err := db.IsEmpty()
	if err != nil {
		log.Printf("[sync] 检查数据库失败: %v", err)
		return
	}
	if !empty {
		log.Println("[sync] 数据库已有数据，异步后台扫描")
		FullScan(volumeDir)
		return
	}
	log.Println("[sync] 数据库为空，开始初始扫描...")
	if err := FullScan(volumeDir); err != nil {
		log.Printf("[sync] 初始扫描失败: %v", err)
	}
}

// Transaction helper (unused but kept for future use)
func txRollback(tx *sql.Tx) {
	if err := tx.Rollback(); err != nil && err != sql.ErrTxDone {
		log.Printf("[sync] rollback 失败: %v", err)
	}
}
