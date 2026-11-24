# solid2-pstack

通知設定を題材に、Solid 2.0、UI SDK、StyleX の組み合わせを実ブラウザで検証するプロジェクトです。ボタンで通知状態を切り替え、リセットでオフに戻せます。設定はページ内に保持します。

通知 UI とそのテストは `frontend/` にあります。以下のコマンドはリポジトリのルートから実行します。

## セットアップ

Node.js 24 LTS、`frontend/package.json` に記載の pnpm、Homebrew で導入した APM を使います。

```sh
brew install microsoft/apm/apm
apm install --frozen
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend exec playwright install chromium
```

APM は pstack の選択した Skill を上流のコミットに固定し、このプロジェクトの Skill とともに `.agents/skills/` へ配置します。プロジェクトの Skill の正本は `.apm/skills/` です。

## 動かす

```sh
pnpm --dir frontend dev
pnpm --dir frontend storybook
```

Storybook の **Settings / Notifications** で Off と On を切り替えて確認できます。

## 検証

```sh
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend test:e2e
```

- `pnpm --dir frontend test` は Vitest Browser Mode の操作確認、fast-check の操作列、tla-ts による状態モデルの照合を実行します。
- `pnpm --dir frontend verify:model` は TLA+ モデルと TypeScript の全4入力の一致を検証します。[状態モデル](frontend/models/Notifications.tla)
- `pnpm --dir frontend test:e2e` はビルド済みのアプリと Storybook を使います。キーボード操作、axe-core の検査、オン・オフそれぞれのインジケーター画像の比較を行います。
- Storybook 全体の画像をレポートで確認するには、`pnpm --dir frontend test:e2e --reporter=html` を実行します。保存したレポートは `pnpm --dir frontend exec playwright show-report` で開けます。意図した見た目の変更を確認した場合に限り、前者に `--update-snapshots` を指定して基準画像を更新します。

PR の作成時は Codex で `$opening-a-pr` を呼び出します。手順と観測点はリポジトリ内の Skill でも読めます。 [Opening a PR](.apm/skills/opening-a-pr/SKILL.md)・[検証 Skill](.apm/skills/verify-solid2-pstack/SKILL.md)・[Issue #1](https://github.com/s4na/solid2-pstack/issues/1)
