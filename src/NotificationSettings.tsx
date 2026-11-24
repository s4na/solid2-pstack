import * as stylex from "@stylexjs/stylex";
import { Button } from "@ui-sdk/solid/button";
import { Toggle } from "@ui-sdk/solid/toggle";
import { createSignal, createUniqueId } from "solid-js";
import { nextNotificationState, type NotificationAction } from "./notifications";

export function NotificationSettings(props: { initiallyEnabled?: boolean }) {
  const [enabled, setEnabled] = createSignal(props.initiallyEnabled ?? false);
  const titleId = createUniqueId();

  function dispatch(action: NotificationAction) {
    setEnabled((previous) => nextNotificationState(previous, action));
  }

  return (
    <main class={stylex.props(styles.page).className}>
      <section aria-labelledby={titleId} class={stylex.props(styles.panel).className}>
        <header class={stylex.props(styles.header).className}>
          <h1 id={titleId} class={stylex.props(styles.heading).className}>通知設定</h1>
          <p class={stylex.props(styles.description).className}>
            設定はこのページを開いている間だけ保持されます。
          </p>
        </header>
        <div class={stylex.props(styles.controls).className}>
          <Toggle
            pressed={enabled()}
            onPressedChange={() => dispatch("toggle")}
            class={stylex.props(styles.toggle, enabled() && styles.enabled).className}
          >
            <span
              aria-hidden="true"
              data-testid="notification-indicator"
              class={stylex.props(styles.indicator, enabled() && styles.activeIndicator).className}
            />
            通知を受け取る
          </Toggle>
          <Button
            type="button"
            onClick={() => dispatch("reset")}
            class={stylex.props(styles.reset).className}
          >
            リセット
          </Button>
        </div>
        <p role="status" class={stylex.props(styles.status).className}>
          {enabled() ? "通知はオンです" : "通知はオフです"}
        </p>
      </section>
    </main>
  );
}

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    backgroundColor: "#f3f5ef",
    color: "#1e2c24",
    fontFamily: 'system-ui, "Hiragino Sans", sans-serif',
  },
  panel: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "510px",
    padding: "clamp(24px, 6vw, 44px)",
    border: "1px solid #d7ddd3",
    borderRadius: "20px",
    backgroundColor: "#fff",
    boxShadow: "0 18px 44px #24332612",
  },
  header: { marginBottom: "28px" },
  heading: {
    margin: 0,
    fontSize: "clamp(25px, 5vw, 33px)",
    lineHeight: 1.3,
  },
  description: {
    margin: "10px 0 0",
    color: "#48564e",
    fontSize: "14px",
    lineHeight: 1.65,
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  toggle: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    minHeight: "44px",
    appearance: "none",
    padding: "0 14px",
    border: "1px solid #74847a",
    borderRadius: "9px",
    color: "#23342a",
    backgroundColor: "#fff",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 650,
    cursor: "pointer",
    outline: { default: "none", ":focus-visible": "3px solid #287054" },
    outlineOffset: "3px",
  },
  enabled: {
    borderColor: "#236346",
    backgroundColor: "#236346",
    color: "#fff",
  },
  indicator: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#65786c",
  },
  activeIndicator: { backgroundColor: "#d9f48a" },
  reset: {
    minHeight: "44px",
    appearance: "none",
    padding: "0 12px",
    border: "1px solid transparent",
    borderRadius: "9px",
    color: "#2a513b",
    backgroundColor: { default: "transparent", ":hover": "#edf3eb" },
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 650,
    cursor: "pointer",
    outline: { default: "none", ":focus-visible": "3px solid #287054" },
    outlineOffset: "3px",
  },
  status: {
    margin: "16px 0 0",
    color: "#48564e",
    fontSize: "14px",
    lineHeight: 1.5,
  },
});
