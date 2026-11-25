---
name: opening-a-pr
description: solid2-pstack の変更を検証し、関連 Issue と検証結果を添えて PR を作成・更新する。
---

# Opening a PR

Lauren Tan（poteto）の pstack にある [Opening a PR プレイブック](https://github.com/cursor/plugins/blob/005d8f6e8ec057b738adcd08a08b30db0478402d/pstack/skills/poteto-mode/playbooks/opening-a-pr.md) をもとに、このリポジトリ向けに調整した Skill です。[上流の MIT ライセンス](LICENSE)

1. 対象 Issue、ベースブランチ、差分、適用するリポジトリ指示を確認する。依頼と無関係な差分はコミットの対象から外す。
2. 変更内容に応じて下の検証を行う。実行したコマンド、確認した振る舞い、結果、未確認の範囲を PR 本文に残す。
3. コミット前に差分を見直す。実ブラウザで得た結果を優先し、テストはユーザーが観測できる振る舞いを確認する。必要に応じて APM の `principle-prove-it-works` と `principle-test-behavior-not-implementation` を読む。
4. 依頼済みの PR を作成または更新する。Issue の一部を進める PR は `Refs #番号` で結びつける。Issue の完了条件をすべて満たす場合は `Closes #番号` を使える。レビュー依頼と指摘対応はリポジトリの指示に従う。

## 文書だけの変更

差分の読み合わせと `git diff --check` を行う。セットアップや実行コマンドを書き換えた場合は、そのコマンドを該当する環境で実行する。

## アプリと検証の変更

`verify-solid2-pstack` の手順で、変更に対応する検証を実行する。

- 画面・キーボード操作・スタイルの変更では、対象 Story と実ブラウザのテストを確認する。画像差分は意図した変化を確認してから更新する。
- 状態遷移の変更では、fast-check と TLA+ モデルを再実行する。新しいモデルが必要なら `create-formal-verification-skill`、既存モデルの陳腐化を確認するなら `maintain-formal-verification-skill` を使う。現在のモデルと実装の対応は `verify-solid2-pstack` に記録してある。
- 検証の起動方法や操作手順が変わったら、同じ PR で `verify-solid2-pstack` も実際に動かして更新する。全機能の監査を行う場合は `maintain-verification-skill` を別途使う。
- 同じミスが繰り返されたら `correct` の観点で、型やテストで再発を防げるか検討する。今回の作業で得た手順や判断を次に残す必要があれば `reflect` で更新候補を確認する。Skill を変更する場合は、更新内容の確認手順に従って `.apm/skills/` の正本を編集する。
