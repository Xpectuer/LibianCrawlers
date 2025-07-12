import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  DataClean,
  Mappings,
  Streams,
  Strs,
  Times,
  Typings,
} from "../../../util.ts";
import {
  MediaContent,
  MediaContentAuthor,
  MediaSearchContext,
  PlatformEnum,
} from "../../media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_metainfo: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    if (!("metainfo" in garbage.obj.template_parse_html_tree)) {
      return;
    }
    const { metainfo } = garbage.obj.template_parse_html_tree;
    if (!Mappings.is_not_concrete_empty(metainfo)) {
      return;
    }

    const read_metas_property_from_metainfo = <
      M extends Typings.ReduceUnionMapping<typeof metainfo>,
      K extends string & keyof M,
    >(
      m: M | Mappings.Empty,
      key: K,
    ) => {
      let res:
        | Extract<M, { [P in K]?: unknown }>[K]
        | null = null;
      if (
        Mappings.is_not_concrete_empty(m) &&
        key in m
      ) {
        const _res = m[key];
        if (
          typeof _res === "object" &&
          Mappings.is_not_concrete_empty(_res)
        ) {
          res = _res;
        } else {
          res = null;
        }
      } else {
        res = null;
      }
      return res;
    };

    const metas = read_metas_property_from_metainfo(metainfo, "metas");
    const read_metas = <
      M extends Typings.ReduceUnionMapping<typeof metas>,
      KS extends (string & keyof Typings.ReduceUnionMapping<M>)[],
    >(
      keys: KS,
    ):
      | NonNullable<Typings.ReduceUnionMapping<M>[typeof keys[number]]>
      | null => {
      if (typeof metas !== "object" || metas === null) {
        return null;
      }
      let res: string | null = null;
      for (const key of keys) {
        if (key in metas) {
          // deno-lint-ignore no-explicit-any
          const _k: string & keyof typeof metas = key as any;
          res = Strs.is_not_blank(metas[_k]) && metas[_k] !== "无"
            ? metas[_k]
            : null;
        }
        if (res !== null) {
          // deno-lint-ignore no-explicit-any
          return res as any;
        }
      }
      // deno-lint-ignore no-explicit-any
      return res as any;
    };
    const metas2 = read_metas_property_from_metainfo(metainfo, "metas2");
    const read_metas2 = <
      M extends Typings.ReduceUnionMapping<typeof metas2>,
      KS extends (
        & string
        & keyof Typings.ReduceUnionMapping<Mappings.IsNotConcreteEmpty<M>>
      )[],
    >(
      keys: KS,
    ):
      | NonNullable<Typings.ReduceUnionMapping<M>[typeof keys[number]]>
      | null => {
      if (
        typeof metas2 !== "object" || metas2 === null ||
        !Mappings.is_not_concrete_empty(metas2)
      ) {
        return null;
      }
      let res: string | null = null;
      for (const key of keys) {
        if (key in metas2) {
          // deno-lint-ignore no-explicit-any
          const _k: string & keyof typeof metas2 = key as any;
          res = Strs.is_not_blank(metas2[_k]) && metas2[_k] !== "无"
            ? metas2[_k]
            : null;
        }
        if (res !== null) {
          // deno-lint-ignore no-explicit-any
          return res as any;
        }
      }
      // deno-lint-ignore no-explicit-any
      return res as any;
    };
    const og_site_name = read_metas(["og:site_name", "og_site_name"]);
    const og_type = read_metas(["og:type", "og_type"]);
    const og_title = read_metas(["og:title", "og_title"]) ??
      read_metas2(["title", "twitter:title"]);
    const og_url = read_metas(["og:url", "og_url"]);
    const og_image = read_metas([
      "og:image",
      "og_image",
      "og:image:url",
    ]) ?? read_metas2(["twitter:image"]);
    const _video = read_metas(["og:video:secure_url", "og:video"]) ??
      read_metas2(["twitter:player:stream"]);
    const og_description = read_metas([
      "og:description",
      "og_description",
    ]) ?? read_metas2(["description", "twitter:description"]);
    const article_published_time = read_metas([
      "article:published_time",
      "og:article:published_time",
      "article_published_time",
    ]) ?? read_metas2(["article:published_time"]);
    const article_modified_time = read_metas([
      "article:modified_time",
      "og:article:modified_time",
      "article:modified_time",
    ]) ?? read_metas2(["article:modified_time", "last_updated_date"]);
    const article_section = read_metas([
      "article:section",
      "article_section",
    ]) ?? read_metas2(["article:section"]);
    const article_authors = read_metas(["og:article:author"]) ??
      read_metas2(["og_author"]);
    const article_tag = read_metas(["og:article:tag"]) ??
      read_metas2(["article:tag"]);

    let html2markdown: string | null;
    if ("html2markdown" in metainfo) {
      html2markdown = Strs.is_not_blank(metainfo.html2markdown)
        ? metainfo.html2markdown
        : null;
    } else {
      html2markdown = null;
    }
    const content_text_detail =
      html2markdown !== null && og_description !== null
        ? `${og_description}\n\n${html2markdown}`
        : html2markdown;
    const content_link_url = og_url
      ? DataClean.url_use_https_noempty(og_url)
      : null;
    const create_time = article_published_time
      ? Times.parse_text_to_instant(article_published_time, {
        allow_null: true,
      })
      : null;
    const update_time = article_modified_time
      ? Times.parse_text_to_instant(article_modified_time, {
        allow_null: true,
      })
      : null;
    let authors: MediaContentAuthor[];
    if (Strs.is_not_blank(article_authors)) {
      if (
        Strs.startswith(article_authors, "http://") ||
        Strs.startswith(article_authors, "https://")
      ) {
        const author_url = DataClean.url_use_https_noempty(article_authors);
        const last_path = Arrays.last_or_null(
          new URL(author_url).pathname.split("/"),
        );
        if (Strs.is_not_blank(last_path)) {
          authors = [
            {
              nickname: last_path.replaceAll("-", " ").replaceAll("_", " "),
              platform_user_id: `html_head_meta_article_author_${last_path}`,
              avater_url: null,
              home_link_url: author_url,
            },
          ];
        } else {
          authors = [];
        }
      } else {
        authors = article_authors.split(",")
          .map((article_author) => article_author.trim())
          .filter((article_author) => Strs.is_not_blank(article_author))
          .map((article_author) => {
            return {
              nickname: article_author,
              platform_user_id:
                `html_head_meta_article_author_${article_author}`,
              avater_url: null,
              home_link_url: null,
            };
          });
      }
    } else {
      authors = [];
    }
    let video_url: DataClean.HttpUrl | null = null;
    if (
      Strs.is_not_blank(_video) &&
      (Strs.startswith(_video, "http://") ||
        Strs.startswith(_video, "https://"))
    ) {
      video_url = DataClean.url_use_https_noempty(_video);
    }
    if (
      !og_title || !content_link_url || (!og_description && !html2markdown) ||
      !og_site_name || (!create_time && !update_time)
    ) {
      return;
    }
    let search_key: string | null = null;
    const { g_search_key, g_content } = garbage.obj;
    if (
      "cmd_param_url" in g_content &&
      typeof g_content.cmd_param_url === "object"
    ) {
      if ("query_dict" in g_content.cmd_param_url) {
        const { query_dict } = g_content.cmd_param_url;
        if (typeof query_dict === "object" && query_dict !== null) {
          if (
            search_key === null && "query" in query_dict &&
            typeof query_dict.query === "string" &&
            Strs.is_not_blank(query_dict.query)
          ) {
            search_key = query_dict.query;
          }
          if (
            search_key === null && "q" in query_dict &&
            typeof query_dict.q === "string" && Strs.is_not_blank(query_dict.q)
          ) {
            search_key = query_dict.q;
          }
          if (
            search_key === null && "k" in query_dict &&
            typeof query_dict.k === "string" && Strs.is_not_blank(query_dict.k)
          ) {
            search_key = query_dict.k;
          }
          if (
            search_key === null && "term" in query_dict &&
            typeof query_dict.term === "string" &&
            Strs.is_not_blank(query_dict.term)
          ) {
            search_key = query_dict.term;
          }
        }
      }
    }
    if (search_key === null && Strs.is_not_blank(g_search_key)) {
      search_key = g_search_key;
    }
    let platform: PlatformEnum;
    let platform_duplicate_id: string =
      `OgSiteName_${og_site_name}___${content_link_url}`;
    if (platform_duplicate_id.length > 400) {
      platform_duplicate_id = platform_duplicate_id.slice(0, 400);
    }
    switch (og_site_name) {
      case "The Washington Post":
        platform = PlatformEnum.WashingtonPost;
        break;
      case "万方数据知识服务平台":
        platform = PlatformEnum.万方;
        break;
      case "Reuters":
        platform = PlatformEnum.Reuters;
        break;
      case "AP News":
        platform = PlatformEnum.APNews;
        break;
      default:
        platform = PlatformEnum.未分类;
    }
    const res: MediaContent = {
      last_crawl_time: Times.parse_text_to_instant(garbage.obj.g_create_time),
      title: og_title,
      content_text_summary: og_description,
      content_text_detail,
      content_link_url,
      ip_location: null,
      cover_url: og_image ? DataClean.url_use_https_noempty(og_image) : null,
      tags: Streams.deduplicate([
        ...(og_type ? [{ text: `og:type=${og_type}` }] : []),
        ...(article_section ? [{ text: article_section }] : []),
        ...(article_tag
          ? article_tag.split(",").map((it) => ({ text: it }))
          : []),
      ]),
      authors,
      platform,
      platform_duplicate_id,
      create_time,
      update_time,
      count_like: null,
      count_share: null,
      count_star: null,
      count_comment: null,
      count_read: null,
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      platform_rank_score: null,
      from_search_context: [
        ...(search_key
          ? [{ question: search_key } satisfies MediaSearchContext]
          : []),
      ],
      videos: !video_url ? null : [
        {
          count_play: null,
          count_review: null,
          count_danmaku: null,
          download_urls: [
            {
              url: video_url,
              is_master: true,
              key: "master",
            },
          ],
          duration_sec: null,
        },
      ],
      literatures: null,
      language: null,
    };
    yield res;
  },
};
