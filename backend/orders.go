package main

import (
	"bytes"
	"cmp"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"
)

type Order struct {
	ID         int64       `json:"id"`
	Recipient  string      `json:"recipient"`
	PostalCode string      `json:"postalCode"`
	Address    string      `json:"address"`
	CreatedAt  string      `json:"createdAt"`
	Total      int64       `json:"total"`
	Lines      []OrderLine `json:"lines"`
}

type OrderLine struct {
	ProductID   int64  `json:"productId"`
	ProductName string `json:"productName"`
	StoreName   string `json:"storeName"`
	UnitPrice   int    `json:"unitPrice"`
	Quantity    int    `json:"quantity"`
}

type checkoutInput struct {
	RequestKey string         `json:"requestKey"`
	Recipient  string         `json:"recipient"`
	PostalCode string         `json:"postalCode"`
	Address    string         `json:"address"`
	Items      []checkoutItem `json:"items"`
}

type checkoutItem struct {
	ProductID int64 `json:"productId"`
	Quantity  int   `json:"quantity"`
	UnitPrice int   `json:"unitPrice"`
}

var postalCodePattern = regexp.MustCompile("^[0-9]{3}-?[0-9]{4}$")
var orderKeyPattern = regexp.MustCompile("^[A-Za-z0-9_-]{16,80}$")

func (input *checkoutInput) validate() error {
	name, nameOK := normalizedText(input.Recipient, 80)
	address, addressOK := normalizedText(input.Address, 250)
	postalCode := strings.TrimSpace(input.PostalCode)
	if !nameOK || !addressOK || !postalCodePattern.MatchString(postalCode) {
		return problem{http.StatusBadRequest, "お届け先の氏名・郵便番号・住所を入力してください。"}
	}
	if !orderKeyPattern.MatchString(input.RequestKey) || len(input.Items) == 0 || len(input.Items) > 40 {
		return problem{http.StatusBadRequest, "カートの内容を確認してください。"}
	}
	if len(postalCode) == 7 {
		postalCode = postalCode[:3] + "-" + postalCode[3:]
	}
	input.Recipient, input.Address, input.PostalCode = name, address, postalCode
	slices.SortFunc(input.Items, func(a, b checkoutItem) int {
		return cmp.Compare(a.ProductID, b.ProductID)
	})
	var lastID int64
	for _, item := range input.Items {
		if item.ProductID <= lastID || item.Quantity < 1 || item.Quantity > 99 || item.UnitPrice < 1 || item.UnitPrice > 10000000 {
			return problem{http.StatusBadRequest, "カートの商品・数量・価格を確認してください。"}
		}
		lastID = item.ProductID
	}
	return nil
}

func (app marketplace) checkout(w http.ResponseWriter, r *http.Request) {
	buyerID, err := app.requireAccount(r, buyerRole)
	if err != nil {
		respondError(w, err)
		return
	}
	var input checkoutInput
	if err := readJSON(w, r, &input); err != nil {
		respondError(w, err)
		return
	}
	if err := input.validate(); err != nil {
		respondError(w, err)
		return
	}
	order, created, err := app.placeOrder(r.Context(), buyerID, input)
	if err != nil {
		respondError(w, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	respond(w, status, order)
}

func (app marketplace) placeOrder(ctx context.Context, buyerID int64, input checkoutInput) (Order, bool, error) {
	var order Order
	body, err := json.Marshal(input)
	if err != nil {
		return order, false, err
	}
	fingerprint := sha256.Sum256(body)
	tx, err := app.db.BeginTx(ctx, nil)
	if err != nil {
		return order, false, err
	}
	defer tx.Rollback()

	var existingID int64
	var existingHash []byte
	err = tx.QueryRowContext(ctx, "SELECT id,request_hash FROM orders WHERE buyer_id=? AND request_key=?", buyerID, input.RequestKey).
		Scan(&existingID, &existingHash)
	if err == nil {
		if !bytes.Equal(existingHash, fingerprint[:]) {
			return order, false, problem{http.StatusConflict, "同じ注文キーで異なる内容は注文できません。"}
		}
		found, err := loadOrders(ctx, tx, "o.id=?", existingID)
		if err != nil {
			return order, false, err
		}
		if len(found) != 1 {
			return order, false, errors.New("persisted order lines are missing")
		}
		return found[0], false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return order, false, err
	}

	order.Recipient, order.PostalCode, order.Address = input.Recipient, input.PostalCode, input.Address
	order.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	order.ID, err = scanOneID(tx.ExecContext(ctx, "INSERT INTO orders (buyer_id,request_key,request_hash,recipient,postal_code,address,created_at) "+
		"VALUES (?,?,?,?,?,?,?)", buyerID, input.RequestKey, fingerprint[:], order.Recipient, order.PostalCode, order.Address, order.CreatedAt))
	if err != nil {
		return order, false, err
	}
	order.Lines = make([]OrderLine, 0, len(input.Items))
	for _, item := range input.Items {
		product, err := scanProduct(tx.QueryRowContext(ctx, productSelect+" WHERE p.id=?", item.ProductID))
		if errors.Is(err, sql.ErrNoRows) {
			return order, false, problem{http.StatusConflict, "購入できない商品がカートに入っています。"}
		}
		if err != nil {
			return order, false, err
		}
		if product.Price != item.UnitPrice {
			return order, false, problem{http.StatusConflict, product.Name + " の価格が変わりました。カートを確認してください。"}
		}
		decrement, err := tx.ExecContext(ctx, "UPDATE products SET stock=stock-? WHERE id=? AND stock>=?",
			item.Quantity, product.ID, item.Quantity)
		if err != nil {
			return order, false, err
		}
		changed, err := decrement.RowsAffected()
		if err != nil {
			return order, false, err
		}
		if changed != 1 {
			return order, false, problem{http.StatusConflict, product.Name + " の在庫が足りません。数量を変更してください。"}
		}
		line := OrderLine{
			ProductID: product.ID, ProductName: product.Name, StoreName: product.StoreName,
			UnitPrice: product.Price, Quantity: item.Quantity,
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO order_lines (order_id,product_id,store_id,product_name,store_name,unit_price,quantity) "+
			"VALUES (?,?,?,?,?,?,?)", order.ID, line.ProductID, product.StoreID, line.ProductName, line.StoreName, line.UnitPrice, line.Quantity); err != nil {
			return order, false, err
		}
		order.Total += int64(line.UnitPrice) * int64(line.Quantity)
		order.Lines = append(order.Lines, line)
	}
	if err := tx.Commit(); err != nil {
		return order, false, err
	}
	return order, true, nil
}

type orderQueryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func loadOrders(ctx context.Context, database orderQueryer, where string, id int64) ([]Order, error) {
	rows, err := database.QueryContext(ctx, "SELECT o.id,o.recipient,o.postal_code,o.address,o.created_at,"+
		"l.product_id,l.product_name,l.store_name,l.unit_price,l.quantity FROM orders o JOIN order_lines l ON l.order_id=o.id WHERE "+
		where+" ORDER BY o.id DESC,l.product_id", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	orders := []Order{}
	for rows.Next() {
		var order Order
		var line OrderLine
		if err := rows.Scan(&order.ID, &order.Recipient, &order.PostalCode, &order.Address, &order.CreatedAt,
			&line.ProductID, &line.ProductName, &line.StoreName, &line.UnitPrice, &line.Quantity); err != nil {
			return nil, err
		}
		if len(orders) == 0 || orders[len(orders)-1].ID != order.ID {
			orders = append(orders, order)
		}
		current := &orders[len(orders)-1]
		current.Lines = append(current.Lines, line)
		current.Total += int64(line.UnitPrice) * int64(line.Quantity)
	}
	return orders, rows.Err()
}

func (app marketplace) buyerOrders(w http.ResponseWriter, r *http.Request) {
	buyerID, err := app.requireAccount(r, buyerRole)
	if err != nil {
		respondError(w, err)
		return
	}
	orders, err := loadOrders(r.Context(), app.db, "o.buyer_id=?", buyerID)
	if err != nil {
		respondError(w, err)
		return
	}
	respond(w, http.StatusOK, orders)
}
