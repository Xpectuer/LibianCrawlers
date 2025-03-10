import{_ as r,c as e,o as a,ag as i}from"./chunks/framework.Ds6Eueu6.js";const g=JSON.parse('{"title":"了解 LibianCrawler","description":"","frontmatter":{},"headers":[],"relativePath":"guide/learn-about-libiancrawler.md","filePath":"guide/learn-about-libiancrawler.md","lastUpdated":1741617416000}'),l={name:"guide/learn-about-libiancrawler.md"};function n(o,t,d,s,p,c){return a(),e("div",null,t[0]||(t[0]=[i('<h1 id="了解-libiancrawler" tabindex="-1">了解 LibianCrawler <a class="header-anchor" href="#了解-libiancrawler" aria-label="Permalink to &quot;了解 LibianCrawler&quot;">​</a></h1><p>LibianCrawler通过整合 <a href="https://playwright.dev/" target="_blank" rel="noreferrer">Playwright</a>、<a href="https://www.typescriptlang.org/" target="_blank" rel="noreferrer">TypeScript</a>、<a href="https://jsonata.org/" target="_blank" rel="noreferrer">Jsonata</a> 和 <a href="https://quicktype.io/" target="_blank" rel="noreferrer">Quicktype</a> 等工具， 构建了一个模块化的、易于维护的Web爬虫与数据清洗框架。</p><p><strong>其架构设计有效解决了传统工具在处理复杂网页、动态内容、接口变化等方面的诸多难题</strong>， 使开发者能够更专注于业务逻辑的实现，而非繁琐的数据抓取和清洗工作。</p><table tabindex="0"><thead><tr><th>在Web爬虫和数据清洗时的困难之处</th><th>playwright</th><th>typescript + jsonata + quicktype</th></tr></thead><tbody><tr><td>接口难以定位与逆向</td><td>利用 Playwright记录请求和响应、HTML frame树。</td><td>结合TypeScript和Jsonata的高效数据提取能力，解析并生成相应的类型定义。</td></tr><tr><td>指纹检测</td><td>使用 <a href="https://camoufox.com/" target="_blank" rel="noreferrer">Camoufox</a> 规避浏览器指纹检测。</td><td></td></tr><tr><td>弹出式验证</td><td>暂停脚本等待用户手动登陆、手动输入验证码。</td><td></td></tr><tr><td>平台接口变动、sign升级</td><td>HTML frame 树并不会发生很大变化</td><td>利用 quicktype 生成返回值类型，然后利用 typescript 类型系统对业务代码类型检查。</td></tr></tbody></table><p><strong>在完成数据爬取和类型生成后</strong>，通过编写 TypeScript 业务代码，可以高效地完成数据清洗、验证和合并的任务。具体来说：</p><ul><li>确保新生成的类型与老代码兼容，避免类型推断检查失败。</li><li>对时间格式、数值范围等关键字段进行严格的验证和清洗，确保数据质量。</li><li>在合并数据时，灵活处理相同 id 的情况，确保去重或更新逻辑正确。</li></ul><p><strong>在完成数据清洗之后</strong>，会使用 <a href="https://kysely.dev/" target="_blank" rel="noreferrer">Kysely</a> 框架将数据更新到 PostgreSQL 中的各个结果表，并根据以下规则进行操作：</p><ul><li>当数据库中不存在新数据的 id 时：插入一条新记录。</li><li>当数据库中存在旧数据但与新数据不一致时：更新旧数据为新数据。</li><li>当旧数据和新数据一致时：不会发生任何更改。</li></ul><p><strong>当面对新的数据清洗需求时</strong>，若需新建结果表或在现有表中添加新列，<a href="https://kysely.dev/docs/migrations" target="_blank" rel="noreferrer">Kysely Migrations</a> 提供了高效且可靠的方式来进行数据库迁移。这种方法不仅确保了代码变更与数据库模式的同步更新，还通过 TypeScript 实现类型安全，确保了 ORM 对象与数据库列之间的类型一致性。</p>',9)]))}const b=r(l,[["render",n]]);export{g as __pageData,b as default};
