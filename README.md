# 4日間居酒屋 — サイト（静的）

このリポジトリは、4日間限定の居酒屋用のシンプルな静的ホームページ雛形です。含まれる内容：

- 予約状況（`reservations.json` を読み込み表示）
- メニュー（`index.html` 内に記載）
- お店からのメッセージ
- 予約フォームへのリンク（外部）と mailto の問い合わせ

## ファイル

- `index.html` — メインページ
- `styles.css` — スタイル
- `script.js` — 予約状況を読み込んで表示する簡易スクリプト
- `reservations.json` — 日付・時間帯・定員・予約済数のサンプルデータ

## 使い方（ローカルで確認）

ローカルで `index.html` を直接ブラウザで開くと、ブラウザのセキュリティのため `reservations.json` を fetch できない場合があります。簡易サーバーで確認してください。

Windows（PowerShell）での例：

```pwsh
# Python が入っている場合
py -3 -m http.server 8000

# または
python -m http.server 8000
```

ブラウザで `http://localhost:8000/` にアクセスしてください。

## 開発用サーバー（管理画面・Webhook 対応）

Node.js を使って簡易サーバーを起動できます。Express サーバーは API を提供します。

準備：Node.js がインストールされていることを確認し、プロジェクトルートで依存をインストールしてください。

```pwsh
cd "c:\Users\tanak\OneDrive\デスクトップ\order system\izakaya"
npm install
```

起動（環境変数で管理者パスワードと webhook シークレットを設定できます。未設定時のデフォルトは下記です）：

```pwsh
# 簡単起動（ADMIN_PASSWORD と WEBHOOK_SECRET は任意で設定）
setx ADMIN_PASSWORD "your_admin_password"
setx WEBHOOK_SECRET "your_webhook_secret"
npm start
```

サーバーが起動したらブラウザで `http://localhost:8000/` を開いてください。

API について（簡易）
- GET /api/reservations — `reservations.json` を返します。
- POST /api/admin/update — 管理者パスワード（HTTP ヘッダ `x-admin-password`）で認証し、送信した JSON で `reservations.json` を上書きします。
- POST /api/webhook?secret=... または ヘッダ `x-webhook-secret` — 外部から予約情報を受け取り、該当日時の `reserved` を増やします。

Google スプレッドシート連携（静的公開で簡単に編集したい場合）

静的サイト（GitHub Pages 等）で運用しつつ、予約状況を簡単に編集したい場合は Google スプレッドシートをデータソースにするのが簡単で安全です。手順（概略）：

1. Google スプレッドシートを作成し、ヘッダ行を次のようにします（例）：

	date,label,time,capacity,reserved

	例: 2025-11-01,11/01 (金),17:00,20,3

2. Google フォームを作ってスプレッドシートにリンクさせれば、フォーム送信で自動的にシートが更新されます（人数はフォームで集計できるようにフィールド設計してください）。

3. スプレッドシートを「ファイル > ウェブに公開」から CSV で公開します（公開後に得られる URL をコピー）。

4. `script.js` の先頭にある `SHEET_CSV_URL` にその公開 CSV の URL を入れると、サイト側でそこから予約データを読み込みます。シートを直接編集すればサイトに反映されます。

注意点:
- Google フォームから自動的に集計して `reserved` を更新したい場合、フォームの集計方法（単純な集計列や Apps Script での集計スクリプト）を用意する必要があります。フォーム単体は自動で `reserved` を増やす仕組みを持たないため、Apps Script で送信イベントを受けて集計する方法を推奨します。
- 公開した CSV は誰でもアクセス可能になるので、個人情報を含めないか、共有設定に注意してください。

この方法なら、静的ホスティング（GitHub Pages 等）でも管理者が Google スプレッドシートの UI で簡単に編集できます。必要なら、フォーム→集計（Apps Script）の具体例を作成します。

注意: Google フォーム自体は直接 webhook を呼べないため、Google Apps Script を使ってフォーム送信時に上記 webhook に POST するスクリプトを作成する必要があります。簡易例（Apps Script 側）：

```javascript
// Google Apps Script の doPost でフォーム送信時に呼ぶ例
function onFormSubmit(e){
	const url = 'http://your-host:8000/api/webhook?secret=あなたのWEBHOOK_SECRET';
	const payload = {
		date: '2025-11-01',
		time: '19:00',
		seats: 2
	};
	UrlFetchApp.fetch(url, {method:'post', contentType:'application/json', payload: JSON.stringify(payload)});
}
```

管理画面
- `http://localhost:8000/admin.html` にアクセスし、管理パスワードを入力して残席（reserved）や定員（capacity）を編集して保存できます。

<!-- 印刷用ページは不要のため削除しました。メニューは `index.html` 上の画像を差し替えて表示してください -->

## カスタマイズ

- `reservations.json` を編集して日付や残席を更新してください。
- `script.js` の `externalFormUrl` に実際の予約フォーム URL（Googleフォーム等）を入れてください。
- デザインや文言は `styles.css` と `index.html` を編集して変更できます。

## デプロイ案

- GitHub Pages を使うのが簡単です。リポジトリを作って `main` ブランチのルートに配置すれば公開できます。
- Netlify / Vercel なども静的ホスティングとして利用可能です。

## 次の提案（必要なら対応します）

1. 予約フォームとの連携（フォーム送信→`reservations.json` 更新の仕組み）
2. 定員管理 UI（管理者用パスワードで残席を変更）
3. モバイル向け改善や印刷用のメニューPDF

必要なら、上のどれを先に実装するか教えてください。
