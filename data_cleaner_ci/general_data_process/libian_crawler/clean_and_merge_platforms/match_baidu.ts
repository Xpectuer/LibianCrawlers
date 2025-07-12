import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { DataClean, Strs, Times } from "../../../util.ts";
import { MediaContent, MediaSearchContext, PlatformEnum } from "../../media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_baidu_search_result: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    const { template_parse_html_tree } = smart_crawl;
    if (
      template_parse_html_tree.baidu &&
      "results" in template_parse_html_tree.baidu &&
      template_parse_html_tree.baidu.results
    ) {
      for (const bdres of template_parse_html_tree.baidu.results) {
        if (!bdres.datatools.result) {
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
  },
};
