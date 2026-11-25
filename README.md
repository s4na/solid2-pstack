# Solid 2.0 × pstack 検証リポジトリ

**公開デモ（GitHub Pages）** [https://s4na.github.io/solid2-pstack/](https://s4na.github.io/solid2-pstack/)

[Solid 2.0](https://www.solidjs.com/blog/solid-2-0-the-long-hold/) でアプリを実装し、[pstack](https://github.com/cursor/plugins/blob/005d8f6e8ec057b738adcd08a08b30db0478402d/pstack/README.md) の開発手法を試すためのリポジトリです。人と AI エージェントが同じ手順で動作を再現し、振る舞いを検証できるかを、通知設定のサンプルと複数店舗のマーケットで試します。

画面と操作は Storybook、Vitest Browser Mode、Playwright で確認します。通知設定では fast-check で操作列を検証し、TLA+ の状態遷移モデルと TypeScript の実装も照合します。pstack の検証・振り返り Skill は APM で導入します。

## GitHub Pages の公開デモ

よりみち商店街デモでは、架空の店舗・商品の閲覧、検索、カート、トンマナの切り替えを試せます。[通知設定デモ](https://s4na.github.io/solid2-pstack/notification-demo/) も公開しています。注文や出店は下記のローカル版で体験できます。

`main` の更新時に、GitHub Actions の [GitHub Pages ワークフロー](.github/workflows/pages.yml) がフロントエンドと公開用の商品データをビルドして公開します。商品データはローカル版と同じデモデータから生成されます。

公開物にはこのリポジトリの MIT ライセンスと、同梱ライブラリのライセンス一覧を含めます。Solid 本体と Web ランタイムの MIT ライセンスは [公開バージョンのソース](https://github.com/solidjs/solid/blob/a8186e6738b3a6a3341c561f66e9325432d6759b/LICENSE) から同梱しています。

## 架空の商店街デモ「よりみち商店街」

Solid 2.0 と Go で、架空の複数店舗マーケットをローカルで体験できます。出店者はお店を開き、商品を公開して在庫と受注を管理できます。購入者は別のアカウントで複数のお店の商品をカートに入れ、まとめて注文できます。

ヘッダー右側で13種類のトンマナを切り替え、同じ商品と UI SDK の操作を見比べられます。「モノ」「クラフト」「ナイト」はボタンから、追加の10種類は隣の「ほか」から選べます。最後の選択は使っているブラウザに保存されます。

| トンマナ | 表現 |
| --- | --- |
| モノ | 白黒写真と大きな太字見出しの雑誌風 |
| クラフト | 明朝体と大きな正方形写真のカタログ |
| ナイト | 写真に文字を重ねたトップと横長の商品カード |
| 売り場 | 大きな価格表示と密度の高い商品グリッド |
| 技術誌 | 横長のサムネイルと余白を生かした記事一覧風 |
| 作業台 | 商品を罫線で区切り、名前・説明・価格をそろえた一覧 |
| ストア | 大きく丸めた写真と明朝体を使ったショーケース |
| パルス | 大きな太字と斜めに切り取った写真のキャンペーン風 |
| ターミナル | 深緑と等幅書体を使った暗色の一覧 |
| アトラス | 額縁付きの写真と青緑の紙面を合わせた図鑑風 |
| デスク | 価格やカート操作を素早く追えるコンパクトな一覧 |
| ギャラリー | 大きな横長写真を中心に見せる展示風 |
| フィールド | オリーブ色と自然な質感の写真を使った屋外誌風 |

配色・書体・レイアウトは [tones ディレクトリ](frontend/src/market/tones/) に1種類ずつCSSでまとめています。商店街は初回表示に必要なCSSだけを読み込み、別のトンマナは初めて選んだときに読み込みます。

Solid の画面とブラウザ検証は `frontend/`、Go API と SQLite の定義は `backend/` にあります。以下のコマンドはリポジトリのルートから実行します。

## Mac で起動する

Docker と Docker Compose、Node.js 26 LTS（26.13.1 以降）、`frontend/package.json` に記載の pnpm が必要です。

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

## ライセンス

このリポジトリのオリジナル部分は [MIT License](LICENSE) で公開しています。第三者の素材と依存パッケージには、それぞれのライセンスが適用されます。

### 出典と第三者ライセンス

- **pstack** は Lauren Tan（[poteto](https://x.com/poteto)）さんのプロジェクトです。APM は [`cursor/plugins` の固定コミット](https://github.com/cursor/plugins/tree/005d8f6e8ec057b738adcd08a08b30db0478402d/pstack) から Skill を取得し、上流の [MIT ライセンス](https://github.com/cursor/plugins/blob/005d8f6e8ec057b738adcd08a08b30db0478402d/pstack/LICENSE) と一緒に配置します。
- **PR 手順の Skill** は pstack の [Opening a PR プレイブック](https://github.com/cursor/plugins/blob/005d8f6e8ec057b738adcd08a08b30db0478402d/pstack/skills/poteto-mode/playbooks/opening-a-pr.md) をもとに、このリポジトリの検証・レビュー手順に合わせたものです。[上流の著作権表示と MIT ライセンス全文](.apm/skills/opening-a-pr/LICENSE)を同梱しています。
- **Geist Sans** は The Geist Project Authors による [v1.9.2 の可変フォント](https://github.com/vercel/geist-font/blob/v1.9.2/packages/next/dist/fonts/geist-sans/Geist-Variable.woff2) を同梱しています。[著作権表示と SIL Open Font License 1.1](frontend/public/market/fonts/OFL.txt) はフォントと同じディレクトリにあります。
- **デザインの参考資料** は Vercel の [Geist Design System](https://vercel.com/geist/introduction) と [Web Interface Guidelines](https://vercel.com/design/guidelines) です。
- **パッケージ依存**のバージョンは [フロントエンドのロックファイル](frontend/pnpm-lock.yaml) と [Go のモジュール定義](backend/go.mod) で確認できます。各依存パッケージにはそれぞれのライセンスが適用されます。

画面の写真はこのデモ用に ImageGen で生成しました。トップは「コバルトブルーのスタジオでアイボリーの陶器、琥珀色のキャンドル、レモン色のリネンを撮影」、商品写真は「マグ・キャンドル・リネン・皿を、それぞれ青や淡い黄色の背景で4分割撮影」という指示で生成しました。 [トップ画像](frontend/public/market/hero-cobalt.jpg)・[商品写真](frontend/public/market/catalog-cobalt.jpg)
