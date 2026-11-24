---
name: verify-solid2-pstack
description: 通知設定の操作・アクセシビリティ・見た目・状態遷移を再現可能な手順で検証する。
---

# solid2-pstack の検証

## セットアップ

README の手順でロック済みの依存関係、APM Skill、Playwright Chromium を揃える。Skill の正本は `.apm/skills/` にある。編集後は `apm install` で Codex 用の配置を更新する。

## 起動と確認

- アプリは `pnpm dev --host 127.0.0.1 --strictPort` で起動し、Vite が示す URL を開く。「通知設定」と「通知はオフです」が表示されることを確認する。
- Storybook は `pnpm storybook --host 127.0.0.1 --ci` で起動し、`Settings / Notifications` の Off と On を開く。各 Story の Accessibility パネルで該当する状態を確認する。
- この作業で起動したプロセスだけを停止する。自動テストでは Playwright がテスト用サーバーを終了する。

## 実行と証跡

| 検証 | コマンド | 確認すること |
| --- | --- | --- |
| 型 | `pnpm typecheck` | アプリ・テスト・構成の型が通る |
| 振る舞いとモデル | `pnpm test` | Chromium の操作、fast-check の操作列、モデルと実装の全入力の照合 |
| モデルだけ | `pnpm verify:model` | `models/Notifications.tla` が検証する4通りの遷移と `src/notifications.ts` の一致 |
| E2E・Storybook | `pnpm test:e2e` | ビルドしたアプリのキーボード操作、Story の axe-core 検査、状態インジケーターの画像差分 |

Playwright の HTML レポートでは Story 全体の画像を確認できる。画像差分が出たら、実画像と期待画像を見て意図した変更か判断する。fast-check は固定シードで操作列を生成する。失敗した入力だけを再現するには、出力された `seed` と `path` を `fc.assert` のオプションに指定する。PR には実行したコマンド、結果、未確認の範囲を記載する。

機能ごとの操作と期待結果は [機能一覧](features/README.md) を参照する。
