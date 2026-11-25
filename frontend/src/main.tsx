import { render } from "@solidjs/web";
import { NotificationSettings } from "./NotificationSettings";
import { Marketplace } from "./market/Marketplace";
import "./reset.css";
import "./market/market-tones.css";
import "./market/market.css";

const notificationPath = `${import.meta.env.BASE_URL}notification-demo`;
const notificationDemo = location.pathname === notificationPath || location.pathname === `${notificationPath}/`;
if (notificationDemo) document.title = "通知設定デモ";
render(
  () => notificationDemo ? <NotificationSettings /> : <Marketplace preview={import.meta.env.MODE === "pages"} />,
  document.getElementById("app")!,
);
