import * as stylex from "@stylexjs/stylex";
import { Button } from "@ui-sdk/solid/button";
import type { JSX } from "@solidjs/web";
import { createSignal, For, Show } from "solid-js";
import {
  api, categories, dateLabel, errorMessage, field, orderNumber, yen,
  type Order, type Product, type Role,
} from "./api";

export function ActionButton(props: {
  children: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "quiet" | "light";
  class?: string;
}) {
  return (
    <Button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      class={[
        stylex.props(
          actions.base,
          props.variant === "quiet" && actions.quiet,
          props.variant === "light" && actions.light,
        ).className,
        props.class,
      ].filter(Boolean).join(" ")}
    >
      {props.children}
    </Button>
  );
}

const actions = stylex.create({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "var(--control-height)",
    padding: "10px 16px",
    borderRadius: "var(--control-radius)",
    border: "1px solid var(--brand)",
    backgroundColor: { default: "var(--brand)", ":hover": "var(--brand-hover)", ":active": "var(--brand-pressed)" },
    color: "var(--brand-on)",
    fontFamily: "inherit",
    fontSize: "var(--action-size)",
    fontWeight: 700,
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":disabled": 0.52 },
  },
  quiet: {
    backgroundColor: { default: "var(--paper)", ":hover": "var(--hover)", ":active": "var(--pressed)" },
    color: "var(--accent-ink)",
    borderColor: "var(--control-line)",
  },
  light: {
    backgroundColor: { default: "var(--paper)", ":hover": "var(--hover)", ":active": "var(--pressed)" },
    color: "var(--ink)",
    borderColor: "var(--paper)",
  },
});

export function AccountForm(props: { role: Role; signedIn: () => Promise<void> }) {
  const [register, setRegister] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const roleName = () => props.role === "buyer" ? "購入者" : "出店者";

  async function authenticate(values?: FormData) {
    if (busy()) return;
    setBusy(true);
    setError("");
    const signUp = values !== undefined && register();
    const email = values ? field(values, "email") : `${props.role}@example.test`;
    const password = values ? field(values, "password") : "yorimichi-demo";
    try {
      await api(signUp ? `/accounts/${props.role}` : `/login/${props.role}`, "POST", {
        email, password, ...(signUp && values ? { name: field(values, "name") } : {}),
      });
      await props.signedIn();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="account-form">
      <div class="switcher" aria-label={`${roleName()}のアカウント操作`}>
        <button type="button" aria-pressed={register() ? "false" : "true"} onClick={() => { setRegister(false); setError(""); }}>ログイン</button>
        <button type="button" aria-pressed={register() ? "true" : "false"} onClick={() => { setRegister(true); setError(""); }}>新規登録</button>
      </div>
      <form class="form-stack" onSubmit={(event) => {
        event.preventDefault();
        void authenticate(new FormData(event.currentTarget));
      }}>
        <Show when={register()}>
          <label>名前<input name="name" autocomplete="name" maxlength="60" required /></label>
        </Show>
        <label>メールアドレス<input type="email" name="email" autocomplete="email" maxlength="254" required /></label>
        <label>パスワード<input type="password" name="password" autocomplete={register() ? "new-password" : "current-password"}
          minlength={register() ? 8 : undefined} maxlength="128" required /></label>
        <Show when={error()}><p class="notice error" role="alert">{error()}</p></Show>
        <ActionButton type="submit" disabled={busy()}>
          {register() ? `${roleName()}として登録する` : `${roleName()}としてログイン`}
        </ActionButton>
        <Show when={!register()}>
          <ActionButton variant="quiet" disabled={busy()} onClick={() => void authenticate()}>
            {roleName()}デモで試す
          </ActionButton>
        </Show>
      </form>
    </div>
  );
}

export function ProductImage(props: { product: Product; small?: boolean }) {
  const imageClass = () => ["mug", "candle", "linen", "plate"].includes(props.product.image) ? props.product.image : "empty";
  return (
    <div
      class={`product-image ${imageClass()} ${props.small ? "small" : ""}`}
      role="img"
      aria-label={imageClass() === "empty" ? `${props.product.name}（写真なし）` : props.product.name}
    >
      <Show when={imageClass() === "empty"}><span aria-hidden="true">{categories[props.product.category]}</span></Show>
    </div>
  );
}

export function OrderList(props: { orders: Order[]; seller?: boolean }) {
  return (
    <div class="order-list">
      <For each={props.orders} fallback={<p class="empty">まだ注文がありません。</p>}>
        {(order) => (
          <article class="order-card">
            <header><strong>注文 {orderNumber(order.id)}</strong><span>{dateLabel(order.createdAt)}</span></header>
            <ul>
              <For each={order.lines}>{(line) => (
                <li>
                  <span>{line.productName} <small>{props.seller ? "" : line.storeName} ×{line.quantity}</small></span>
                  <strong>{yen(line.unitPrice * line.quantity)}</strong>
                </li>
              )}</For>
            </ul>
            <footer><span>お届け先 {order.recipient} 様</span><strong>{yen(order.total)}</strong></footer>
            <p class="muted order-address">〒{order.postalCode} {order.address}</p>
          </article>
        )}
      </For>
    </div>
  );
}
