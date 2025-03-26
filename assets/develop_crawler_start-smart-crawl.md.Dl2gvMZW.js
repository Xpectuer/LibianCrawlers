import{_ as a,c as t,o as i,ag as e}from"./chunks/framework.B3HI_LuJ.js";const F=JSON.parse('{"title":"3-启动爬虫","description":"","frontmatter":{},"headers":[],"relativePath":"develop/crawler/start-smart-crawl.md","filePath":"develop/crawler/start-smart-crawl.md","lastUpdated":1742998623000}'),h={name:"develop/crawler/start-smart-crawl.md"};function l(n,s,d,r,p,o){return i(),t("div",null,s[0]||(s[0]=[e('<h1 id="_3-启动爬虫" tabindex="-1">3-启动爬虫 <a class="header-anchor" href="#_3-启动爬虫" aria-label="Permalink to &quot;3-启动爬虫&quot;">​</a></h1><p>以下是爬虫模块完成进度表。</p><table tabindex="0"><thead><tr><th>平台</th><th>域名</th><th>爬取搜索菜单</th><th>清洗搜索菜单</th><th>爬取商品详情</th><th>清洗商品详情</th></tr></thead><tbody><tr><td>淘宝</td><td>taobao.com</td><td>✔️</td><td>todo</td><td>todo</td><td>todo</td></tr><tr><td>拼多多</td><td>mobile.yangkeduo.com</td><td>✔️</td><td>todo</td><td>✔️</td><td>✔️</td></tr></tbody></table><h2 id="命令示例" tabindex="-1">命令示例 <a class="header-anchor" href="#命令示例" aria-label="Permalink to &quot;命令示例&quot;">​</a></h2><h3 id="淘宝" tabindex="-1">淘宝 <a class="header-anchor" href="#淘宝" aria-label="Permalink to &quot;淘宝&quot;">​</a></h3><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">poetry</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> smart-crawl</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --debug</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --url</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> https://www.taobao.com/</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --locale</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> zh-CN</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --steps</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> jsonfile:steps/taobao-search.json?q=羽绒服</span></span></code></pre></div><h3 id="拼多多-mobile-yangkeduo-com" tabindex="-1">拼多多(mobile.yangkeduo.com) <a class="header-anchor" href="#拼多多-mobile-yangkeduo-com" aria-label="Permalink to &quot;拼多多(mobile.yangkeduo.com)&quot;">​</a></h3><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">poetry</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> smart-crawl</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --debug</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --url</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> https://mobile.yangkeduo.com/</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --locale</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> zh-CN</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --steps</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> jsonfile:steps/yangkeduo-mobile-search.json?q=羽绒服</span></span></code></pre></div><h3 id="小红书" tabindex="-1">小红书 <a class="header-anchor" href="#小红书" aria-label="Permalink to &quot;小红书&quot;">​</a></h3><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">poetry</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> run</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> smart-crawl</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --debug</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --url</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> https://xiaohongshu.com/</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --locale</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> zh-CN</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --steps</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> jsonfile:steps/xiaohongshu.json?q=丸子头</span></span></code></pre></div>',10)]))}const c=a(h,[["render",l]]);export{F as __pageData,c as default};
