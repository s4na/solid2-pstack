import { render } from "@solidjs/web";
import { NotificationSettings } from "./NotificationSettings";
import { Marketplace } from "./market/Marketplace";
import { loadInitialTone } from "./market/tones";
import "./reset.css";
import "./market/market.css";
import "./market/town.css";

const notificationPath = `${import.meta.env.BASE_URL}notification-demo`;
const notificationDemo = location.pathname === notificationPath || location.pathname === `${notificationPath}/`;
const app = document.getElementById("app")!;
if (notificationDemo) {
  document.title = "通知設定デモ";
  render(() => <NotificationSettings />, app);
} else {
  void loadInitialTone().then(
    (initialTone) => render(() => (
      <Marketplace preview={import.meta.env.MODE === "pages"} initialTone={initialTone} />
    ), app),
    () => render(() => (
      <main class="site-main">
        <p role="alert">トンマナを読み込めませんでした。 <a href={location.href}>再読み込み</a></p>
      </main>
    ), app),
  );
}
