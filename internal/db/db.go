package db

import (
	"database/sql"
	"fmt"
	"log"
	"net/url"
	"strings"

	_ "modernc.org/sqlite"

	"TikTokDownloader-HTML/internal/models"
)

var DB *sql.DB

// Init opens (or creates) the SQLite database at dbPath and runs migrations.
func Init(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}

	DB.SetMaxOpenConns(1) // SQLite serialises writes

	if err := migrate(); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}

// Close shuts down the database connection.
func Close() {
	if DB != nil {
		DB.Close()
	}
}

// ── Migrations ────────────────────────────────────────────────

func migrate() error {
	ddl := `
	CREATE TABLE IF NOT EXISTS users (
		uid      TEXT PRIMARY KEY,
		nickname TEXT NOT NULL,
		dir_name TEXT NOT NULL,
		dir_path TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS posts (
		id                 INTEGER PRIMARY KEY AUTOINCREMENT,
		uid                TEXT    NOT NULL,
		aweme_id           TEXT    NOT NULL,
		create_time        TEXT    NOT NULL,
		create_time_display TEXT   NOT NULL,
		desc               TEXT    DEFAULT '',
		media_type         TEXT    NOT NULL,
		media_type_cn      TEXT    NOT NULL,
		FOREIGN KEY (uid) REFERENCES users(uid)
	);

	CREATE TABLE IF NOT EXISTS media (
		id       INTEGER PRIMARY KEY AUTOINCREMENT,
		post_id  INTEGER NOT NULL,
		type     TEXT    NOT NULL,
		filename TEXT    NOT NULL,
		part     INTEGER DEFAULT 1,
		FOREIGN KEY (post_id) REFERENCES posts(id)
	);

	CREATE INDEX IF NOT EXISTS idx_posts_uid          ON posts(uid);
	CREATE INDEX IF NOT EXISTS idx_posts_time         ON posts(uid, create_time DESC);
	CREATE INDEX IF NOT EXISTS idx_posts_create_time  ON posts(create_time DESC);
	CREATE INDEX IF NOT EXISTS idx_media_post_id      ON media(post_id);

	CREATE TABLE IF NOT EXISTS sync_log (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		scanned_at  TEXT    NOT NULL,
		users_count INTEGER,
		posts_count INTEGER
	);
	`
	_, err := DB.Exec(ddl)
	return err
}

// ── Query helpers ─────────────────────────────────────────────

// ListUsers returns all users with post counts and first thumbnails.
// Uses a single joined subquery with ROW_NUMBER() to avoid N+1 per-user lookups.
func ListUsers() ([]models.UserSummary, error) {
	query := `
	SELECT
		u.uid,
		u.nickname,
		COUNT(p.id) AS post_count,
		t.first_thumb
	FROM users u
	LEFT JOIN posts p ON p.uid = u.uid
	LEFT JOIN (
		SELECT uid, filename AS first_thumb
		FROM (
			SELECT p2.uid, m.filename,
				ROW_NUMBER() OVER (
					PARTITION BY p2.uid ORDER BY p2.create_time DESC
				) AS rn
			FROM posts p2
			JOIN media m ON m.post_id = p2.id
			WHERE m.type = 'image'
		)
		WHERE rn = 1
	) t ON t.uid = u.uid
	GROUP BY u.uid
	ORDER BY u.nickname
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.UserSummary
	for rows.Next() {
		var s models.UserSummary
		var thumb sql.NullString
		if err := rows.Scan(&s.UID, &s.Nickname, &s.PostCount, &thumb); err != nil {
			return nil, err
		}
		if thumb.Valid && thumb.String != "" {
			s.FirstThumb = "/media/" + s.UID + "/" + url.PathEscape(thumb.String)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// GetUserPosts returns a paginated slice of posts for the given uid.
// orderAsc=false (default): newest first; orderAsc=true: oldest first.
func GetUserPosts(uid string, offset, limit int, orderAsc bool) (nickname string, posts []models.Post, total int, err error) {
	// Total count
	if err = DB.QueryRow("SELECT COUNT(*) FROM posts WHERE uid = ?", uid).Scan(&total); err != nil {
		return
	}

	// Fetch nickname (fallback to uid)
	_ = DB.QueryRow("SELECT nickname FROM users WHERE uid = ?", uid).Scan(&nickname)
	if nickname == "" {
		nickname = uid
	}

	orderDir := "DESC"
	if orderAsc {
		orderDir = "ASC"
	}

	// Post rows
	rows, err := DB.Query(`
		SELECT id, aweme_id, create_time, create_time_display,
		       desc, media_type, media_type_cn
		FROM posts
		WHERE uid = ?
		ORDER BY create_time `+orderDir+`
		LIMIT ? OFFSET ?
	`, uid, limit, offset)
	if err != nil {
		return
	}
	defer rows.Close()

	var postIDs []int64
	postMap := make(map[int64]*models.Post)

	for rows.Next() {
		var p models.Post
		var postID int64
		if err = rows.Scan(&postID, &p.AwemeID, &p.CreateTime,
			&p.CreateTimeDisplay, &p.Desc, &p.MediaType, &p.MediaTypeCN); err != nil {
			return
		}
		p.Media = make([]models.Media, 0)
		postIDs = append(postIDs, postID)
		postMap[postID] = &p
	}
	if err = rows.Err(); err != nil {
		return
	}

	if len(postIDs) == 0 {
		return
	}

	// Bulk-fetch media
	posts = fillMedia(uid, postIDs, postMap)
	return
}

// fillMedia bulk-fetches media rows and fills them into postMap, returning the ordered slice.
func fillMedia(uid string, postIDs []int64, postMap map[int64]*models.Post) []models.Post {
	inPlaceholders := make([]string, len(postIDs))
	inArgs := make([]interface{}, len(postIDs))
	for i, id := range postIDs {
		inPlaceholders[i] = "?"
		inArgs[i] = id
	}

	mediaQuery := "SELECT post_id, type, filename, part FROM media WHERE post_id IN (" +
		strings.Join(inPlaceholders, ",") + ") ORDER BY post_id, part"

	mRows, err := DB.Query(mediaQuery, inArgs...)
	if err != nil {
		return nil
	}
	defer mRows.Close()

	for mRows.Next() {
		var postID int64
		var m models.Media
		if err = mRows.Scan(&postID, &m.Type, &m.Filename, &m.Part); err != nil {
			continue
		}
		m.URL = "/media/" + uid + "/" + url.PathEscape(m.Filename)
		if p, ok := postMap[postID]; ok {
			p.Media = append(p.Media, m)
		}
	}

	var posts []models.Post
	for _, pid := range postIDs {
		p := postMap[pid]
		p.MediaCount = len(p.Media)
		posts = append(posts, *p)
	}
	return posts
}

// ── Cross-user query helpers ──────────────────────────────────

// postMeta holds post row data before media enrichment.
type postMeta struct {
	PostID            int64
	UID               string
	Nickname          string
	AwemeID           string
	CreateTime        string
	CreateTimeDisplay string
	Desc              string
	MediaType         string
	MediaTypeCN       string
}

// fetchPostsCore scans post rows (including uid + nickname) into postMeta structs.
func fetchPostsCore(query string, args ...interface{}) ([]postMeta, error) {
	var metas []postMeta
	// Ensure exactly the right column count for scan
	scanQuery := `SELECT p.id, p.uid, u.nickname, p.aweme_id, p.create_time,
		p.create_time_display, p.desc, p.media_type, p.media_type_cn
		` + query

	rows, err := DB.Query(scanQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pm postMeta
		var nickname sql.NullString
		if err = rows.Scan(&pm.PostID, &pm.UID, &nickname,
			&pm.AwemeID, &pm.CreateTime, &pm.CreateTimeDisplay,
			&pm.Desc, &pm.MediaType, &pm.MediaTypeCN); err != nil {
			return nil, err
		}
		pm.Nickname = nickname.String
		if pm.Nickname == "" {
			pm.Nickname = pm.UID
		}
		metas = append(metas, pm)
	}
	return metas, rows.Err()
}

// metasToPosts converts postMeta slice to Post slice, grouping by uid for media fetch.
func metasToPosts(metas []postMeta) []models.Post {
	if len(metas) == 0 {
		return nil
	}

	// Group post IDs by uid for per-user media fetching
	uidPostIDs := make(map[string][]int64)
	uidPostMap := make(map[string]map[int64]*models.Post)

	for _, pm := range metas {
		if uidPostMap[pm.UID] == nil {
			uidPostMap[pm.UID] = make(map[int64]*models.Post)
		}
		p := &models.Post{
			AwemeID:           pm.AwemeID,
			CreateTime:        pm.CreateTime,
			CreateTimeDisplay: pm.CreateTimeDisplay,
			Desc:              pm.Desc,
			MediaType:         pm.MediaType,
			MediaTypeCN:       pm.MediaTypeCN,
			UID:               pm.UID,
			Nickname:          pm.Nickname,
			Media:             make([]models.Media, 0),
		}
		uidPostIDs[pm.UID] = append(uidPostIDs[pm.UID], pm.PostID)
		uidPostMap[pm.UID][pm.PostID] = p
	}

	// Fetch media per uid and build result preserving original order
	var posts []models.Post
	built := make(map[int64]bool)
	for _, pm := range metas {
		if built[pm.PostID] {
			continue
		}
		// Collect all post IDs for this uid and fetch media once
		postsForUID := fillMedia(pm.UID, uidPostIDs[pm.UID], uidPostMap[pm.UID])
		for _, p := range postsForUID {
			posts = append(posts, p)
		}
		for _, pid := range uidPostIDs[pm.UID] {
			built[pid] = true
		}
	}
	return posts
}

// GetTimelinePosts returns all posts from all users, ordered by create_time DESC.
func GetTimelinePosts(offset, limit int) ([]models.Post, int, error) {
	var total int
	if err := DB.QueryRow("SELECT COUNT(*) FROM posts").Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `FROM posts p
		JOIN users u ON u.uid = p.uid
		ORDER BY p.create_time DESC
		LIMIT ? OFFSET ?`

	metas, err := fetchPostsCore(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	return metasToPosts(metas), total, nil
}

// GetRandomPosts returns a random selection of posts from all users.
func GetRandomPosts(limit int) ([]models.Post, int, error) {
	var total int
	if err := DB.QueryRow("SELECT COUNT(*) FROM posts").Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `FROM posts p
		JOIN users u ON u.uid = p.uid
		ORDER BY RANDOM()
		LIMIT ?`

	metas, err := fetchPostsCore(query, limit)
	if err != nil {
		return nil, 0, err
	}

	return metasToPosts(metas), total, nil
}

// ── Write helpers (used by sync) ──────────────────────────────

// ReplaceUser upserts a user row.
func ReplaceUser(tx *sql.Tx, uid, nickname, dirName, dirPath string) error {
	_, err := tx.Exec(`
		INSERT OR REPLACE INTO users (uid, nickname, dir_name, dir_path)
		VALUES (?, ?, ?, ?)
	`, uid, nickname, dirName, dirPath)
	return err
}

// InsertPost inserts a post row and returns its generated id.
func InsertPost(tx *sql.Tx, uid string, p *models.Post) (int64, error) {
	res, err := tx.Exec(`
		INSERT INTO posts (uid, aweme_id, create_time, create_time_display,
		                   desc, media_type, media_type_cn)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, uid, p.AwemeID, p.CreateTime, p.CreateTimeDisplay,
		p.Desc, p.MediaType, p.MediaTypeCN)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// InsertMedia inserts a media row.
func InsertMedia(tx *sql.Tx, postID int64, m *models.Media) error {
	_, err := tx.Exec(`
		INSERT INTO media (post_id, type, filename, part)
		VALUES (?, ?, ?, ?)
	`, postID, m.Type, m.Filename, m.Part)
	return err
}

// ClearAll removes all rows from users/posts/media (used before re-sync).
func ClearAll(tx *sql.Tx) error {
	for _, t := range []string{"media", "posts", "users"} {
		if _, err := tx.Exec("DELETE FROM " + t); err != nil {
			return err
		}
	}
	return nil
}

// LogSync records a sync event.
func LogSync(tx *sql.Tx, usersCount, postsCount int) error {
	_, err := tx.Exec(`
		INSERT INTO sync_log (scanned_at, users_count, posts_count)
		VALUES (datetime('now'), ?, ?)
	`, usersCount, postsCount)
	return err
}

// GetDateIndex returns per-date post counts and cumulative offsets for a user.
// orderAsc=false (default): newest-first offset; orderAsc=true: oldest-first offset.
func GetDateIndex(uid string, orderAsc bool) ([]models.DateIndexItem, error) {
	orderDir := "DESC"
	if orderAsc {
		orderDir = "ASC"
	}

	query := `
	SELECT
	  d.date,
	  d.cnt,
	  COALESCE(SUM(d.cnt) OVER (
	    ORDER BY d.date ` + orderDir + `
	    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
	  ), 0) AS offset
	FROM (
	  SELECT substr(create_time, 1, 10) AS date, COUNT(*) AS cnt
	  FROM posts WHERE uid = ?
	  GROUP BY date
	) d
	ORDER BY d.date ` + orderDir
	rows, err := DB.Query(query, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.DateIndexItem
	for rows.Next() {
		var item models.DateIndexItem
		if err := rows.Scan(&item.Date, &item.Count, &item.Offset); err != nil {
			return nil, err
		}
		item.Label = item.Date
		items = append(items, item)
	}
	return items, rows.Err()
}

// IsEmpty returns true if the users table has no rows.
func IsEmpty() (bool, error) {
	var cnt int
	err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&cnt)
	return cnt == 0, err
}

// Log helpers (print-friendly)
func init() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
