import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { Arrays, DataClean, is_nullish, Strs, Times } from "../../../util.ts";
import {
  MediaContent,
  MediaSearchContext,
  PlatformEnum,
} from "../../common/media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_baidu_search_result: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    if (!("obj" in garbage) || is_nullish(garbage.obj)) {
      return;
    }
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    const template_parse_html_tree = smart_crawl.template_parse_html_tree;
    if (
      template_parse_html_tree.baidu &&
      "results" in template_parse_html_tree.baidu
    ) {
      const baidu = DataClean.type_flag(
        template_parse_html_tree.baidu,
      );
      if ("results_v2" in baidu && baidu.results_v2) {
        const results = Arrays.is_array(baidu.results_v2)
          ? baidu.results_v2
          : [baidu.results_v2];
        for (const result of results) {
          const mu = result.root_attrs?.mu;
          if (
            !DataClean.is_not_blank_and_valid(result.title) ||
            !DataClean.is_not_blank_and_valid(mu)
          ) {
            console.warn("Skip invalid item in baidu.results_v2", { result });
            continue;
          }
          let content_link_url: DataClean.HttpUrl | "" = "";
          if (
            Strs.startswith(mu, "http://") || Strs.startswith(mu, "https://")
          ) {
            content_link_url = DataClean.url_use_https_noempty(mu);
          } else {
            for (
              const a_item of (
                Arrays.is_array(result.a_list)
                  ? result.a_list
                  : is_nullish(result.a_list)
                  ? []
                  : [result.a_list]
              )
            ) {
              if (
                DataClean.is_not_blank_and_valid(a_item.href) &&
                (Strs.startswith(a_item.href, "http://") ||
                  Strs.startswith(a_item.href, "https://"))
              ) {
                content_link_url = DataClean.url_use_https_noempty(a_item.href);
              }
            }
          }
          const platform_duplicate_id = `baidu_v2_mu_${encodeURIComponent(mu)}`;
          const author_name = result.cosc_source_text;
          const author_avatar = result.cos_avatar_img?.attrs?.src;
          const crawl_time = Times.parse_text_to_instant(
            smart_crawl.g_create_time,
          );
          const res: MediaContent = {
            last_crawl_time: crawl_time,
            title: result.title,
            content_text_summary: result.summary_text ?? null,
            content_text_detail: null,
            content_link_url,
            authors: DataClean.is_not_blank_and_valid(author_name)
              ? [
                {
                  platform_user_id: `AuthorName---${author_name}`,
                  nickname: author_name,
                  avater_url: DataClean.is_not_blank_and_valid(author_avatar) &&
                      (Strs.startswith(author_avatar, "http://") ||
                        Strs.startswith(author_avatar, "https://"))
                    ? DataClean.url_use_https_noempty(author_avatar)
                    : null,
                  home_link_url: null,
                },
              ]
              : [],
            platform: PlatformEnum.百度搜索,
            platform_duplicate_id,
            count_read: null,
            count_like: null,
            from_search_context: ((): MediaSearchContext[] => {
              const { query_dict } = "dump_page_info" in smart_crawl.g_content
                ? smart_crawl.g_content.dump_page_info?.frame_tree?.url ??
                  {}
                : {};
              if (
                query_dict &&
                "wd" in query_dict &&
                typeof query_dict.wd === "string"
              ) {
                return [{ question: query_dict.wd }];
              } else {
                return [];
              }
            })(),
            create_time: DataClean.is_not_blank_and_valid(result.time)
              ? Times.parse_text_to_instant(result.time, {
                crawl_time,
              })
              : null,
            update_time: null,
            tags: null,
            ip_location: null,
            cover_url: DataClean.url_use_https_emptyable(
              LibianCrawlerCleanAndMergeUtil.get_screenshot(smart_crawl),
            ),
            count_share: null,
            count_star: null,
            video_total_count_danmaku: null,
            video_total_duration_sec: null,
            count_comment: null,
            platform_rank_score: null,
            videos: null,
            literatures: null,
            language: null,
          };
          yield res;
          continue;
        }
      } else if (
        ("results" in baidu && baidu.results)
      ) {
        const baidu_results = DataClean.type_flag(baidu.results);
        for (const bdres of baidu_results) {
          if (!bdres.datatools.result) {
            console.warn("bdres.datatools invalid", {
              bdres,
            });
            continue;
          }
          const { title, url } = bdres.datatools.result;
          const content_link_url = DataClean.url_use_https_noempty(url);
          let platform_duplicate_id: string;
          if (
            Strs.startswith(
              content_link_url,
              "https://www.baidu.com/link?url=",
            )
          ) {
            platform_duplicate_id = Strs.remove_prefix(
              content_link_url,
              "https://www.baidu.com/link?url=",
            );
          } else {
            console.warn(
              "content link url prefix not match , it is :",
              content_link_url,
            );
            continue;
          }
          const res: MediaContent = {
            last_crawl_time: Times.parse_text_to_instant(
              smart_crawl.g_create_time,
            ),
            title,
            content_text_summary: bdres.rows,
            content_text_detail: null,
            content_link_url,
            authors: [],
            platform: PlatformEnum.百度搜索,
            platform_duplicate_id,
            count_read: null,
            count_like: null,
            from_search_context: ((): MediaSearchContext[] => {
              const { query_dict } = "dump_page_info" in smart_crawl.g_content
                ? smart_crawl.g_content.dump_page_info?.frame_tree?.url ??
                  {}
                : {};
              if (
                query_dict &&
                "wd" in query_dict &&
                typeof query_dict.wd === "string"
              ) {
                return [{ question: query_dict.wd }];
              } else {
                return [];
              }
            })(),
            create_time: null,
            update_time: null,
            tags: null,
            ip_location: null,
            cover_url: DataClean.url_use_https_emptyable(
              LibianCrawlerCleanAndMergeUtil.get_screenshot(smart_crawl),
            ),
            count_share: null,
            count_star: null,
            video_total_count_danmaku: null,
            video_total_duration_sec: null,
            count_comment: null,
            platform_rank_score: null,
            videos: null,
            literatures: null,
            language: null,
          };
          yield res;
          continue;
        }
      }
    }
  },
};
