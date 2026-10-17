declare module 'virtual:content' {
  /** plugins/content.ts が検査済みの ContentBundle を渡す（型は src/content/index.ts で付ける） */
  const content: unknown;
  export default content;
}

/** ビルド時に埋め込む版（package.json の version とコミット） */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
