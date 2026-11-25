import { render } from "@solidjs/web";
import { NotificationSettings } from "./NotificationSettings";
import { Marketplace } from "./market/Marketplace";
import "./reset.css";
import "./market/market-tones.css";
import "./market/market.css";

const notificationDemo = location.pathname === "/notification-demo";
if (notificationDemo) document.title = "通知設定デモ";
render(() => notificationDemo ? <NotificationSettings /> : <Marketplace />, document.getElementById("app")!);
