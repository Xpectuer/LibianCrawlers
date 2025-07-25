import { type DefaultTheme, defineConfig } from "vitepress";
/* @ts-ignore */
import fs from "fs/promises";
import { generateSidebar } from "vitepress-sidebar";
import { withMermaid } from "vitepress-plugin-mermaid";
import taskCheckbox from "markdown-it-task-checkbox";

function create_sidebar_item(): DefaultTheme.SidebarItem[] {
  /* @ts-ignore */
  return generateSidebar({
    documentRootPath: "docs",
    useTitleFromFileHeading: true,
    useFolderTitleFromIndexFile: true,
    useFolderLinkFromIndexFile: true,
    collapseDepth: 2,
    collapsed: true,
    sortMenusOrderNumericallyFromTitle: true,
    underscoreToSpace: true,
  });
}

function create_config() {
  return defineConfig({
    lang: "zh-CN",
    title: "LibianCrawler Document",
    base: "/LibianCrawlers/",
    description: "",
    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config
      nav: [
        { text: "Home", link: "/" },
        // { text: "Examples", link: "/markdown-examples" },
      ],

      socialLinks: [
        { icon: "github", link: "https://github.com/Xpectuer/LibianCrawlers" },
      ],
      editLink: {
        pattern: (pagedata) => {
          return `https://github.com/Xpectuer/LibianCrawlers/blob/main/docs/${
            encodeURIComponent(
              pagedata.filePath,
            )
          }`;
        },
        text: "去Github编辑",
      },
      sidebar: [...create_sidebar_item()],

      search: {
        provider: "local",
      },

      lastUpdated: {
        text: "最后更新于 ",
        formatOptions: {
          dateStyle: "full",
          timeStyle: "medium",
        },
      },

      darkModeSwitchLabel: "暗色模式",
      sidebarMenuLabel: "全部目录",
      returnToTopLabel: "回到网页顶部",
      langMenuLabel: "语言",
      notFound: {
        title: "页面不见了",
        quote: "或许是文件发生了更改而导致链接失效...",
        linkText: "返回首页",
      },
      docFooter: {
        next: "下一章",
        prev: "上一章",
      },
      outline: {
        label: "跳转标题或顶部",
        level: "deep",
      },
    },
    markdown: {
      // options for @mdit-vue/plugin-toc
      // https://github.com/mdit-vue/mdit-vue/tree/main/packages/plugin-toc#options
      toc: { level: [1, 2, 3, 4, 5, 6] },

      config: (md) => {
        md.use(taskCheckbox, {
          disabled: true,
          divWrap: false,
          divClass: "checkbox",
          idPrefix: "cbx_",
          ulClass: "task-list",
          liClass: "task-list-item",
        });
      },
    },
  });
}

// https://vitepress.dev/reference/site-config
export default withMermaid({
  ...create_config(),
});
