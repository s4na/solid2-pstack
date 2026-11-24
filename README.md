# よりみち商店街

Solid 2.0 と Go で動く、ローカルの複数店舗マーケットです。出店者はお店を開き、商品を公開して在庫と受注を管理できます。購入者は別のアカウントで複数のお店の商品をカートに入れ、まとめて注文できます。

Solid の画面とブラウザ検証は `frontend/`、Go API と SQLite の定義は `backend/` にあります。以下のコマンドはリポジトリのルートから実行します。

## Mac で起動する

Docker と Docker Compose、Node.js 24 LTS、`frontend/package.json` に記載の pnpm が必要です。

```sh
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend build
docker compose up -d --build --wait
```

[http://127.0.0.1:8088](http://127.0.0.1:8088) を開きます。Go が API と `frontend/dist/` にビルドした画面を同じポートで配信します。別のポートを使う場合は `MARKET_PORT` を指定します。画面を編集する場合は、Go を起動した状態で `pnpm --dir frontend dev` を実行できます。

### 購入を試す

1. 商品の **＋** を押すと、右下のカートに追加した商品名・点数・合計が表示されます。まとめて追加するには、写真左上のチェックを入れて **選択した商品をカートに入れる**を押します。
2. 右下の **カート**で数量を確認し、**購入手続きへ → 購入者デモで試す**へ進みます。購入者アカウントは新規登録でも作れます。
3. 氏名とローカル検証用の郵便番号・住所を入力し、**注文を確定する**を押します。注文番号が表示され、**注文履歴を見る**から内容を確認できます。

注文、在庫、アカウントは SQLite に保存されます。実際の請求・配送はありません。

### 出店を試す

**出店者ページ → 出店者デモで試す**から、お店の名前と紹介を入力して出店します。商品名・説明・カテゴリ・価格・在庫を入力して商品を公開すると、商品一覧に表示されます。出店者ページの受注一覧には自分のお店の明細が表示されます。購入者と出店者は別々にログイン・ログアウトできます。

| ローカルデモ | メールアドレス | パスワード |
| --- | --- | --- |
| 購入者 | `buyer@example.test` | `yorimichi-demo` |
| 出店者 | `seller@example.test` | `yorimichi-demo` |

デモ以外のアカウントは各画面の **新規登録**から作れます。新しいデータボリュームでサンプル登録を省く場合は、起動時に `DEMO_ACCOUNTS=0` を指定します。

```sh
docker compose stop
```

停止後も注文と在庫は Docker の `marketplace-data` ボリュームに残ります。

## 検証

```sh
pnpm --dir frontend exec playwright install chromium
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend test:e2e
pnpm --dir frontend test:market
(cd backend && go test -race ./...)
```

`test:market` は起動中の Go バックエンドを使い、2店舗で商品を公開し、購入者がまとめて注文して、購入者・出店者それぞれの画面で確認するテストです。実行ごとに検証用アカウント、商品、注文が追加されます。別ポートを使う場合は `MARKET_URL` に起動先を指定します。Go のテストは在庫不足時のロールバック、価格の再検証、再送時の重複防止、同時購入を確認します。

Solid の基礎サンプルは `/notification-demo` にあります。Storybook は `pnpm --dir frontend storybook`、通知サンプルのモデル照合は `pnpm --dir frontend verify:model` で実行できます。

## APM と PR

```sh
brew install microsoft/apm/apm
apm install --frozen
```

APM は pstack の選択した Skill を上流のコミットに固定し、このプロジェクトの Skill とともに `.agents/skills/` へ配置します。プロジェクトの Skill の正本は `.apm/skills/` です。Codex で PR を作る際は `$opening-a-pr` を呼び出します。 [Opening a PR](.apm/skills/opening-a-pr/SKILL.md)・[検証 Skill](.apm/skills/verify-solid2-pstack/SKILL.md)

## 画面素材とデザイン

画面の写真は ImageGen で作成したローカル素材です。トップは「コバルトブルーのスタジオでアイボリーの陶器、琥珀色のキャンドル、レモン色のリネンを撮影」、商品写真は「マグ・キャンドル・リネン・皿を、それぞれ青や淡い黄色の背景で4分割撮影」という指示で生成しました。 [トップ画像](frontend/public/market/hero-cobalt.jpg)・[商品写真](frontend/public/market/catalog-cobalt.jpg)

画面の操作部品は [Geist Design System](https://vercel.com/geist/introduction) と [Web Interface Guidelines](https://vercel.com/design/guidelines) を参考にしています。Geist Sans v1.9.2 は同梱した [SIL Open Font License](frontend/public/market/fonts/OFL.txt) に従います。
