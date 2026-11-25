import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/solid/tabs";
import { Toggle } from "@ui-sdk/solid/toggle";
import { For } from "solid-js";
import { type Product, yen } from "./api";
import { ActionButton, ProductImage } from "./components";
import { type TownEvent, townEvents } from "./townSaves";

export function ProductSave(props: { name: string; saved: boolean; onChange: (saved: boolean) => void }) {
  return (
    <Toggle class="save-toggle" aria-label={`${props.name}を保存`} pressed={props.saved} onPressedChange={props.onChange}>
      <span aria-hidden="true">{props.saved ? "★" : "☆"}</span>
    </Toggle>
  );
}

export function Town(props: {
  products: Product[];
  events: TownEvent["id"][];
  saveProduct: (id: number, saved: boolean) => void;
  planEvent: (id: TownEvent["id"], planned: boolean) => void;
  showProduct: (product: Product) => void;
}) {
  return (
    <section class="work-area town" aria-labelledby="town-title">
      <div class="work-title">
        <div><h1 id="town-title">街の予定と保存</h1><p>架空のイベントと気になる商品をこのブラウザに保存できます。</p></div>
      </div>
      <Tabs defaultValue="events">
        <TabsList class="town-tabs" aria-label="街のメニュー">
          <TabsTab class="town-tab" value="events">イベント</TabsTab>
          <TabsTab class="town-tab" value="saved">保存リスト</TabsTab>
        </TabsList>
        <TabsPanel value="events">
          <div class="town-events">
            <For each={townEvents}>{(event) => (
              <article class="panel town-event">
                <p class="town-event-time">{event.time}<span>{event.place}</span></p>
                <h2>{event.title}</h2>
                <p>{event.detail}</p>
                <Toggle class="event-toggle" aria-label={`${event.title}の参加予定`}
                  pressed={props.events.includes(event.id)} onPressedChange={(value) => props.planEvent(event.id, value)}>
                  {props.events.includes(event.id) ? "参加予定 ✓" : "参加予定にする"}
                </Toggle>
              </article>
            )}</For>
          </div>
        </TabsPanel>
        <TabsPanel value="saved">
          <div class="town-saved">
            <section aria-labelledby="saved-products-title">
              <h2 id="saved-products-title">保存した商品</h2>
              <ul class="town-list">
                <For each={props.products} fallback={<li class="muted">商品カードの星を押すとここに表示されます。</li>}>
                  {(product) => (
                    <li class="panel town-saved-product">
                      <ProductImage product={product} small />
                      <div class="town-saved-description">
                        <h3>{product.name}</h3>
                        <p class="muted">{product.storeName} ・ {yen(product.price)}</p>
                        <ActionButton variant="quiet" onClick={() => props.showProduct(product)}>商品を見る</ActionButton>
                      </div>
                      <ProductSave name={product.name} saved onChange={(value) => props.saveProduct(product.id, value)} />
                    </li>
                  )}
                </For>
              </ul>
            </section>
            <section aria-labelledby="planned-events-title">
              <h2 id="planned-events-title">参加予定</h2>
              <ul class="town-list">
                <For each={townEvents.filter(({ id }) => props.events.includes(id))}
                  fallback={<li class="muted">イベントを参加予定にするとここに表示されます。</li>}>
                  {(event) => (
                    <li class="panel town-saved-event">
                      <h3>{event.title}</h3>
                      <p class="muted">{event.time} ・ {event.place}</p>
                      <ActionButton variant="quiet" onClick={() => props.planEvent(event.id, false)}>予定から外す</ActionButton>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </div>
        </TabsPanel>
      </Tabs>
    </section>
  );
}
