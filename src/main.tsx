import { render } from "@solidjs/web";
import { NotificationSettings } from "./NotificationSettings";
import { Marketplace } from "./market/Marketplace";
import "./reset.css";
import "./market/market.css";

const notificationDemo = location.pathname === "/notification-demo";
render(() => notificationDemo ? <NotificationSettings /> : <Marketplace />, document.getElementById("app")!);
