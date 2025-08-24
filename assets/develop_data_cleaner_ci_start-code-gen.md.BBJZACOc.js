import{_ as s,c as n,o as e,a3 as p}from"./chunks/framework.w8luOYmq.js";const g=JSON.parse('{"title":"3-启动代码生成","description":"","frontmatter":{},"headers":[],"relativePath":"develop/data_cleaner_ci/start-code-gen.md","filePath":"develop/data_cleaner_ci/start-code-gen.md","lastUpdated":1756017475000}'),i={name:"develop/data_cleaner_ci/start-code-gen.md"};function l(t,a,c,d,o,h){return e(),n("div",null,a[0]||(a[0]=[p(`<h1 id="_3-启动代码生成" tabindex="-1">3-启动代码生成 <a class="header-anchor" href="#_3-启动代码生成" aria-label="Permalink to &quot;3-启动代码生成&quot;">​</a></h1><h2 id="类型生成" tabindex="-1">类型生成 <a class="header-anchor" href="#类型生成" aria-label="Permalink to &quot;类型生成&quot;">​</a></h2><h3 id="运行脚本" tabindex="-1">运行脚本 <a class="header-anchor" href="#运行脚本" aria-label="Permalink to &quot;运行脚本&quot;">​</a></h3><details class="details custom-block"><summary>代码生成脚本将会为你执行以下操作</summary><ol><li>将创建 <code>./data_cleaner_ci_generated/</code> 目录和 <code>./user_code/</code> 符号链接目录。这两个目录已被 <code>.gitignore</code> 排除，不会被代码管理。</li><li>将在 <code>./data_cleaner_ci_generated/</code> 目录中执行以下操作： <ul><li>生成配置文件并保存到 <strong>用户家目录</strong> 的配置中，然后将配置文件 <strong>符号链接</strong> 至 <code>./data_cleaner_ci_generated/config.json</code>，以便进行 TypeScript 类型检查。</li><li>根据配置文件内容，在 <code>./data_cleaner_ci_generated</code> 目录下生成数仓中的数据类型和接口 API。</li></ul></li><li>将创建私人代码目录 <code>$HOME/.libian/crawler/data_cleaner_ci/user_code</code> 并将其 <strong>符号链接</strong> 至 <code>./user_code/</code>。 <ul><li>以便进行 TypeScript 类型检查。</li><li>其他公共脚本需要从 <code>./user_code/</code> 目录中导入类型，以免私人代码中的类型名称直接被公共代码使用。</li></ul></li></ol></details><p>在设置好数据仓库后，执行以下命令以全量数据生成数仓的 API 代码:</p><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">deno</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> task</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> init:code_gen</span></span></code></pre></div><p><code>init:code_gen</code> 命令详情参考:</p><div class="vp-code-group vp-adaptive-theme"><div class="tabs"><input type="radio" name="group-F_zkW" id="tab-ROiRXPP" checked><label data-title="查看帮助" for="tab-ROiRXPP">查看帮助</label><input type="radio" name="group-F_zkW" id="tab-c9q_Vnb"><label data-title="查看帮助: 输出" for="tab-c9q_Vnb">查看帮助: 输出</label><input type="radio" name="group-F_zkW" id="tab-9vICgVV"><label data-title="小窍门: 跳过已存在的批次" for="tab-9vICgVV">小窍门: 跳过已存在的批次</label></div><div class="blocks"><div class="language-shell vp-adaptive-theme active"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">deno</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> task</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> init:code_gen</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --help</span></span></code></pre></div><div class="language-txt vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">txt</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Help for code_gen.ts:</span></span>
<span class="line"><span></span></span>
<span class="line"><span>-----------------------------------------</span></span>
<span class="line"><span>常用参数:</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--help</span></span>
<span class="line"><span>      显示帮助。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--skip-existed</span></span>
<span class="line"><span>      跳过已经生成的类型文件。</span></span>
<span class="line"><span>      </span></span>
<span class="line"><span>      如果你确信 jsonata_tampletes 没有更改、garbage 表只新增不修改，</span></span>
<span class="line"><span>      那么你可以使用此选项节省大量时间。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>      否则，你可以不启用此选项，脚本也会“局部更新式”的修改已存在的类型文件，</span></span>
<span class="line"><span>      只是全量计算将会耗费大量时间。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--debugopt-logtime</span></span>
<span class="line"><span>      输出时间花费。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--only-gen-nocodb</span></span>
<span class="line"><span>      只生成 nocodb mate 的类型文件。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>-----------------------------------------</span></span>
<span class="line"><span>不建议使用的内部参数，建议只在开发调试时使用:</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--no-network</span></span>
<span class="line"><span>      不使用任何远程仓库的数据，仅使用本地缓存来类型生成。</span></span>
<span class="line"><span>      本地缓存位于 ./data_cleaner_ci_generated/.cache_by_id 中。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--only-gen-batches-union-merge-file</span></span>
<span class="line"><span>      只生成 index.ts 的联合类型声明文件。不生成批次数据类型文件。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--high-water-mark</span></span>
<span class="line"><span>      原始数据的 batch 会缓存在队列中，若队列未满则会在 timer 中异步继续加载。</span></span>
<span class="line"><span>      此值为队列的长度限制。默认值为 0。设置为 0 以禁用队列。</span></span>
<span class="line"><span>      该选项不建议修改，因为队列会导致更大的内存使用。</span></span>
<span class="line"><span></span></span>
<span class="line"><span>--batch-size</span></span>
<span class="line"><span>      覆盖设置每 batch 的最大长度。默认值 100，也可以在 ./data_cleaner_ci_generated/config.json 中的 **.batch_size 设置。</span></span>
<span class="line"><span>      如果设置过高的值可能导致 quicktype 子进程 OOM 。</span></span></code></pre></div><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 跳过已存在的 batch 类型生成，以便只生成增量数据的类型，非常节省时间。</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 但是要注意，如果你的 jsonata_template 改变，存量数据的 jsonata 转换输出会发生变化，请确保你的旧数据不受巨大影响时才能 --skip-existed。</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">deno</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> task</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> init:code_gen</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> --skip-existed</span></span></code></pre></div></div></div><h3 id="检查结果" tabindex="-1">检查结果 <a class="header-anchor" href="#检查结果" aria-label="Permalink to &quot;检查结果&quot;">​</a></h3><p>完成后，初始化工作就已经完成。然而，如果您需要适配并运行 <code>general_data_process</code> 目录下的公用脚本，您需要手动处理 TypeScript 类型导入。</p><p>您可以通过运行以下命令，检查生成的类型是否满足公开脚本的类型推断，并运行测试：</p><div class="language-shell vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">shell</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">deno</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> tasks</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> step:check</span></span></code></pre></div>`,12)]))}const k=s(i,[["render",l]]);export{g as __pageData,k as default};
