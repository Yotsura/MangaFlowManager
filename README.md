# MangaFlowMagager

Vue 3 + Vite で構築した漫画制作の進捗管理アプリです。Firebase Authentication / Firestore と連携し、ログイン後に作品やスケジュールを管理する画面へアクセスできます。

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Firebase 連携の準備

1. `.env.example` を参考に `.env.local`（または `.env`）を作成し、Firebase コンソールから取得した値を設定します。

```ini
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID # 任意
VITE_USE_FIREBASE_EMULATORS=false
```

2. Firebase Authentication で Email/Password と Google を有効化します。
3. Cloud Firestore を Production モードで初期化し、必要に応じてセキュリティルールを更新します（`firestore.rules` を参照）。

## Firebase Emulators の利用（任意）

ローカルで認証・Firestore をテストする場合は、以下を実行するとエミュレーターが利用できます。

```powershell
firebase emulators:start --only auth,firestore
```

`.env.local` の `VITE_USE_FIREBASE_EMULATORS` を `true` にすると、開発サーバーが自動でエミュレーターへ接続します。

## ログイン認証の使い方

- `/login` でメールアドレスとパスワードによるログイン／新規登録、Google アカウントによるログインが可能です。
- 認証済みユーザーのみホームやその他の画面へアクセスでき、未認証の場合は自動的にログインページへリダイレクトされます。
- ログアウトはヘッダー右上のボタンから行えます。

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

開発サーバー起動後、`http://localhost:5173` にアクセスしてログインしてください（初回は `/login` にリダイレクトされます）。

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```

## デプロイ

```powershell
pnpm build
firebase deploy --only hosting
```

デプロイには `firebase login` と `firebase use` で対象プロジェクトを選択済みであることが前提です。`firebase.json` の Hosting 設定は Vite のビルド成果物（`dist/`）を配信するよう構成しています。
