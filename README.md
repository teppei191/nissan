# 日産 Digital Twin Hub Mockup (iter-1)

- **ステータス**: iter-1
- **更新日**: 2026-04-28
- **対応BA要件**: [`docs/epics_user_stories_en_ja.md`](../../../docs/epics_user_stories_en_ja.md) の **MVP スコープ** のみ
- **デザインシステム**: [`docs/design-system.md`](../../../docs/design-system.md) (NEXUS + AI Experience Language)
- **本イテレーションのゴール**: MVPスコープのユーザーストーリーをすべて画面で再現し、UXのすり合わせ・要件検証に使う

## スタック（本番と同一）

- Next.js 15 (App Router) + TypeScript + Turbopack
- Tailwind CSS v4（NEXUS デザイントークンを `globals.css` の `@theme` で定義）
- TanStack Query（サーバー状態）
- Zustand + persist（クライアント状態：認証・ロケール）
- React Hook Form + Zod（フォーム — 必要箇所のみ）
- **MSW（Mock Service Worker）** — バックエンド不要・ブラウザ内で `/api/v1/*` をモック

## 起動

```bash
cd prototypes/mockup/app
npm install         # 初回のみ
npm run dev
# → http://localhost:3000
```

`http://localhost:3000` を開くと `/login` にリダイレクトします。

### テスト用アカウント

| ロール | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| User | `user1@example.com` | `user123` |
| Agent Owner | `owner1@example.com` | `owner123` |

> 認証はモック（MSW経由）。本番では SSO（社内ディレクトリ連携）に置き換わる前提（US-01-02）。

## 実装した画面（MVPスコープ全カバー）

| 画面ID | 名称 | パス | 対応US |
|--------|------|------|--------|
| SC-01 | ログイン | `/login` | US-01-01〜03 |
| SC-02 | エージェント一覧/検索 | `/agents` | US-03-13, US-05-01 |
| SC-03 | エージェントチャット（通常） | `/agents/[id]` | US-02-01〜04, US-02-09 |
| SC-04 | CEO Video Agent | `/agents/a-ceo-video` | US-02-09, 11, 12 |
| SC-05 | アクセス権限設定 | `/agents/[id]/permissions` | US-03-04 |
| SC-06 | RAGナレッジベース管理 | `/agents/[id]/knowledge` | US-03-06 |
| SC-07 | 管理者ダッシュボード | `/admin` | US-06-06, US-09-01〜03, US-10-01〜02, US-11-1〜2 |
| サイドバー | 共通レイアウト | (全画面) | US-04-01, US-05-01, US-07-03, US-01-01 |

> 画面詳細仕様: [../screen-overview.md](../screen-overview.md)
> 画面遷移図: [../flow-iter1-2026-04-28.md](../flow-iter1-2026-04-28.md)

## モックAPI（すべて `/api/v1/` 配下）

| エンドポイント | メソッド | 用途 |
|--------------|---------|------|
| `/auth/login` | POST | ログイン |
| `/auth/logout` | POST | ログアウト |
| `/agents` | GET | エージェント一覧（権限フィルタ + 検索） |
| `/agents/:id` | GET | エージェント詳細 |
| `/agents/:id/permissions` | GET / PUT | 権限取得 / 更新 |
| `/agents/:id/knowledge` | GET / POST | KB一覧 / アップロード |
| `/agents/:id/knowledge/:docId` | DELETE | KB削除 |
| `/agents/:agentId/respond` | POST | **SSE ストリーミング応答** |
| `/agents/a-ceo-video/video` | POST | CEO動画生成（モック） |
| `/conversations` | GET / POST | 会話一覧 / 作成 |
| `/conversations/:id` | GET / DELETE | 会話詳細 / 削除 |
| `/conversations/:id/messages` | POST | メッセージ追加 |
| `/admin/system-health` | GET | システムヘルス |
| `/admin/login-events` | GET | ログイン履歴 |
| `/users` | GET | ユーザー一覧 |

ハンドラ実体: [`src/mocks/handlers.ts`](src/mocks/handlers.ts)

## デモシナリオ

### ① 一般ユーザーの基本フロー
1. `user1@example.com` / `user123` でログイン
2. `/agents` でエージェント一覧（自分にアクセス権のあるもののみ表示）
3. 「General Q&A」を選択
4. 質問送信 → ストリーミング応答（停止・再生成可）
5. ファイル添付（.pdf .docx 等） → モック上では添付名のみ表示
6. サイドバーに会話履歴が積まれる
7. 別エージェントへ移動・新しいチャット開始
8. 「Sales Analyst」で「動画にして」と入力 → **Video not supported** 通知が出る（US-02-09）
9. 右下 JP/EN 切替で UI 言語が切り替わる
10. ログアウト

### ② Agent Owner の権限フロー
1. `owner1@example.com` でログイン
2. 自分が所有するエージェント（CEO Chatbot 等）の `/agents/[id]` ヘッダで「🔒 アクセス権限」「📚 ナレッジベース」が表示
3. CEO Chatbot → 「ナレッジベース」 → ドキュメントアップロード（.txt .csv .pptx .docx .xlsx .pdf）
4. 参照対象期間（ヶ月）を設定 → 期限が自動算出
5. 任意のドキュメントを削除 → 即座にリストから消える

### ③ CEO Video Agent
1. `/agents/a-ceo-video` を開く（左：生成フォーム / 右：会話）
2. 台本入力 → 言語（JP/EN）→ 役員アバター選択 → 挿入画像 + タイミング指定
3. 「生成する」 → モック動画プレースホルダがチャットに追加される
4. プレースホルダの「⬇ ダウンロード」（モック）

### ④ Admin（管理者）
1. `admin@example.com` でログイン → サイドバーに「⚙️ 管理」が表示
2. `/admin`：
   - 24時間スパークライン（API遅延・エラー）
   - 4枚のスタットカード（uptime / latency / errors24h / alerts）
   - ログイン履歴テーブル（login / logout / login_failed の色分け）
   - データ保持ポリシー（1年）・暗号化（AES-256, TLS 1.3）・GCPバックアップ・性能目標を表示

## 既知の制限（モックゆえの省略）

- **認証**: 完全モック。SSO・MFA は文言で示すのみ（US-01-02, US-01-03 は実装不要扱い通り）
- **ストリーミング**: SSE 形式だが内容はエージェントkindごとの固定生成（実LLMなし）
- **動画生成**: 実動画なし。`/mock-video.mp4` プレースホルダのみ
- **ファイル添付**: メタ情報のみ保持・実コンテンツ送信なし
- **会話履歴**: MSW のメモリ保持（リロードで初期fixturesに戻る）
- **国際化**: 主要ラベル + メッセージのみ JP/EN 対応。エージェント応答内容は基本日本語
- **アクセス権限の「即時反映」**: 一覧再フェッチで反映確認可（自動再ログインは行わない）
- **MVP 外**（音声入力 / ピン留め / フィードバック評価 / Agent CRUD / 会話タイトル変更 等）は意図的に未実装

## 次イテレーションで対応予定

- [ ] iter-2: フィードバック評価UI（US-02-05）
- [ ] iter-2: エージェント CRUD（US-03-01〜03）
- [ ] iter-2: 会話タイトル変更・削除・検索（US-04-02〜04）
- [ ] iter-2: Admin: ユーザー管理・コスト・利用ログ（US-06-01〜05）

## 変更履歴

- iter-1 (2026-04-28): 初版。MVPスコープ全カバー。NEXUS デザイントークン適用。
