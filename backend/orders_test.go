package main

import (
	"context"
	"errors"
	"net/http"
	"path/filepath"
	"testing"
)

func seededMarket(t *testing.T) (marketplace, int64) {
	t.Helper()
	db, err := openDB(filepath.Join(t.TempDir(), "marketplace.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	app := marketplace{db: db}
	if err := app.seed(t.Context()); err != nil {
		t.Fatal(err)
	}
	var buyerID int64
	if err := db.QueryRow("SELECT id FROM buyers WHERE email='buyer@example.test'").Scan(&buyerID); err != nil {
		t.Fatal(err)
	}
	return app, buyerID
}

func assertProductStock(t *testing.T, app marketplace, id int64, want int) {
	t.Helper()
	var stock int
	if err := app.db.QueryRow("SELECT stock FROM products WHERE id=?", id).Scan(&stock); err != nil {
		t.Fatal(err)
	}
	if stock != want {
		t.Fatalf("product %d stock = %d, want %d", id, stock, want)
	}
}

func assertConflict(t *testing.T, err error) {
	t.Helper()
	var failure problem
	if !errors.As(err, &failure) || failure.status != http.StatusConflict {
		t.Fatalf("expected conflict, got %v", err)
	}
}

func testCheckout(key string, items ...checkoutItem) checkoutInput {
	return checkoutInput{RequestKey: key, Recipient: "テスト", PostalCode: "100-0001", Address: "東京都千代田区", Items: items}
}

func TestCheckoutRollsBackAndRetriesAreIdempotent(t *testing.T) {
	app, buyerID := seededMarket(t)
	ctx := t.Context()
	input := testCheckout("checkout-test-key-1",
		checkoutItem{ProductID: 1, Quantity: 2, UnitPrice: 2600},
		checkoutItem{ProductID: 2, Quantity: 9, UnitPrice: 3200},
	)
	_, _, err := app.placeOrder(ctx, buyerID, input)
	assertConflict(t, err)
	assertProductStock(t, app, 1, 12)
	assertProductStock(t, app, 2, 8)
	var orderCount int
	if err := app.db.QueryRow("SELECT count(*) FROM orders").Scan(&orderCount); err != nil || orderCount != 0 {
		t.Fatalf("failed checkout left an order: %d, %v", orderCount, err)
	}

	input.Items[1].Quantity = 1
	input.Items[1].UnitPrice = 1
	_, _, err = app.placeOrder(ctx, buyerID, input)
	assertConflict(t, err)
	assertProductStock(t, app, 1, 12)

	input.Items[1].UnitPrice = 3200
	first, created, err := app.placeOrder(ctx, buyerID, input)
	if err != nil || !created || first.Total != 8400 || len(first.Lines) != 2 {
		t.Fatalf("order = %#v, created = %t, err = %v", first, created, err)
	}
	retry, created, err := app.placeOrder(ctx, buyerID, input)
	if err != nil || created || retry.ID != first.ID {
		t.Fatalf("retry = %#v, created = %t, err = %v", retry, created, err)
	}
	input.Items[0].Quantity = 3
	_, _, err = app.placeOrder(ctx, buyerID, input)
	assertConflict(t, err)
	assertProductStock(t, app, 1, 10)
	assertProductStock(t, app, 2, 7)
}

func TestConcurrentCheckoutsDoNotOversell(t *testing.T) {
	app, buyerID := seededMarket(t)
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, key := range []string{"parallel-order-test-1", "parallel-order-test-2"} {
		go func() {
			<-start
			_, _, err := app.placeOrder(context.Background(), buyerID, testCheckout(key,
				checkoutItem{ProductID: 4, Quantity: 4, UnitPrice: 2400},
			))
			results <- err
		}()
	}
	close(start)
	failures := 0
	for range 2 {
		if err := <-results; err != nil {
			assertConflict(t, err)
			failures++
		}
	}
	if failures != 1 {
		t.Fatalf("stock conflict count = %d, want 1", failures)
	}
	assertProductStock(t, app, 4, 2)
}
