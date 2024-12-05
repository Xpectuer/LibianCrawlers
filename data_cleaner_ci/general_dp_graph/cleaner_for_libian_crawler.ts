import {
  LibianCrawlerGarbage,
  read_LibianCrawlerGarbage,
} from "../user_code/LibianCrawlerGarbage.ts";
import { Json, sleep, Strs, Times } from "../util.ts";
import {
  MediaContent,
  MediaSearchContext,
  MediaVideo,
  PlatformEnum,
  MediaRelatedSearches,
} from "./media.ts";

export function xiaohongshu_note_content_link_url(param: {
  note_id: string;
  xsec_token: string;
}) {
  const { note_id, xsec_token } = param;
  return `https://www.xiaohongshu.com/discovery/item/${note_id}?source=webshare&xhsshare=pc_web&xsec_token=${xsec_token}`;
}

export function xiaohongshu_author_home_link_url(param: { user_id: string }) {
  const { user_id } = param;
  return `https://www.xiaohongshu.com/user/profile/${user_id}?channel_type=web_note_detail_r10&parent_page_channel_type=web_profile_board&xsec_token=&xsec_source=pc_note`;
}

export function xiaohongshu_related_searches() {}

export async function* cleaner_for_libian_crawler(_param?: {
  // deno-lint-ignore no-explicit-any
  logw?: (text: string, obj: any) => void;
}) {
  const __param = _param !== undefined ? _param : {};
  const { logw } = __param;
  const _logw = logw ?? ((text, obj) => console.warn(text, obj));
  while (1) {
    const garbage: LibianCrawlerGarbage = yield;
    if (garbage.group__xiaohongshu_note__) {
      const { g_content, g_search_key } = garbage.group__xiaohongshu_note__;
      const { note, note_id } = g_content;
      const {
        title,
        desc,
        ip_location,
        time,
        interact_info,
        tag_list,
        image_list,
        video,
        user,
        last_update_time,
      } = note;
      const xsec_token = g_content.xsec_token ?? note.xsec_token;
      const { share_count, liked_count, comment_count, collected_count } =
        interact_info;
      const cover_fileid = [
        video?.image.first_frame_fileid,
        video?.image.thumbnail_fileid,
      ].find((it) => !!it);
      let cover_image: (typeof image_list)[number] | null = null;
      if (!cover_image && cover_fileid) {
        cover_image =
          image_list.find((it) => it.file_id === cover_fileid) ?? null;
      }
      if (!cover_image && image_list.length > 0) {
        cover_image = image_list[0];
      }

      const res: MediaContent = {
        title,
        content_text_summary: desc,
        content_text_detail: desc,
        content_link_url: xiaohongshu_note_content_link_url({
          note_id,
          xsec_token,
        }),
        ip_location: ip_location ?? null,
        cover_url: cover_image?.url ?? null,
        tags: tag_list.map((tag) => ({ text: tag.name })),
        authors: [
          {
            nickname: user.nickname ?? user.nick_name,
            platform_user_id: user.user_id,
            avater_url: user.avatar,
            home_link_url: xiaohongshu_author_home_link_url({
              user_id: user.user_id,
            }),
          },
        ],
        platform: PlatformEnum.小红书,
        platform_duplicate_id: `${note.type}__${note_id}`,
        create_time: Times.unix_to_time(time),
        update_time: Times.unix_to_time(last_update_time),
        count_like: BigInt(Strs.parse_number(liked_count)),
        count_share: BigInt(Strs.parse_number(share_count)),
        count_star: BigInt(Strs.parse_number(collected_count)),
        count_comment: BigInt(Strs.parse_number(comment_count)),
        count_read: null,
        video_total_count_danmaku: null,
        video_total_duration_sec: video?.capa.duration ?? null,
        platform_rank_score: null,
        from_search_context: [
          ...(g_search_key
            ? [{ question: g_search_key } satisfies MediaSearchContext]
            : []),
        ],
        videos: [
          ...(video
            ? [
                {
                  count_play: null,
                  download_urls: Object.entries(video.media.stream).flatMap(
                    ([stream_key, streams]) =>
                      streams.flatMap((s) => [
                        {
                          url: s.master_url,
                          is_master: true,
                          key: `${stream_key}_master`,
                        },
                        ...s.backup_urls.map((it, idx) => ({
                          url: it,
                          is_master: false,
                          key: `${stream_key}_backup_${idx}`,
                        })),
                      ])
                  ),
                  duration_sec: video.capa.duration,
                  count_review: null,
                  count_danmaku: null,
                } satisfies MediaVideo,
              ]
            : []),
        ],
      };
      yield res;
    } else if (garbage.group__xiaohongshu_search_result__lib_xhs) {
      const { g_content, g_search_key, g_create_time } =
        garbage.group__xiaohongshu_search_result__lib_xhs;
      const { result } = g_content;
      const { items } = result;
      if (!items) {
        continue;
      }
      for (const item of items) {
        const { id, xsec_token, note_card, rec_query, hot_query } = item;
        if (note_card) {
          const { display_title, interact_info, user } = note_card;
          const res: MediaContent = {
            title: display_title ?? "",
            content_link_url: xiaohongshu_note_content_link_url({
              note_id: id,
              xsec_token,
            }),
            authors: [
              {
                nickname: user.nickname ?? user.nick_name,
                platform_user_id: user.user_id,
                avater_url: user.avatar,
                home_link_url: xiaohongshu_author_home_link_url({
                  user_id: user.user_id,
                }),
              },
            ],
            platform: PlatformEnum.小红书,
            platform_duplicate_id: `${note_card.type}__${id}`,
            count_like: BigInt(Strs.parse_number(interact_info.liked_count)),
            from_search_context: [
              {
                question: g_search_key,
              },
            ],
            create_time: null,
            update_time: null,
            tags: null,
            ip_location: null,
            count_share: null,
            count_star: null,
            count_comment: null,
            cover_url: null,
            platform_rank_score: null,
            videos: null,
            count_read: null,
            video_total_count_danmaku: null,
            video_total_duration_sec: null,
          };
          yield res;
        }
        type Query = NonNullable<typeof rec_query | typeof hot_query>;
        const query_mapper = (q: Query) => {
          const related_questions = q.queries.map(
            (it) =>
              ({
                name: it.name,
                cover_url: it.cover ?? null,
                search_word: it.search_word,
              } satisfies MediaRelatedSearches["related_questions"][number])
          );
          const res: MediaRelatedSearches = {
            question: g_search_key,
            related_questions,
            tip_text: q.title,
            request_time: g_create_time,
          };
          return res;
        };
        if (rec_query) {
          yield query_mapper(rec_query);
        }
        if (hot_query) {
          yield query_mapper(hot_query);
        }
      }
    } else if (
      garbage["group__bilibili_search_result__lib_bilibili-api-python"]
    ) {
      const { g_content, g_search_key } =
        garbage["group__bilibili_search_result__lib_bilibili-api-python"];
      const search_result_list = g_content.result.obj.result;
      for (const search_result of search_result_list) {
        const {
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
        const duration_sec = Times.parse_duration_sec(duration);
        if (typeof duration_sec === "string") {
          _logw("Parse duration failed !", duration);
        }
        const res: MediaContent = {
          title,
          content_text_summary: description,
          content_text_detail: description,
          content_link_url: `https://www.bilibili.com/video/${bvid}`,
          authors: [
            {
              nickname: author,
              avater_url: upic,
              platform_user_id: mid,
              home_link_url: `https://space.bilibili.com/${mid}`,
            },
          ],
          platform: PlatformEnum.哔哩哔哩,
          platform_duplicate_id: bvid,
          platform_rank_score: BigInt(rank_score),
          count_read: BigInt(
            Math.max(play, like, review, video_review, favorites)
          ),
          count_like: BigInt(like),
          count_star: BigInt(favorites),
          video_total_count_danmaku: BigInt(danmaku),
          video_total_duration_sec:
            typeof duration_sec === "number" ? duration_sec : null,
          tags: [
            {
              text: search_result.typename,
            },
            ...tag.split(",").map((it) => ({ text: it.trim() })),
          ],
          create_time: Times.unix_to_time(pubdate),
          update_time: Times.unix_to_time(senddate),
          cover_url: `https:${pic}`,
          videos: null,
          from_search_context: [
            {
              question: g_search_key,
            },
          ],
          ip_location: null,
          count_share: null,
          count_comment: null,
        };
        yield res;
      }
    }
  }
}

async function _main() {
  const gen = cleaner_for_libian_crawler();
  for await (const garbages of read_LibianCrawlerGarbage()) {
    for (const garbage of garbages) {
      const media = await gen.next(garbage);
      // if (typeof media.value === "object" && "title" in media.value) {
      //   console.log("Output: ", Json.dump(media, { indent: 2 }));
      //   await sleep(1000);
      // }
      if (
        typeof media.value === "object" &&
        "title" in media.value &&
        media.value.video_total_duration_sec &&
        media.value.platform === "xiaohongshu.com"
      ) {
        console.log("Output: ", Json.dump(media, { indent: 2 }));
        await sleep(1000);
      }
      // if (
      //   typeof media.value === "object" &&
      //   "related_questions" in media.value
      // ) {
      //   console.log("Output: ", Json.dump(media, { indent: 2 }));
      //   await sleep(1000);
      // }
      //   console.log("Output: ", Json.dump(media, { indent: 2 }));
      //   await sleep(1000);
    }
  }
}

// ```
// deno run --allow-env=PG* general_dp_graph/cleaner_for_libian_crawler.ts
// ```
if (import.meta.main) {
  await _main();
}
