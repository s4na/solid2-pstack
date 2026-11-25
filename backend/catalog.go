package main

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
)

type Store struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Product struct {
	ID          int64  `json:"id"`
	StoreID     int64  `json:"storeId"`
	StoreName   string `json:"storeName"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Image       string `json:"image"`
	Price       int    `json:"price"`
	Stock       int    `json:"stock"`
}

const productSelect = "SELECT p.id,p.store_id,s.name,p.name,p.description,p.category,p.image,p.price,p.stock " +
	"FROM products p JOIN stores s ON s.id=p.store_id"

type rowScanner interface {
	Scan(...any) error
}

func scanProduct(row rowScanner) (Product, error) {
	var product Product
	err := row.Scan(&product.ID, &product.StoreID, &product.StoreName, &product.Name,
		&product.Description, &product.Category, &product.Image, &product.Price, &product.Stock)
	return product, err
}

func (app marketplace) loadProducts(ctx context.Context, storeID int64) ([]Product, error) {
	query := productSelect + " ORDER BY p.id"
	var args []any
	if storeID != 0 {
		query = productSelect + " WHERE p.store_id=? ORDER BY p.id"
		args = append(args, storeID)
	}
	rows, err := app.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	products := []Product{}
	for rows.Next() {
		product, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, product)
	}
	return products, rows.Err()
}

func (app marketplace) loadStores(ctx context.Context) ([]Store, error) {
	rows, err := app.db.QueryContext(ctx, "SELECT id,name,description FROM stores ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	stores := []Store{}
	for rows.Next() {
		var store Store
		if err := rows.Scan(&store.ID, &store.Name, &store.Description); err != nil {
			return nil, err
		}
		stores = append(stores, store)
	}
	return stores, rows.Err()
}

func (app marketplace) catalog(w http.ResponseWriter, r *http.Request) {
	stores, err := app.loadStores(r.Context())
	if err != nil {
		respondError(w, err)
		return
	}
	products, err := app.loadProducts(r.Context(), 0)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]any{"stores": stores, "products": products})
}

func (app marketplace) storeForSeller(ctx context.Context, sellerID int64) (Store, error) {
	var store Store
	err := app.db.QueryRowContext(ctx, "SELECT id,name,description FROM stores WHERE seller_id=?", sellerID).
		Scan(&store.ID, &store.Name, &store.Description)
	return store, err
}

func (app marketplace) sellerDashboard(w http.ResponseWriter, r *http.Request) {
	sellerID, err := app.requireAccount(r, sellerRole)
	if err != nil {
		respondError(w, err)
		return
	}
	ctx := r.Context()
	store, err := app.storeForSeller(ctx, sellerID)
	if errors.Is(err, sql.ErrNoRows) {
		respond(w, http.StatusOK, map[string]any{"store": nil, "products": []Product{}, "orders": []Order{}})
		return
	}
	if err != nil {
		respondError(w, err)
		return
	}
	products, err := app.loadProducts(ctx, store.ID)
	if err != nil {
		respondError(w, err)
		return
	}
	orders, err := loadOrders(ctx, app.db, "l.store_id=?", store.ID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, map[string]any{"store": store, "products": products, "orders": orders})
}

func (app marketplace) openStore(w http.ResponseWriter, r *http.Request) {
	sellerID, err := app.requireAccount(r, sellerRole)
	if err != nil {
		respondError(w, err)
		return
	}
	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := readJSON(w, r, &input); err != nil {
		respondError(w, err)
		return
	}
	name, nameOK := normalizedText(input.Name, 60)
	description, descriptionOK := normalizedText(input.Description, 240)
	if !nameOK || !descriptionOK {
		respondError(w, problem{http.StatusBadRequest, "お店の名前と紹介文を入力してください。"})
		return
	}
	result, err := app.db.ExecContext(r.Context(), "INSERT INTO stores (seller_id,name,description) VALUES (?,?,?) "+
		"ON CONFLICT(seller_id) DO NOTHING", sellerID, name, description)
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
		respondError(w, problem{http.StatusConflict, "すでにお店を出店しています。"})
		return
	}
	id, err := result.LastInsertId()
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusCreated, Store{ID: id, Name: name, Description: description})
}

type productInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Price       int    `json:"price"`
	Stock       *int   `json:"stock"`
}

var validCategories = map[string]bool{"table": true, "scent": true, "fabric": true, "other": true}

func (app marketplace) addProduct(w http.ResponseWriter, r *http.Request) {
	sellerID, err := app.requireAccount(r, sellerRole)
	if err != nil {
		respondError(w, err)
		return
	}
	var input productInput
	if err := readJSON(w, r, &input); err != nil {
		respondError(w, err)
		return
	}
	name, nameOK := normalizedText(input.Name, 80)
	description, descriptionOK := normalizedText(input.Description, 400)
	if !nameOK || !descriptionOK || !validCategories[input.Category] || input.Price < 1 ||
		input.Price > 10000000 || input.Stock == nil || *input.Stock < 0 || *input.Stock > 9999 {
		respondError(w, problem{http.StatusBadRequest, "商品名・説明・カテゴリ・価格・在庫を確認してください。"})
		return
	}
	ctx := r.Context()
	store, err := app.storeForSeller(ctx, sellerID)
	if errors.Is(err, sql.ErrNoRows) {
		err = problem{http.StatusConflict, "先にお店を出店してください。"}
	}
	if err != nil {
		respondError(w, err)
		return
	}
	id, err := scanOneID(app.db.ExecContext(ctx, "INSERT INTO products (store_id,name,description,category,image,price,stock) "+
		"VALUES (?,?,?,?,?,?,?)", store.ID, name, description, input.Category, "", input.Price, *input.Stock))
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusCreated, Product{ID: id, StoreID: store.ID, StoreName: store.Name, Name: name,
		Description: description, Category: input.Category, Price: input.Price, Stock: *input.Stock})
}

func (app marketplace) updateStock(w http.ResponseWriter, r *http.Request) {
	sellerID, err := app.requireAccount(r, sellerRole)
	if err != nil {
		respondError(w, err)
		return
	}
	productID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || productID < 1 {
		respondError(w, problem{http.StatusBadRequest, "商品を確認してください。"})
		return
	}
	var input struct {
		Stock         *int `json:"stock"`
		ExpectedStock *int `json:"expectedStock"`
	}
	if err := readJSON(w, r, &input); err != nil {
		respondError(w, err)
		return
	}
	if input.Stock == nil || *input.Stock < 0 || *input.Stock > 9999 ||
		input.ExpectedStock == nil || *input.ExpectedStock < 0 || *input.ExpectedStock > 9999 {
		respondError(w, problem{http.StatusBadRequest, "在庫は0〜9999点で入力してください。"})
		return
	}
	result, err := app.db.ExecContext(r.Context(), "UPDATE products SET stock=? WHERE id=? AND stock=? "+
		"AND store_id=(SELECT id FROM stores WHERE seller_id=?)", *input.Stock, productID, *input.ExpectedStock, sellerID)
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
		respondError(w, problem{http.StatusConflict, "在庫が変わったか、更新できない商品です。最新の一覧を確認してください。"})
		return
	}
	respond(w, http.StatusOK, map[string]int{"stock": *input.Stock})
}

func (app marketplace) seed(ctx context.Context) error {
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	changed, err := tx.ExecContext(ctx, "INSERT INTO seed_runs (name) VALUES ('marketplace-v1') ON CONFLICT DO NOTHING")
	if err != nil {
		return err
	}
	inserted, err := changed.RowsAffected()
	if err != nil || inserted == 0 {
		return err
	}
	const demoPassword = "yorimichi-demo"
	seedAccount := func(role accountRole, name, email string) (int64, error) {
		salt, hash, err := passwordRecord(demoPassword)
		if err != nil {
			return 0, err
		}
		return scanOneID(tx.ExecContext(ctx, "INSERT INTO "+accountTable(role)+
			" (name,email,salt,password) VALUES (?,?,?,?)", name, email, salt, hash))
	}
	if _, err := seedAccount(buyerRole, "お試し購入者", "buyer@example.test"); err != nil {
		return err
	}
	if _, err := seedAccount(sellerRole, "お試し出店者", "seller@example.test"); err != nil {
		return err
	}

	seedStore := func(name, email, description string) (int64, error) {
		sellerID, err := seedAccount(sellerRole, name, email)
		if err != nil {
			return 0, err
		}
		return scanOneID(tx.ExecContext(ctx, "INSERT INTO stores (seller_id,name,description) VALUES (?,?,?)", sellerID, name, description))
	}
	ceramicsID, err := seedStore("土の音", "ceramics@example.test", "手になじむ、毎日の器。")
	if err != nil {
		return err
	}
	scentID, err := seedStore("灯と森", "scent@example.test", "暮らしにそっと寄り添う香り。")
	if err != nil {
		return err
	}
	linenID, err := seedStore("布の間", "linen@example.test", "使うほどやわらかくなる布もの。")
	if err != nil {
		return err
	}

	products := []Product{
		{StoreID: ceramicsID, Name: "森色のマグ", Description: "深い緑の釉薬。コーヒーやお茶にちょうどいいサイズ。", Category: "table", Image: "mug", Price: 2600, Stock: 12},
		{StoreID: scentID, Name: "木漏れ日のキャンドル", Description: "ウッディな香りのソイワックスキャンドル。", Category: "scent", Image: "candle", Price: 3200, Stock: 8},
		{StoreID: linenID, Name: "草色のリネンクロス", Description: "ざっくりと織った、乾きやすいキッチンクロス。", Category: "fabric", Image: "linen", Price: 1800, Stock: 15},
		{StoreID: ceramicsID, Name: "朝のうつわ", Description: "トーストやおやつに使いやすい取り皿。", Category: "table", Image: "plate", Price: 2400, Stock: 6},
	}
	for _, product := range products {
		if _, err := tx.ExecContext(ctx, "INSERT INTO products (store_id,name,description,category,image,price,stock) VALUES (?,?,?,?,?,?,?)",
			product.StoreID, product.Name, product.Description, product.Category, product.Image, product.Price, product.Stock); err != nil {
			return err
		}
	}
	return tx.Commit()
}
