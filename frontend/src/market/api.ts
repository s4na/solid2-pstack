export type Role = "buyer" | "seller";

export interface Buyer {
  id: number;
  name: string;
  email: string;
}

export interface Seller {
  id: number;
  name: string;
  email: string;
}

export interface Session {
  buyer: Buyer | null;
  seller: Seller | null;
}

export interface Store {
  id: number;
  name: string;
  description: string;
}

export const categories = {
  table: "器・食卓",
  scent: "香り",
  fabric: "布もの",
  other: "そのほか",
} as const;

export type Category = keyof typeof categories;
export const categoryKeys = Object.keys(categories) as Category[];

export interface Product {
  id: number;
  storeId: number;
  storeName: string;
  name: string;
  description: string;
  category: Category;
  image: string;
  price: number;
  stock: number;
}

export interface Catalog {
  stores: Store[];
  products: Product[];
}

export interface OrderLine {
  productId: number;
  productName: string;
  storeName: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: number;
  recipient: string;
  postalCode: string;
  address: string;
  createdAt: string;
  total: number;
  lines: OrderLine[];
}

export interface SellerDashboard {
  store: Store | null;
  products: Product[];
  orders: Order[];
}

export interface CartRow {
  product: Product;
  quantity: number;
}

export class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw new RequestError(response.status, data?.error ?? "サーバーに接続できませんでした。");
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof RequestError ? error.message : "接続できませんでした。少し待ってからもう一度お試しください。";
}

const currency = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });
const orderDate = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });
export const yen = (value: number) => currency.format(value);
export const dateLabel = (value: string) => orderDate.format(new Date(value));
export const orderNumber = (id: number) => `#${String(id).padStart(5, "0")}`;

export function field(values: FormData, name: string): string {
  const value = values.get(name);
  return typeof value === "string" ? value : "";
}
