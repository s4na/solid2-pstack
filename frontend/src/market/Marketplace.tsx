import {
  Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger,
} from "@ui-sdk/solid/dialog";
import { createSignal, For, Match, onCleanup, Show, Switch } from "solid-js";
import {
  api, categories, categoryKeys, errorMessage, field, loadCatalog, orderNumber, RequestError, yen,
  type CartRow, type Catalog, type Category, type Order, type Product, type Role, type SellerDashboard, type Session,
} from "./api";
import { AccountForm, ActionButton, OrderList, ProductImage } from "./components";
import { SellerPanel } from "./SellerPanel";
import { ToneSwitcher } from "./ToneSwitcher";
import { ProductSave, Town } from "./Town";
import type { Tone } from "./tones";
import { createTownSaves } from "./townSaves";

type Screen = "catalog" | "stores" | "town" | "orders" | "seller";
type Cart = Record<number, number>;
type CheckoutItem = { productId: number; unitPrice: number; quantity: number };
type PendingPurchase = { buyerId: number; signature: string; requestKey: string; items: CheckoutItem[] };

const pendingPurchaseKey = "yorimichi-pending-purchase-v1";
const cartLimit = 40;
const quantityLimit = 99;

function savedCart(cartKey: string): Cart {
  try {
    const value = JSON.parse(localStorage.getItem(cartKey) ?? "{}") as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, quantity]) =>
      Number.isSafeInteger(Number(id)) && Number(id) > 0 &&
      Number.isInteger(quantity) && quantity >= 1 && quantity <= quantityLimit,
    ).slice(0, cartLimit));
  } catch {
    return {};
  }
}

function savedPurchase(): PendingPurchase | null {
  try {
    const purchase = JSON.parse(localStorage.getItem(pendingPurchaseKey) ?? "null") as PendingPurchase | null;
    if (purchase && Number.isSafeInteger(purchase.buyerId) && typeof purchase.signature === "string" &&
        typeof purchase.requestKey === "string" && Array.isArray(purchase.items) && purchase.items.length > 0 &&
        purchase.items.every((item) => item && Number.isSafeInteger(item.productId) &&
          Number.isSafeInteger(item.unitPrice) && Number.isSafeInteger(item.quantity))) return purchase;
  } catch {
    return null;
  }
  return null;
}

export function Marketplace(props: { preview: boolean; initialTone: Tone }) {
  const base = import.meta.env.BASE_URL;
  const cartKey = props.preview ? "yorimichi-preview-cart-v1" : "yorimichi-cart-v1";
  const { saves, saveProduct, planEvent } = createTownSaves(props.preview);
  const [screen, setScreen] = createSignal<Screen>("catalog");
  const [catalog, setCatalog] = createSignal<Catalog>({ stores: [], products: [] });
  const [session, setSession] = createSignal<Session>({ buyer: null, seller: null });
  const [dashboard, setDashboard] = createSignal<SellerDashboard | null>(null);
  const [orders, setOrders] = createSignal<Order[]>([]);
  const [catalogLoading, setCatalogLoading] = createSignal(true);
  const [catalogError, setCatalogError] = createSignal("");
  const [screenError, setScreenError] = createSignal("");
  const [category, setCategory] = createSignal<Category | "all">("all");
  const [storeFilter, setStoreFilter] = createSignal<number | null>(null);
  const [search, setSearch] = createSignal("");
  const [selected, setSelected] = createSignal<number[]>([]);
  const [cart, setCart] = createSignal<Cart>(savedCart(cartKey));
  const [cartOpen, setCartOpen] = createSignal(false);
  const [checkout, setCheckout] = createSignal(false);
  const [receipt, setReceipt] = createSignal<Order | null>(null);
  const [cartError, setCartError] = createSignal("");
  const [announcement, setAnnouncement] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [previousPurchase, setPreviousPurchase] = createSignal<PendingPurchase | null>(props.preview ? null : savedPurchase());
  const [addedProduct, setAddedProduct] = createSignal<number | null>(null);
  let addedTimer: number | undefined;
  onCleanup(() => window.clearTimeout(addedTimer));

  const cartCount = () => Object.values(cart()).reduce((count, quantity) => count + quantity, 0);
  const cartRows = (): CartRow[] => catalog().products.flatMap((product) =>
    cart()[product.id] ? [{ product, quantity: cart()[product.id] }] : [],
  );
  const total = () => cartRows().reduce((sum, row) => sum + row.product.price * row.quantity, 0);
  const currentStore = () => catalog().stores.find((store) => store.id === storeFilter());
  const visibleProducts = () => {
    const query = search().trim().toLocaleLowerCase("ja-JP");
    return catalog().products.filter((product) =>
      (category() === "all" || product.category === category()) &&
      (storeFilter() === null || product.storeId === storeFilter()) &&
      (!query || `${product.name} ${product.storeName} ${product.description}`.toLocaleLowerCase("ja-JP").includes(query)),
    );
  };

  async function refreshCatalog() {
    try {
      setCatalog(await loadCatalog(props.preview));
      setCatalogError("");
    } catch (failure) {
      setCatalogError(errorMessage(failure));
    } finally {
      setCatalogLoading(false);
    }
  }

  async function refreshSession() {
    const value = await api<Session>("/session");
    setSession(value);
    return value;
  }

  async function loadOrders(buyerId: number) {
    const value = await api<Order[]>("/orders");
    if (session().buyer?.id === buyerId) setOrders(value);
  }

  async function loadSeller(sellerId: number) {
    const value = await api<SellerDashboard>("/seller");
    if (session().seller?.id === sellerId) setDashboard(value);
  }

  async function refreshSeller() {
    const seller = session().seller;
    if (seller) await Promise.all([loadSeller(seller.id), refreshCatalog()]);
  }

  async function loadScreenData(next: Screen, value: Session) {
    if (next === "orders" && value.buyer) await loadOrders(value.buyer.id);
    if (next === "seller" && value.seller) await loadSeller(value.seller.id);
  }

  async function signedIn() {
    const value = await refreshSession();
    await loadScreenData(screen(), value);
    setScreenError("");
  }

  async function logOut(role: Role) {
    try {
      await api(`/logout/${role}`, "POST");
      setSession((current) => ({ ...current, [role]: null }));
      if (role === "buyer") setOrders([]);
      else setDashboard(null);
      setScreenError("");
    } catch (failure) {
      setScreenError(errorMessage(failure));
    }
  }

  function navigate(next: Screen) {
    setScreen(next);
    setScreenError("");
    window.scrollTo({ top: 0 });
    void loadScreenData(next, session()).catch((failure) => {
      if (screen() === next) setScreenError(errorMessage(failure));
    });
  }

  function shop(storeId?: number) {
    setStoreFilter(storeId ?? null);
    setCategory("all");
    setSearch("");
    navigate("catalog");
  }

  function persistCart(value: Cart) {
    setCart(value);
    try {
      localStorage.setItem(cartKey, JSON.stringify(value));
    } catch {
      // The cart remains available for this page when storage is disabled.
    }
  }

  function setQuantity(product: Product, quantity: number) {
    const existing = cart()[product.id] ?? 0;
    if (quantity > existing && (quantity > product.stock || quantity > quantityLimit)) return false;
    if (!existing && quantity && Object.keys(cart()).length >= cartLimit) {
      setAnnouncement("カートに入れられる商品は40種類までです。");
      return false;
    }
    const next = { ...cart() };
    if (quantity < 1) delete next[product.id];
    else next[product.id] = quantity;
    persistCart(next);
    setCartError("");
    setAnnouncement(quantity > existing
      ? `${product.name}を追加しました（カート内 ${quantity}点）。`
      : `${product.name}の数量を更新しました。`);
    return true;
  }

  function addProduct(product: Product) {
    if (!setQuantity(product, (cart()[product.id] ?? 0) + 1)) return;
    window.clearTimeout(addedTimer);
    setAddedProduct(product.id);
    addedTimer = window.setTimeout(() => setAddedProduct(null), 750);
  }

  function addSelected() {
    const ids = new Set(selected());
    const next = { ...cart() };
    const added: number[] = [];
    let lineCount = Object.keys(next).length;
    for (const product of catalog().products) {
      if (!ids.has(product.id)) continue;
      const current = next[product.id] ?? 0;
      if (current >= Math.min(quantityLimit, product.stock) || (!current && lineCount >= cartLimit)) continue;
      if (!current) lineCount += 1;
      next[product.id] = current + 1;
      added.push(product.id);
    }
    if (added.length) persistCart(next);
    setSelected((value) => value.filter((id) => !added.includes(id)));
    setAnnouncement(added.length === ids.size
      ? `${added.length}種類の商品をカートに追加しました。`
      : `${added.length}種類を追加しました。残りは在庫かカートの上限に達しています。`);
  }

  function changeCartOpen(open: boolean) {
    if (!open && pending()) return;
    if (open) {
      setCheckout(false);
      setReceipt(null);
      setCartError("");
      setAnnouncement("");
    }
    setCartOpen(open);
  }

  const unavailable = () => Object.keys(cart()).length - cartRows().length;
  const canStartOrder = () => cartRows().length > 0 && unavailable() === 0 &&
    cartRows().every((row) => row.quantity <= row.product.stock);

  function matchesPendingCart(purchase: PendingPurchase | null): purchase is PendingPurchase {
    const quantities = cart();
    return purchase !== null && purchase.buyerId === session().buyer?.id &&
      purchase.items.length === Object.keys(quantities).length &&
      purchase.items.every(({ productId, quantity }) => quantities[productId] === quantity);
  }

  const canOrder = () => canStartOrder() || matchesPendingCart(previousPurchase());

  function rememberPurchase(value: PendingPurchase | null) {
    setPreviousPurchase(value);
    try {
      if (value) localStorage.setItem(pendingPurchaseKey, JSON.stringify(value));
      else localStorage.removeItem(pendingPurchaseKey);
    } catch {
      // On this page, retries can still reuse the in-memory request key.
    }
  }

  async function placeOrder(values: FormData) {
    const buyer = session().buyer;
    if (!buyer || pending() || !canOrder()) return;
    setPending(true);
    setCartError("");
    const delivery = {
      recipient: field(values, "recipient").trim(),
      postalCode: field(values, "postalCode").trim().replace(/^(\d{3})-?(\d{4})$/, "$1-$2"),
      address: field(values, "address").trim(),
    };

    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(delivery)));
      const signature = btoa(String.fromCharCode(...new Uint8Array(digest)));
      const previous = savedPurchase() ?? previousPurchase();
      let purchase: PendingPurchase;
      if (matchesPendingCart(previous) && previous.signature === signature) {
        purchase = previous;
      } else {
        if (!canStartOrder()) {
          setCartError("注文を再確認するには、前回と同じお届け先を入力してください。");
          return;
        }
        purchase = {
          buyerId: buyer.id,
          signature,
          requestKey: crypto.randomUUID(),
          items: cartRows().map(({ product, quantity }) => ({ productId: product.id, unitPrice: product.price, quantity })),
        };
      }
      rememberPurchase(purchase);
      const order = await api<Order>("/orders", "POST", {
        ...delivery, items: purchase.items, requestKey: purchase.requestKey,
      });
      persistCart({});
      rememberPurchase(null);
      setReceipt(order);
      setCheckout(false);
      setAnnouncement(`注文 ${orderNumber(order.id)} が確定しました。`);
      await refreshCatalog();
    } catch (failure) {
      setCartError(errorMessage(failure));
      if (failure instanceof RequestError && failure.status === 409) {
        rememberPurchase(null);
        await refreshCatalog();
      }
      if (failure instanceof RequestError && failure.status === 401) await refreshSession().catch(() => undefined);
    } finally {
      setPending(false);
    }
  }

  void refreshCatalog();
  if (!props.preview) {
    void refreshSession()
      .then((value) => loadScreenData(screen(), value))
      .catch((failure) => setScreenError(errorMessage(failure)));
  }

  return (
    <>
      <a class="skip-link" href="#content">本文へ</a>
      <Dialog open={cartOpen()} onOpenChange={changeCartOpen}>
        <header class="site-header">
          <div class="header-inner">
            <a class="wordmark" href={base} onClick={(event) => { event.preventDefault(); shop(); }}>
              <span class="brand-icon" aria-hidden="true"><i /><i /><i /><i /></span>
              <span class="wordmark-text">
                <span>よりみち<span class="brand-suffix">商店街</span></span>
                <small class="wordmark-caption">架空の商店街デモ</small>
              </span>
            </a>
            <nav class="site-nav" aria-label="メインメニュー">
              <button type="button" aria-current={screen() === "catalog" ? "page" : undefined} onClick={() => shop()}>商品</button>
              <button type="button" aria-current={screen() === "stores" ? "page" : undefined} onClick={() => navigate("stores")}>お店</button>
              <button type="button" aria-current={screen() === "town" ? "page" : undefined} onClick={() => navigate("town")}>街</button>
            </nav>
            <div class="header-actions">
              <Show when={!props.preview} fallback={<a class="header-link" href={`${base}notification-demo/`}>通知設定デモ</a>}>
                <button type="button" class="header-link" aria-current={screen() === "orders" ? "page" : undefined}
                  onClick={() => navigate("orders")}>注文履歴</button>
                <button type="button" class="header-link seller-link" aria-current={screen() === "seller" ? "page" : undefined}
                  onClick={() => navigate("seller")}>出店者ページ</button>
              </Show>
            </div>
            <ToneSwitcher initialTone={props.initialTone} />
          </div>
        </header>
        <div class="cart-dock">
          <Show when={announcement()}>
            <p class="cart-dock-feedback" aria-hidden="true">{announcement()}</p>
          </Show>
          <DialogTrigger class="cart-trigger">
            <span class="bag-icon" aria-hidden="true" />
            <span>カート</span>
            <span class="cart-count">{cartCount()}点</span>
            <strong class="cart-dock-total">{yen(total())}</strong>
          </DialogTrigger>
        </div>
        <DialogBackdrop class="cart-backdrop" />
        <DialogContent class="cart-dialog">
          <div class="drawer-heading">
            <DialogTitle>{receipt() ? "注文が確定しました" : checkout() ? "ご注文手続き" : "カート"}</DialogTitle>
            <DialogClose class="icon-button close-button" aria-label="カートを閉じる" disabled={pending()}>×</DialogClose>
          </div>
          <DialogDescription class="muted">{receipt() ? "注文内容は注文履歴でいつでも確認できます。" :
            checkout() ? "商品とお届け先を確認してください。" : `${cartCount()}点の商品が入っています。`}</DialogDescription>
          <Show when={cartError()}><p class="notice error" role="alert">{cartError()}</p></Show>
          <Show when={receipt()} fallback={
            <Show when={cartRows().length > 0} fallback={
              <div class="cart-empty">
                <p>{cartCount() > 0 ? "カートの商品を読み込めませんでした。" : "カートは空です。"}</p>
                <Show when={cartCount() > 0}>
                  <ActionButton variant="quiet" onClick={() => persistCart({})}>カートを空にする</ActionButton>
                </Show>
                <DialogClose class="inline-link">商品一覧へ戻る</DialogClose>
              </div>
            }>
              <ul class="cart-lines">
                <For each={cartRows()}>{(row) => (
                  <li>
                    <ProductImage product={row.product} small />
                    <div class="cart-line-main">
                      <span class="muted">{row.product.storeName}</span>
                      <strong>{row.product.name}</strong>
                      <Show when={!checkout()} fallback={<span class="muted">数量 {row.quantity}</span>}>
                        <div class="quantity-control">
                          <button type="button" aria-label={`${row.product.name}の数量を減らす`} onClick={() => setQuantity(row.product, row.quantity - 1)}>−</button>
                          <span aria-label="数量">{row.quantity}</span>
                          <button type="button" aria-label={`${row.product.name}の数量を増やす`}
                            disabled={row.quantity >= Math.min(quantityLimit, row.product.stock)}
                            onClick={() => setQuantity(row.product, row.quantity + 1)}>＋</button>
                        </div>
                      </Show>
                      <Show when={row.quantity > row.product.stock}><small class="error-text">在庫は残り {row.product.stock} 点です。</small></Show>
                    </div>
                    <strong>{yen(row.quantity * row.product.price)}</strong>
                  </li>
                )}</For>
              </ul>
              <Show when={unavailable() > 0 && !catalogLoading() && !catalogError()}>
                <p class="notice error">購入できない商品が {unavailable()} 種類あります。<button type="button" class="inline-link"
                  onClick={() => persistCart(Object.fromEntries(cartRows().map(({ product, quantity }) => [product.id, quantity])))}>
                  カートから外す
                </button></p>
              </Show>
              <div class="cart-total"><span>合計</span><strong>{yen(total())}</strong></div>
              <Show when={checkout()} fallback={
                <Show when={!props.preview} fallback={<p class="muted">注文はローカル版で試せます。</p>}>
                  <ActionButton class="full" disabled={!canOrder()} onClick={() => setCheckout(true)}>購入手続きへ</ActionButton>
                </Show>
              }>
                <Show when={session().buyer} fallback={
                  <div class="checkout-section">
                    <h3>購入者アカウント</h3>
                    <AccountForm role="buyer" signedIn={signedIn} />
                  </div>
                }>
                  {(buyer) => (
                    <form class="form-stack checkout-section" onSubmit={(event) => {
                      event.preventDefault();
                      void placeOrder(new FormData(event.currentTarget));
                    }}>
                      <h3>お届け先</h3>
                      <label>氏名<input name="recipient" autocomplete="name" value={buyer().name} maxlength="80" required /></label>
                      <label>郵便番号<input name="postalCode" autocomplete="postal-code" inputmode="numeric"
                        pattern="[0-9]{3}-?[0-9]{4}" placeholder="100-0001" required /></label>
                      <label>住所<textarea name="address" autocomplete="street-address" maxlength="250" rows="2" required /></label>
                      <p class="muted">ローカル注文です。実際の請求・配送はありません。</p>
                      <ActionButton type="submit" disabled={pending() || !canOrder()}>
                        {pending() ? "注文処理中…" : "注文を確定する"}
                      </ActionButton>
                    </form>
                  )}
                </Show>
                <button type="button" class="inline-link" disabled={pending()} onClick={() => { setCheckout(false); setCartError(""); }}>カートに戻る</button>
              </Show>
            </Show>
          }>
            {(order) => (
              <div class="receipt">
                <div class="receipt-mark" aria-hidden="true">✓</div>
                <strong>注文 {orderNumber(order().id)}</strong>
                <p>{order().lines.reduce((sum, line) => sum + line.quantity, 0)}点 ・ {yen(order().total)}</p>
                <ActionButton onClick={() => { setCartOpen(false); navigate("orders"); }}>注文履歴を見る</ActionButton>
              </div>
            )}
          </Show>
        </DialogContent>
      </Dialog>

      <main id="content" class="site-main">
        <div class="sr-only" role="status">{announcement()}</div>
        <Show when={props.preview}>
          <p class="notice muted">公開プレビューでは商品選び・カート・街の予定を体験できます。注文や出店はローカル版で試せます。</p>
        </Show>
        <Show when={screenError()}><p class="notice error" role="alert">{screenError()}</p></Show>
        <Switch>
          <Match when={screen() === "catalog"}>
            <Show when={!currentStore()} fallback={
              <div class="work-title">
                <div><h1>{currentStore()?.name}</h1><p>{currentStore()?.description}</p></div>
                <ActionButton variant="quiet" onClick={() => shop()}>すべてのお店の商品へ</ActionButton>
              </div>
            }>
              <section class="hero" aria-labelledby="hero-title">
                <div class="hero-copy">
                  <p class="hero-kicker">買い物と街の予定</p>
                  <h1 id="hero-title">よりみち<br />商店街デモ</h1>
                  <p>架空のお店で商品を選び、気になる商品や街のイベントを保存できます。</p>
                  <a class="hero-action" href="#products">商品を探す<span aria-hidden="true">↘</span></a>
                </div>
                <div class="hero-art"><img src={`${base}market/hero-cobalt.jpg`} alt="" fetchpriority="high" /></div>
              </section>
            </Show>
            <section class="catalog-section" id="products" aria-labelledby="products-title">
              <div class="section-heading">
                <div>
                  <h2 id="products-title">{currentStore() ? "お店の商品" : "商品を探す"}</h2>
                  <p>{visibleProducts().length} 件の商品</p>
                </div>
                <label class="search-field"><span class="sr-only">商品やお店を検索</span>
                  <input type="search" placeholder="商品やお店を検索" value={search()} onInput={(event) => setSearch(event.currentTarget.value)} />
                </label>
              </div>
              <div class="catalog-toolbar">
                <div class="category-filter" aria-label="商品カテゴリ">
                  <button type="button" aria-pressed={category() === "all" ? "true" : "false"} onClick={() => setCategory("all")}>すべて</button>
                  <For each={categoryKeys}>{(key) => (
                    <button type="button" aria-pressed={category() === key ? "true" : "false"} onClick={() => setCategory(key)}>{categories[key]}</button>
                  )}</For>
                </div>
                <button class="selection-action" type="button" disabled={selected().length === 0} onClick={addSelected}>
                  選択した商品をカートに入れる{selected().length > 0 ? `（${selected().length}）` : ""}
                </button>
              </div>
              <Show when={catalogError()}>
                <div class="notice error" role="alert">{catalogError()} <button class="inline-link" type="button" onClick={() => void refreshCatalog()}>再読み込み</button></div>
              </Show>
              <Show when={!catalogLoading()} fallback={<p class="empty" role="status">商品を読み込んでいます。</p>}>
                <div class="product-grid">
                  <For each={visibleProducts()} fallback={<Show when={!catalogError()}><p class="empty">該当する商品がありません。</p></Show>}>
                    {(product) => (
                      <article class="product-card">
                        <div class="product-visual">
                          <ProductImage product={product} />
                          <label class="product-select" title="まとめてカートに入れる商品を選択">
                            <input type="checkbox" checked={selected().includes(product.id)} disabled={product.stock === 0}
                              aria-label={`${product.name}を選択`}
                              onChange={(event) => {
                                const checked = event.currentTarget.checked;
                                setSelected((ids) => checked ? [...ids, product.id] : ids.filter((id) => id !== product.id));
                              }} />
                          </label>
                        </div>
                        <div class="product-copy">
                          <div class="product-meta">
                            <button class="store-reference" type="button" onClick={() => shop(product.storeId)}>{product.storeName}</button>
                            <ProductSave name={product.name} saved={saves().products.includes(product.id)}
                              onChange={(saved) => saveProduct(product.id, saved)} />
                          </div>
                          <h3>{product.name}</h3>
                          <p>{product.description}</p>
                          <div class="product-bottom">
                            <strong>{yen(product.price)}</strong>
                            <Show when={product.stock > 0} fallback={<span class="out-of-stock">在庫なし</span>}>
                              <button class="add-button" type="button" aria-label={`${product.name}をカートに入れる`}
                                data-added={addedProduct() === product.id ? "true" : undefined}
                                disabled={(cart()[product.id] ?? 0) >= Math.min(quantityLimit, product.stock)}
                                onClick={() => addProduct(product)}>
                                <span aria-hidden="true">{addedProduct() === product.id ? "✓" : "＋"}</span>
                              </button>
                            </Show>
                          </div>
                        </div>
                      </article>
                    )}
                  </For>
                </div>
              </Show>
            </section>
          </Match>
          <Match when={screen() === "stores"}>
            <section class="work-area" aria-labelledby="stores-title">
              <div class="work-title">
                <div><h1 id="stores-title">お店を探す</h1><p>よりみち商店街に集まる、小さなお店。</p></div>
                <Show when={!props.preview}>
                  <ActionButton variant="quiet" onClick={() => navigate("seller")}>お店を出店する</ActionButton>
                </Show>
              </div>
              <div class="store-grid">
                <For each={catalog().stores} fallback={<p class="empty">出店中のお店がありません。</p>}>
                  {(store) => (
                    <article class="panel store-card">
                      <h2>{store.name}</h2><p>{store.description}</p>
                      <ActionButton variant="quiet" onClick={() => shop(store.id)}>お店の商品を見る</ActionButton>
                    </article>
                  )}
                </For>
              </div>
            </section>
          </Match>
          <Match when={screen() === "town"}>
            <Town products={catalog().products.filter((product) => saves().products.includes(product.id))}
              events={saves().events} saveProduct={saveProduct} planEvent={planEvent} showProduct={(product) => {
                shop(product.storeId);
                setSearch(product.name);
              }} />
          </Match>
          <Match when={screen() === "seller"}>
            <SellerPanel seller={session().seller} dashboard={dashboard()} refresh={refreshSeller}
              signedIn={signedIn} logout={() => logOut("seller")} />
          </Match>
          <Match when={screen() === "orders"}>
            <section class="work-area" aria-labelledby="orders-title">
              <div class="work-title">
                <div><h1 id="orders-title">注文履歴</h1><p>購入した商品とお届け先を確認できます。</p></div>
                <Show when={session().buyer}>
                  {(buyer) => (
                    <div class="account-badge"><span>{buyer().name}</span><ActionButton variant="quiet" onClick={() => void logOut("buyer")}>ログアウト</ActionButton></div>
                  )}
                </Show>
              </div>
              <Show when={session().buyer} fallback={
                <div class="panel account-panel">
                  <h2>購入者アカウント</h2>
                  <AccountForm role="buyer" signedIn={signedIn} />
                </div>
              }>
                <OrderList orders={orders()} />
              </Show>
            </section>
          </Match>
        </Switch>
      </main>

      <footer class="site-footer">
        <span>よりみち商店街</span>
        <Show when={!props.preview} fallback={<a class="inline-link" href={`${base}THIRD_PARTY_LICENSES.md`}>第三者ライセンス</a>}>
          <button type="button" class="inline-link" onClick={() => navigate("seller")}>お店を出店する</button>
        </Show>
      </footer>
    </>
  );
}
