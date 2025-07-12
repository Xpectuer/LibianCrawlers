import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { DataClean, Errors, Times } from "../../../util.ts";
import { MediaContent, PlatformEnum } from "../../media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_bilibili_api_search_result: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    if (
      "group__bilibili_search_result__lib_bilibili-api-python" in garbage &&
      garbage["group__bilibili_search_result__lib_bilibili-api-python"]
    ) {
      const { g_content, g_search_key } =
        garbage["group__bilibili_search_result__lib_bilibili-api-python"];
      const g_create_time: string =
        garbage["group__bilibili_search_result__lib_bilibili-api-python"]
          .g_create_time;
      const search_result_list = g_content.result.obj.result;
      for (const search_result of search_result_list) {
        const {
          aid,
          arcurl,
          bvid,
          title,
          description,
          author,
          upic,
          pic,
          danmaku,
          tag,
          review,
          pubdate,
          senddate,
          video_review,
          play,
          favorites,
          rank_score,
          mid,
          like,
          duration,
        } = search_result;
        const duration_sec = duration.trim() === ""
          ? null
          : Times.parse_duration_sec(duration);
        if (typeof duration_sec === "string") {
          console.warn("Parse duration failed !", [
            duration,
            `Reason: ${duration_sec}`,
          ]);
        }
        let content_link_url: DataClean.HttpUrl;
        let platform_duplicate_id: string;
        if (bvid.trim() === "") {
          const _type = search_result.type;
          if (_type.trim() === "" || aid === 0) {
            Errors.throw_and_format("Missing bvid", search_result);
          } else {
            platform_duplicate_id = `${_type}__${aid}`;
            if (_type === "ketang") {
              content_link_url = DataClean.url_use_https_noempty(arcurl);
            } else {
              Errors.throw_and_format(
                "Missing bvid and invalid type",
                search_result,
              );
            }
          }
        } else {
          content_link_url = `https://www.bilibili.com/video/${bvid}`;
          platform_duplicate_id = `bvid__${bvid}`;
        }
        const res: MediaContent = {
          last_crawl_time: Times.parse_text_to_instant(g_create_time),
          title,
          content_text_summary: description,
          content_text_detail: description,
          content_link_url,
          authors: [
            {
              nickname: author,
              avater_url: DataClean.url_use_https_emptyable(upic),
              platform_user_id: mid,
              home_link_url: `https://space.bilibili.com/${mid}`,
            },
          ],
          platform: PlatformEnum.哔哩哔哩,
          platform_duplicate_id,
          platform_rank_score: DataClean.nan_infinity_to_null(rank_score),
          count_read: DataClean.cast_and_must_be_natural_number(
            Math.max(play, like, review, video_review, favorites),
          ),
          count_like: DataClean.cast_and_must_be_natural_number(like),
          count_star: DataClean.cast_and_must_be_natural_number(favorites),
          video_total_count_danmaku: DataClean
            .cast_and_must_be_natural_number(danmaku),
          video_total_duration_sec: DataClean.nan_infinity_to_null(
            duration_sec,
          ),
          tags: [
            {
              text: search_result.typename,
            },
            ...tag.split(",").map((it) => ({ text: it.trim() })),
          ],
          create_time: Times.unix_to_time(pubdate),
          update_time: Times.unix_to_time(senddate),
          cover_url: DataClean.url_use_https_noempty(pic),
          videos: null,
          from_search_context: [
            {
              question: g_search_key,
            },
          ],
          ip_location: null,
          count_share: null,
          count_comment: null,
          literatures: null,
          language: null,
        };
        yield res;
      }
    }
  },
};
