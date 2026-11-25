---
name: verify-solid2-pstack
description: よりみち商店街の出店・購入と、通知サンプルの操作・アクセシビリティ・見た目・状態遷移を検証する。
---

# solid2-pstack の検証

## セットアップ

README の手順でロック済みの依存関係、APM Skill、Playwright Chromium を揃える。Skill の正本は `.apm/skills/` にある。APM と以下の検証コマンドはリポジトリのルートで実行する。編集後は `apm install` で Codex 用の配置を更新する。

## 起動と確認

- よりみち商店街は README に従って Docker Compose で起動する。商品一覧と `/api/health` を確認する。
- 通知サンプルを単独で確認する場合は `pnpm --dir frontend dev --host 127.0.0.1 --strictPort` で起動し、Vite の URL に `/notification-demo` を付けて開く。
- Storybook は `pnpm --dir frontend storybook --host 127.0.0.1 --ci` で起動し、`Settings / Notifications` の Off と On を開く。各 Story の Accessibility パネルで該当する状態を確認する。
- この作業で起動したプロセスだけを停止する。自動テストでは Playwright がテスト用サーバーを終了する。

## 実行と証跡

| 検証 | コマンド | 確認すること |
| --- | --- | --- |
| 型 | `pnpm --dir frontend typecheck` | アプリ・テスト・構成の型が通る |
| 振る舞いとモデル | `pnpm --dir frontend test` | Chromium の操作、fast-check の操作列、モデルと実装の全入力の照合 |
| モデルだけ | `pnpm --dir frontend verify:model` | `frontend/models/Notifications.tla` が検証する4通りの遷移と `frontend/src/notifications.ts` の一致 |
| 出店・購入 E2E | `pnpm --dir frontend test:market` | Docker の Go で出店、商品公開、注文、受注、在庫更新を確認 |
| 商店街の見た目 | `sh frontend/scripts/build-pages.sh /solid2-pstack/` の後に `pnpm --dir frontend test:tones` | 全トンマナで商品・街・保存の3画面をスマホと PC で開き、axe-core の検査と横方向のはみ出しを確認し、HTML レポートに実画面を残す |
| Go 注文テスト | `(cd backend && go test -race ./...)` | 在庫不足、価格変更、再送、同時注文時の挙動 |
| 通知 E2E・Storybook | `pnpm --dir frontend test:e2e` | ビルドしたアプリのキーボード操作、Story の axe-core 検査、状態インジケーターの画像差分 |

Playwright の HTML レポートでは Story 全体の画像を確認できる。画像差分が出たら、実画像と期待画像を見て意図した変更か判断する。fast-check は固定シードで操作列を生成する。失敗した入力だけを再現するには、出力された `seed` と `path` を `fc.assert` のオプションに指定する。PR には実行したコマンド、結果、未確認の範囲を記載する。

機能ごとの操作と期待結果は [機能一覧](features/README.md) を参照する。
