package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func apiRequest(t *testing.T, handler http.Handler, method, path, json string, status int, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(json))
	if json != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	for _, cookie := range cookies {
		r.AddCookie(cookie)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, r)
	if response.Code != status {
		t.Fatalf("%s %s: got %d, want %d (%s)", method, path, response.Code, status, response.Body.String())
	}
	return response
}

func TestBuyerAndSellerHaveIndependentRoles(t *testing.T) {
	app, _ := seededMarket(t)
	handler := app.routes(t.TempDir())
	buyer := apiRequest(t, handler, "POST", "/api/login/buyer",
		`{"email":"buyer@example.test","password":"yorimichi-demo"}`, http.StatusOK).Result().Cookies()[0]
	seller := apiRequest(t, handler, "POST", "/api/login/seller",
		`{"email":"seller@example.test","password":"yorimichi-demo"}`, http.StatusOK).Result().Cookies()[0]

	apiRequest(t, handler, "GET", "/api/seller", "", http.StatusUnauthorized, buyer)
	apiRequest(t, handler, "GET", "/api/orders", "", http.StatusUnauthorized, seller)
	apiRequest(t, handler, "PATCH", "/api/seller/products/1",
		`{"stock":0,"expectedStock":12}`, http.StatusConflict, seller)
	assertProductStock(t, app, 1, 12)

	apiRequest(t, handler, "GET", "/api/orders", "", http.StatusOK, buyer, seller)
	apiRequest(t, handler, "GET", "/api/seller", "", http.StatusOK, buyer, seller)
	apiRequest(t, handler, "POST", "/api/logout/seller", "", http.StatusOK, buyer, seller)
	apiRequest(t, handler, "GET", "/api/orders", "", http.StatusOK, buyer, seller)
	apiRequest(t, handler, "GET", "/api/seller", "", http.StatusUnauthorized, buyer, seller)
}
