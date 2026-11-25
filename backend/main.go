package main

import (
	"context"
	"database/sql"
	_ "embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

type marketplace struct {
	db *sql.DB
}

type problem struct {
	status  int
	message string
}

func (err problem) Error() string { return err.message }

func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Print(err)
	}
}

func respondError(w http.ResponseWriter, err error) {
	var failure problem
	if errors.As(err, &failure) {
		respond(w, failure.status, map[string]string{"error": failure.message})
		return
	}
	log.Print(err)
	respond(w, http.StatusInternalServerError, map[string]string{"error": "処理を完了できませんでした。"})
}

func readJSON(w http.ResponseWriter, r *http.Request, destination any) error {
	contentType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if contentType != "application/json" {
		return problem{http.StatusUnsupportedMediaType, "JSON で送信してください。"}
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 24<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return problem{http.StatusBadRequest, "入力内容を確認してください。"}
	}
	if decoder.Decode(new(any)) != io.EOF {
		return problem{http.StatusBadRequest, "JSON は1件だけ送信してください。"}
	}
	return nil
}

func openDB(path string) (*sql.DB, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	dsn := (&url.URL{Scheme: "file", Path: absolute, RawQuery: "_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"}).String()
	return openSQLite(dsn)
}

func openSQLite(dsn string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func (app marketplace) routes(staticDir string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := app.db.PingContext(r.Context()); err != nil {
			respond(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
			return
		}
		respond(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/catalog", app.catalog)
	mux.HandleFunc("GET /api/session", app.session)
	mux.HandleFunc("POST /api/accounts/{role}", app.account)
	mux.HandleFunc("POST /api/login/{role}", app.login)
	mux.HandleFunc("POST /api/logout/{role}", app.logout)
	mux.HandleFunc("GET /api/seller", app.sellerDashboard)
	mux.HandleFunc("POST /api/seller/store", app.openStore)
	mux.HandleFunc("POST /api/seller/products", app.addProduct)
	mux.HandleFunc("PATCH /api/seller/products/{id}", app.updateStock)
	mux.HandleFunc("GET /api/orders", app.buyerOrders)
	mux.HandleFunc("POST /api/orders", app.checkout)
	mux.HandleFunc("GET /api/", func(w http.ResponseWriter, r *http.Request) {
		respondError(w, problem{http.StatusNotFound, "この API はありません。"})
	})
	if staticDir != "" {
		mux.HandleFunc("GET /notification-demo", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
		})
		mux.Handle("GET /", http.FileServer(http.Dir(staticDir)))
	}
	protected := http.NewCrossOriginProtection().Handler(mux)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		protected.ServeHTTP(w, r)
	})
}

func main() {
	exportCatalog := flag.Bool("export-demo-catalog", false, "write the seeded public catalog as JSON")
	flag.Parse()
	if *exportCatalog {
		if err := writeDemoCatalog(context.Background(), os.Stdout); err != nil {
			log.Fatal(err)
		}
		return
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "marketplace.sqlite"
	}
	db, err := openDB(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	app := marketplace{db: db}
	if os.Getenv("DEMO_ACCOUNTS") == "1" {
		if err := app.seed(context.Background()); err != nil {
			log.Fatal(err)
		}
	}
	server := &http.Server{
		Addr:              ":8080",
		Handler:           app.routes(os.Getenv("STATIC_DIR")),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       45 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	shutdown := make(chan struct{})
	go func() {
		defer close(shutdown)
		<-ctx.Done()
		timeout, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(timeout); err != nil {
			log.Print(err)
		}
	}()
	log.Print("marketplace listening on :8080")
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	<-shutdown
}

func writeDemoCatalog(ctx context.Context, output io.Writer) error {
	db, err := openSQLite("file::memory:?_pragma=foreign_keys(1)")
	if err != nil {
		return err
	}
	defer db.Close()

	app := marketplace{db: db}
	if err := app.seed(ctx); err != nil {
		return err
	}
	catalog, err := app.loadCatalog(ctx)
	if err != nil {
		return err
	}
	return json.NewEncoder(output).Encode(catalog)
}

func normalizedText(value string, maxLength int) (string, bool) {
	value = strings.TrimSpace(value)
	return value, value != "" && len([]rune(value)) <= maxLength
}

func scanOneID(result sql.Result, err error) (int64, error) {
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("read inserted id: %w", err)
	}
	return id, nil
}
