# 修繕請負 見積・原価管理アプリ

不動産修繕請負業向けの **見積(顧客提出用) + 実経費(社内用)** を並列管理するWebアプリです。  
現状のExcel管理を置き換えることを目的としています。

---

## 目次

1. [要件概要](#要件概要)
2. [データモデル](#データモデル)
3. [画面一覧と機能](#画面一覧と機能)
4. [計算ロジック](#計算ロジック)
5. [技術スタック](#技術スタック)
6. [ディレクトリ構成](#ディレクトリ構成)
7. [セットアップ手順](#セットアップ手順)
8. [デプロイ (Vercel)](#デプロイ-vercel)

---

## 要件概要

| 項目 | 内容 |
|------|------|
| 利用者 | 1人(自分のみ) |
| 顧客 | 第三者(修繕工事の発注者) |
| 帳票出力 | 不要(画面確認のみ) |
| 消費税 | 10%対応必須(税率・端数処理を案件ごとに設定) |
| UI言語 | 日本語 |
| レスポンシブ | スマホ閲覧可 |

### 特徴的な要件

- 各明細行に「**見積単価(税抜)**」と「**実経費**」を別フィールドで持つ
- 実経費は完工後に埋めていく運用なので、空欄でもOK
- 案件ごとに「予定利益(見積ベース)」と「実利益(実経費ベース)」を把握できる
- 実経費は顧客に見せない社内情報

---

## データモデル

### customers(顧客)

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid (PK) | |
| user_id | uuid (FK auth.users) | RLS用 |
| name | text | 会社名 or 個人名(必須) |
| contact_name | text | 担当者名 |
| phone | text | |
| email | text | |
| postal_code | text | |
| address | text | |
| notes | text | |
| created_at, updated_at | timestamptz | |

### projects(案件)

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid (PK) | |
| user_id | uuid (FK auth.users) | RLS用 |
| customer_id | uuid (FK customers) | 必須 |
| title | text | 案件名(必須) |
| property_address | text | 施工物件住所 |
| status | text | `estimating` / `won` / `in_progress` / `completed` / `lost` |
| estimated_at | date | 見積日 |
| start_date | date | 着工予定 |
| end_date | date | 完工予定 |
| description | text | 案件概要 |
| tax_rate | numeric(5,4) | 既定 0.10 |
| rounding_mode | text | `floor`(切捨) / `round`(四捨五入) / `ceil`(切上)、既定 `floor` |
| default_labor_unit_price | numeric(12,2) | 人工の既定単価(円/時) |
| received_amount | numeric(12,2) | 受注金額(税込・手動入力) |
| notes | text | 社内備考 |
| created_at, updated_at | timestamptz | |

### line_items(明細項目)

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid (PK) | |
| project_id | uuid (FK projects) | |
| user_id | uuid (FK auth.users) | RLS用 |
| category | text | `material` / `labor` / `transport` / `other` |
| sort_order | int | カテゴリ内の表示順 |
| name | text | 項目名(必須) |
| quantity | numeric(12,2) | 数量(材料:個数、人工:時間など) |
| unit | text | 単位(個・枚・時間・式など) |
| unit_price | numeric(12,2) | 見積単価(税抜) |
| actual_amount | numeric(12,2) | **実経費(社内用・顧客非開示)** |
| notes | text | 備考 |
| created_at, updated_at | timestamptz | |

> `estimated_subtotal`(見積小計) = `quantity × unit_price` は都度計算し、DBには保存しない。

### RLS ポリシー

全テーブルで Row Level Security を有効化。`auth.uid() = user_id` のレコードのみ参照・更新可。

---

## 画面一覧と機能

### 認証

| 画面 | パス | 内容 |
|------|------|------|
| ログイン | `/login` | メール/パスワード認証 |
| 新規登録 | `/signup` | 最初の1アカウント作成用 |

未ログイン時は `/login` へリダイレクト。ログイン済みで `/login` `/signup` にアクセスすると `/` へリダイレクト。

### ダッシュボード `/`

- 見積中案件数 / 施工中案件数 / 今月完工件数
- 今月の受注額合計・今月の実利益(完工済み案件)
- 直近5件の案件一覧

### 顧客管理 `/customers`

- 一覧表示(検索: 名前・電話番号・住所)
- 新規作成・編集(ダイアログ形式)
- 削除(関連案件がある場合はエラーで保護)

**顧客詳細 `/customers/[id]`**
- 顧客情報の表示
- 過去案件一覧(ステータス・見積日・受注金額)

### 案件管理 `/projects`

- 一覧表示(検索: 案件名・顧客名、フィルター: ステータス)
- 新規作成ダイアログ(顧客選択・各種設定)
- 削除(関連明細も一括削除)
- 作成後は案件詳細画面に自動遷移

### 案件詳細 `/projects/[id]` ⭐ メイン画面

4カテゴリの明細テーブル(縦並び):

| カテゴリ | ラベル | 既定単位 | 備考 |
|----------|--------|----------|------|
| material | 材料費 | 個 | ペンキ・合板・フローリングなど |
| labor | 作業費・人工 | 時間 | 既定単価あり(案件設定値) |
| transport | 交通費 | 回 | 高速代・ガソリン代など |
| other | その他 | — | 管理費・消耗品など |

**明細テーブルの列:**  
項目名 / 数量 / 単位 / 見積単価(税抜) / 見積小計 / **実経費** / 備考 / 削除

**インライン編集:**
- 行クリックで編集モードに移行
- Enter で保存、Esc でキャンセル
- 「行を追加」ボタンで末尾に新規行
- 実経費は空欄でもOK(薄いグレーで「未入力」表示)

**画面下部の集計サマリーパネル(常に表示):**

| 項目 | 見積 | 実経費 |
|------|------|--------|
| 材料費 | ¥ | ¥ |
| 作業費(人工) | ¥ | ¥ |
| 交通費 | ¥ | ¥ |
| その他 | ¥ | ¥ |
| **合計(税抜)** | ¥ | ¥ |
| 消費税(10%) | ¥ | — |
| **合計(税込)** | ¥ | — |
| 受注金額(税込) | 入力欄 | |
| **予定利益** | 緑/赤で表示 | |
| **実利益** | 緑/赤で表示 | |

---

## 計算ロジック

```
見積小計(行)        = quantity × unit_price
カテゴリ見積小計    = Σ 見積小計(カテゴリ内)
カテゴリ実経費小計  = Σ actual_amount(カテゴリ内, NULLは0扱い)

見積合計(税抜)      = Σ カテゴリ見積小計
消費税              = floor/round/ceil( 見積合計(税抜) × tax_rate )
見積合計(税込)      = 見積合計(税抜) + 消費税

実経費合計          = Σ カテゴリ実経費小計

受注金額(税抜)      = received_amount ÷ (1 + tax_rate)
                      ※ received_amount が未入力の場合は 見積合計(税抜) を使用

予定利益            = 受注金額(税抜) − 見積合計(税抜)
実利益              = 受注金額(税抜) − 実経費合計
```

利益額の表示: **プラス → 緑、マイナス → 赤**

---

## 技術スタック

| カテゴリ | 採用技術 | バージョン |
|----------|----------|-----------|
| フレームワーク | Next.js (App Router, TypeScript) | 16.2.6 |
| DB / 認証 | Supabase (PostgreSQL + Auth) | latest |
| スタイリング | Tailwind CSS | v4 |
| UIコンポーネント | shadcn/ui (`base-nova` スタイル) | 4.7.0 |
| フォーム | React Hook Form + Zod | 7.x / 4.x |
| トースト | Sonner | 2.x |
| アイコン | Lucide React | latest |
| パッケージマネージャ | pnpm | 11.x |
| デプロイ | Vercel | — |

> ⚠️ **Next.js 16 の注意点:**  
> `middleware.ts` は非推奨になり `proxy.ts` に改名(関数名も `proxy`)。  
> shadcn v4 の Button は `asChild` 非対応 → `buttonVariants()` + `<Link>` で代替。

---

## ディレクトリ構成

```
repair-app/
├── .env.local.example          # 環境変数テンプレート
├── pnpm-workspace.yaml         # pnpm設定(allowBuilds)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # DBスキーマ + RLSポリシー
└── src/
    ├── proxy.ts                # 認証プロキシ(未ログイン→/login)
    ├── app/
    │   ├── layout.tsx          # ルートレイアウト
    │   ├── globals.css         # Tailwind v4 + CSS変数
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── signup/page.tsx
    │   └── (dashboard)/        # 認証必須エリア
    │       ├── layout.tsx      # サイドバー + ヘッダー
    │       ├── page.tsx        # ダッシュボード
    │       ├── customers/
    │       │   ├── page.tsx            # Server Component(データ取得)
    │       │   ├── customers-client.tsx # Client Component(一覧・操作)
    │       │   ├── customer-dialog.tsx  # 新規/編集ダイアログ
    │       │   └── [id]/page.tsx       # 顧客詳細
    │       └── projects/
    │           ├── page.tsx            # Server Component
    │           ├── projects-client.tsx
    │           ├── project-dialog.tsx   # 新規作成ダイアログ
    │           └── [id]/
    │               ├── page.tsx                  # Server Component
    │               ├── project-detail-client.tsx # 詳細メイン
    │               ├── line-items-section.tsx    # カテゴリ別明細テーブル
    │               ├── summary-panel.tsx         # 集計サマリー
    │               └── project-edit-dialog.tsx   # 案件編集ダイアログ
    ├── components/
    │   ├── layout/
    │   │   ├── sidebar.tsx
    │   │   └── header.tsx
    │   ├── projects/
    │   │   └── project-status-badge.tsx
    │   └── ui/               # shadcn/ui コンポーネント群
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts     # ブラウザ用クライアント
    │   │   └── server.ts     # Server Component用クライアント
    │   ├── calculations.ts   # 見積・利益計算ロジック
    │   └── utils.ts          # cn(), formatCurrency(), formatDate()
    └── types/
        └── database.ts       # 型定義(Customer, Project, LineItem)
```

---

## セットアップ手順

### 1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) で **新規プロジェクト**を作成
   - ⚠️ 既存プロジェクトとは **必ず別のプロジェクト** を作成する(RLSが混在しないように)
   - Free プランで最大2プロジェクトまで作成可能
2. プロジェクト設定 → **API** から以下をコピー:
   - `Project URL`
   - `anon / public` キー

### 2. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. データベース マイグレーション適用

**方法A: Supabase ダッシュボード(推奨)**

1. Supabase ダッシュボード → **SQL Editor** を開く
2. `supabase/migrations/001_initial_schema.sql` の内容を全てコピー
3. SQL Editor に貼り付けて **Run** をクリック

**方法B: Supabase CLI**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 4. 依存パッケージのインストール

```bash
pnpm install
```

### 5. 開発サーバー起動

```bash
pnpm dev
```

ブラウザで http://localhost:3000 を開く。

初回は `/signup` にアクセスしてアカウントを作成してください。

### 6. ビルド確認

```bash
pnpm build
```

---

## デプロイ (Vercel)

1. GitHub にリポジトリを push
2. [Vercel](https://vercel.com) でリポジトリをインポート
3. **Environment Variables** に以下を設定:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
4. **Deploy** をクリック

---

## 画面操作メモ

### 案件詳細での明細編集

- **行クリック** → インライン編集モード
- **Enter** → 保存 / **Esc** → キャンセル
- 「行を追加」ボタン → 新規行を末尾に追加
- 実経費欄は空欄でもOK(完工後に入力する運用)

### 受注金額の入力

集計サマリーパネルの「受注金額(税込)」欄に直接入力 → フォーカスを外すと自動保存。  
未入力の場合は見積合計(税込)を受注金額として利益計算する。

### ステータスの流れ

```
見積中(estimating) → 受注(won) → 施工中(in_progress) → 完工(completed)
                   ↘ 失注(lost)
```
