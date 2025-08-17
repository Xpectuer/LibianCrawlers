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
import { get_wanfangdata_platform_duplicate_id } from "./match_wanfangdata.ts";
import { parse_metainfo } from "./util.ts";

export const match_metainfo: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const metainfo_parsed = parse_metainfo(garbage);
    if (!metainfo_parsed) {
      return;
    }
    const {
      og_site_name,
      og_type,
      og_title,
      og_image,
      og_description,
      article_section,
      article_tag,
      html2markdown,
      content_text_detail,
      content_link_url,
      create_time,
      update_time,
      video_url,
    } = metainfo_parsed;
    let {
      authors,
    } = metainfo_parsed;
    authors = Streams.deduplicate(
      authors.filter((it) => DataClean.is_not_blank_and_valid(it.nickname)),
      (a, b) => a.nickname === b.nickname,
    );
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
            typeof query_dict.q === "string" && DataClean.is_not_blank_and_valid(query_dict.q)
          ) {
            search_key = query_dict.q;
          }
          if (
            search_key === null && "k" in query_dict &&
            typeof query_dict.k === "string" && DataClean.is_not_blank_and_valid(query_dict.k)
          ) {
            search_key = query_dict.k;
          }
          if (
            search_key === null && "term" in query_dict &&
            typeof query_dict.term === "string" &&
            DataClean.is_not_blank_and_valid(query_dict.term)
          ) {
            search_key = query_dict.term;
          }
        }
      }
    }
    if (search_key === null && Strs.is_not_blank(g_search_key)) {
      search_key = g_search_key;
    }
    const title = og_title;
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
        platform_duplicate_id = get_wanfangdata_platform_duplicate_id({
          title,
          authors,
        });
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
      title,
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
