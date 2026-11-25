import { createSignal, For, Show } from "solid-js";
import {
  api, categories, categoryKeys, errorMessage, field, yen,
  type Seller, type SellerDashboard,
} from "./api";
import { AccountForm, ActionButton, OrderList } from "./components";

export function SellerPanel(props: {
  seller: Seller | null;
  dashboard: SellerDashboard | null;
  refresh: () => Promise<void>;
  signedIn: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [message, setMessage] = createSignal("");

  async function submit(path: string, method: string, body: unknown, success: string, form?: HTMLFormElement) {
    if (busy()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, method, body);
      form?.reset();
      setMessage(success);
      await props.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
      if (method === "PATCH") await props.refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="work-area" aria-labelledby="seller-title">
      <div class="work-title">
        <div><h1 id="seller-title">出店者ページ</h1><p>お店を開き、商品と在庫、受注を管理できます。</p></div>
        <Show when={props.seller}>
          {(seller) => (
            <div class="account-badge"><span>{seller().name}</span><ActionButton variant="quiet" onClick={() => void props.logout()}>ログアウト</ActionButton></div>
          )}
        </Show>
      </div>
      <Show when={props.seller} fallback={
        <div class="panel account-panel">
          <h2>出店者アカウント</h2>
          <AccountForm role="seller" signedIn={props.signedIn} />
        </div>
      }>
        <Show when={error()}><p class="notice error" role="alert">{error()}</p></Show>
        <Show when={message()}><p class="notice success" role="status">{message()}</p></Show>
        <Show when={props.dashboard} fallback={<p role="status">お店の情報を読み込んでいます。</p>}>
          {(dashboard) => (
            <Show when={dashboard().store} fallback={
              <form class="panel form-stack compact" onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = new FormData(form);
                void submit("/seller/store", "POST", { name: field(values, "name"),
                  description: field(values, "description") }, "お店を出店しました。", form);
              }}>
                <h2>お店を開く</h2>
                <label>お店の名前<input name="name" maxlength="60" required /></label>
                <label>お店の紹介<textarea name="description" maxlength="240" rows="3" required /></label>
                <ActionButton type="submit" disabled={busy()}>出店する</ActionButton>
              </form>
            }>
              {(store) => (
                <>
                  <div class="seller-summary"><h2>{store().name}</h2><p>{store().description}</p></div>
                  <div class="seller-grid">
                    <form class="panel form-stack" onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const values = new FormData(form);
                      void submit("/seller/products", "POST", {
                        name: field(values, "name"),
                        description: field(values, "description"),
                        category: field(values, "category"),
                        price: Number(field(values, "price")),
                        stock: Number(field(values, "stock")),
                      }, "商品を公開しました。", form);
                    }}>
                      <h2>商品を登録</h2>
                      <label>商品名<input name="name" maxlength="80" required /></label>
                      <label>商品説明<textarea name="description" maxlength="400" rows="3" required /></label>
                      <label>カテゴリ<select name="category">
                        <For each={categoryKeys}>{(key) => <option value={key}>{categories[key]}</option>}</For>
                      </select></label>
                      <div class="form-columns">
                        <label>価格（円）<input type="number" name="price" min="1" max="10000000" required /></label>
                        <label>在庫（点）<input type="number" name="stock" min="0" max="9999" required /></label>
                      </div>
                      <ActionButton type="submit" disabled={busy()}>商品を公開する</ActionButton>
                    </form>
                    <div class="panel">
                      <h2>公開中の商品</h2>
                      <ul class="inventory-list">
                        <For each={dashboard().products} fallback={<li class="muted">商品が登録されていません。</li>}>
                          {(product) => (
                            <li>
                              <div><strong>{product.name}</strong><p>{yen(product.price)} ・ 在庫 {product.stock} 点</p></div>
                              <form class="stock-form" onSubmit={(event) => {
                                event.preventDefault();
                                const values = new FormData(event.currentTarget);
                                void submit(`/seller/products/${product.id}`, "PATCH", {
                                  stock: Number(field(values, "stock")), expectedStock: product.stock,
                                }, "在庫を更新しました。");
                              }}>
                                <input type="number" name="stock" min="0" max="9999" required value={product.stock}
                                  aria-label={`${product.name}の新しい在庫`} />
                                <ActionButton variant="quiet" type="submit" disabled={busy()}>更新</ActionButton>
                              </form>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  </div>
                  <div class="seller-orders"><h2>受注一覧</h2><OrderList orders={dashboard().orders} seller /></div>
                </>
              )}
            </Show>
          )}
        </Show>
      </Show>
    </section>
  );
}
