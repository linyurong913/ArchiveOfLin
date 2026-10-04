# Google 收录配置

网站：https://linyurong913.github.io/ArchiveOfLin/

已配置：描述性标题、页面摘要、canonical、结构化数据、首页首屏静态书目、可抓取的完整书目索引、每份公开文献的独立 HTML 页面和 XML 站点地图。仅提供原有公开书目信息；不发布文件原件、账户密码、SQLite 或管理后台。

- 完整索引：https://linyurong913.github.io/ArchiveOfLin/catalogue.html
- 站点地图：https://linyurong913.github.io/ArchiveOfLin/sitemap.xml
- 独立书目页面：`documents/LB-编号.html`

运行现有 `scripts/export.mjs` 会同时更新搜索引擎可读取的页面；现有 Proton 自动任务会导出并发布它们。发布器根据当前公开条目生成允许列表，已归档文献页将从新部署删除。不要直接修改 dist，它会被重新生成。

## 仍需账号所有者完成的 Google 验证

1. 登录 https://search.google.com/search-console/welcome 。
2. 添加“网址前缀”资源，精确填写 `https://linyurong913.github.io/ArchiveOfLin/`。不要选需要 DNS 的“网域”资源。
3. 选择“HTML 标记”，将 Google 提供的 `<meta name="google-site-verification" content="…">` 加入 `public/index.html` 的 head。它是公开验证标记，不是 Google 账户密码。
4. 导出、发布并等 GitHub Pages 构建成功后，回 Search Console 点击“验证”。必须保留标记，后续同步会从该源文件继续复制。
5. 在“站点地图”提交 `sitemap.xml`，在“网址检查”检查首页并请求编入索引。首次提交后不要反复重复提交。

Google 决定是否收录、展示哪些词以及排名；配置和提交不保证立即显示或获得特定名次。没有 Google 账号验证，不应把“已部署 SEO 配置”说成“已向 Search Console 提交”。

## robots.txt 的位置

本项目位于 GitHub Pages 子路径。有效 robots.txt 必须位于 `https://linyurong913.github.io/robots.txt`，项目内 `/ArchiveOfLin/robots.txt` 不能代替域名根目录规则。目前根目录返回 404，网页也没有 noindex，这本身不阻止抓取。因此本次不创建误导性的项目级 robots.txt，也不修改账号下其他网站；通过 Search Console 提交站点地图即可。

## 参考

- https://developers.google.com/search/docs/fundamentals/get-started-developers
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://support.google.com/webmasters/answer/9008080
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
