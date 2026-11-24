package main

import (
	"context"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

type Buyer struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Seller struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type accountRole string

const (
	buyerRole  accountRole = "buyer"
	sellerRole accountRole = "seller"
)

func roleOf(r *http.Request) (accountRole, error) {
	role := accountRole(r.PathValue("role"))
	if role != buyerRole && role != sellerRole {
		return "", problem{http.StatusNotFound, "このアカウント種別はありません。"}
	}
	return role, nil
}

func accountTable(role accountRole) string {
	if role == sellerRole {
		return "sellers"
	}
	return "buyers"
}

func cookieName(role accountRole) string   { return "yorimichi_" + string(role) }
func sessionTable(role accountRole) string { return string(role) + "_sessions" }

const sessionLifetime = 12 * time.Hour

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func passwordKey(salt []byte, password string) ([]byte, error) {
	return pbkdf2.Key(sha256.New, password, salt, 210000, 32)
}

func passwordRecord(password string) (salt, hash []byte, err error) {
	salt = make([]byte, 16)
	rand.Read(salt)
	hash, err = passwordKey(salt, password)
	return salt, hash, err
}

func (app marketplace) account(w http.ResponseWriter, r *http.Request) {
	role, err := roleOf(r)
	if err != nil {
		respondError(w, err)
		return
	}
	var input credentials
	if err := readJSON(w, r, &input); err != nil {
		respondError(w, err)
		return
	}
	name, nameOK := normalizedText(input.Name, 60)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	address, emailErr := mail.ParseAddress(email)
	if !nameOK || len(email) > 254 || emailErr != nil || address.Address != email ||
		len(input.Password) < 8 || len(input.Password) > 128 {
		respondError(w, problem{http.StatusBadRequest, "名前・メールアドレス・8文字以上のパスワードを入力してください。"})
		return
	}
	ctx := r.Context()
	salt, hash, err := passwordRecord(input.Password)
	if err != nil {
		respondError(w, err)
		return
	}
	result, err := app.db.ExecContext(ctx, "INSERT INTO "+accountTable(role)+
		" (name,email,salt,password) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING", name, email, salt, hash)
	if err != nil {
		respondError(w, err)
		return
	}
	changed, err := result.RowsAffected()
	if err != nil {
		respondError(w, err)
		return
	}
	if changed == 0 {
		respondError(w, problem{http.StatusConflict, "このメールアドレスはすでに登録されています。"})
		return
	}
	id, err := result.LastInsertId()
	if err == nil {
		err = app.startSession(w, r, role, id)
	}
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (app marketplace) login(w http.ResponseWriter, r *http.Request) {
	role, err := roleOf(r)
	if err != nil {
		respondError(w, err)
		return
	}
	var input credentials
	if err := readJSON(w, r, &input); err != nil {
		respondError(w, err)
		return
	}
	if len(input.Password) > 128 {
		respondError(w, problem{http.StatusUnauthorized, "メールアドレスかパスワードが違います。"})
		return
	}

	var id int64
	salt, hash := make([]byte, 16), make([]byte, 32)
	err = app.db.QueryRowContext(r.Context(), "SELECT id,salt,password FROM "+accountTable(role)+" WHERE email = ?",
		strings.ToLower(strings.TrimSpace(input.Email))).Scan(&id, &salt, &hash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		respondError(w, err)
		return
	}
	validAccount := err == nil
	candidate, err := passwordKey(salt, input.Password)
	if err != nil {
		respondError(w, err)
		return
	}
	if subtle.ConstantTimeCompare(candidate, hash) != 1 || !validAccount {
		respondError(w, problem{http.StatusUnauthorized, "メールアドレスかパスワードが違います。"})
		return
	}
	if err := app.startSession(w, r, role, id); err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (app marketplace) startSession(w http.ResponseWriter, r *http.Request, role accountRole, id int64) error {
	now := time.Now()
	token := rand.Text()
	digest := sha256.Sum256([]byte(token))
	tx, err := app.db.BeginTx(r.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	table := sessionTable(role)
	if _, err := tx.ExecContext(r.Context(), "DELETE FROM "+table+" WHERE expires_at <= ?", now.Unix()); err != nil {
		return err
	}
	if old, err := r.Cookie(cookieName(role)); err == nil {
		previous := sha256.Sum256([]byte(old.Value))
		if _, err := tx.ExecContext(r.Context(), "DELETE FROM "+table+" WHERE token = ?", previous[:]); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(r.Context(), "INSERT INTO "+table+
		" (token,account_id,expires_at) VALUES (?,?,?)", digest[:], id, now.Add(sessionLifetime).Unix()); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name: cookieName(role), Value: token, Path: "/", MaxAge: int(sessionLifetime.Seconds()),
		HttpOnly: true, Secure: r.TLS != nil, SameSite: http.SameSiteStrictMode,
	})
	return nil
}

func (app marketplace) logout(w http.ResponseWriter, r *http.Request) {
	role, err := roleOf(r)
	if err != nil {
		respondError(w, err)
		return
	}
	if cookie, err := r.Cookie(cookieName(role)); err == nil {
		digest := sha256.Sum256([]byte(cookie.Value))
		if _, err := app.db.ExecContext(r.Context(), "DELETE FROM "+sessionTable(role)+" WHERE token = ?", digest[:]); err != nil {
			respondError(w, err)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName(role), Value: "", Path: "/", MaxAge: -1, HttpOnly: true,
		Secure: r.TLS != nil, SameSite: http.SameSiteStrictMode})
	respond(w, http.StatusOK, map[string]bool{"ok": true})
}

func (app marketplace) readAccount(ctx context.Context, r *http.Request, role accountRole, id *int64, name, email *string) error {
	cookie, err := r.Cookie(cookieName(role))
	if errors.Is(err, http.ErrNoCookie) {
		return sql.ErrNoRows
	}
	if err != nil {
		return err
	}
	digest := sha256.Sum256([]byte(cookie.Value))
	return app.db.QueryRowContext(ctx, "SELECT a.id,a.name,a.email FROM "+sessionTable(role)+" AS s JOIN "+
		accountTable(role)+" AS a ON a.id=s.account_id WHERE s.token=? AND s.expires_at>?",
		digest[:], time.Now().Unix()).Scan(id, name, email)
}

func (app marketplace) requireAccount(r *http.Request, role accountRole) (int64, error) {
	var id int64
	var name, email string
	err := app.readAccount(r.Context(), r, role, &id, &name, &email)
	if errors.Is(err, sql.ErrNoRows) {
		label := "購入者"
		if role == sellerRole {
			label = "出店者"
		}
		return 0, problem{http.StatusUnauthorized, label + "としてログインしてください。"}
	}
	return id, err
}

func (app marketplace) session(w http.ResponseWriter, r *http.Request) {
	var buyer Buyer
	var seller Seller
	value := struct {
		Buyer  *Buyer  `json:"buyer"`
		Seller *Seller `json:"seller"`
	}{}
	if err := app.readAccount(r.Context(), r, buyerRole, &buyer.ID, &buyer.Name, &buyer.Email); err == nil {
		value.Buyer = &buyer
	} else if !errors.Is(err, sql.ErrNoRows) {
		respondError(w, err)
		return
	}
	if err := app.readAccount(r.Context(), r, sellerRole, &seller.ID, &seller.Name, &seller.Email); err == nil {
		value.Seller = &seller
	} else if !errors.Is(err, sql.ErrNoRows) {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, value)
}
