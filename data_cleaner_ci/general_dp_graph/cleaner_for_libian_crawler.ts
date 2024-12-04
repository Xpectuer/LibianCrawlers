import { read_TJNocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/TJNocoPGLibianCrawlerGarbage_api.ts";
import { LibianCrawlerGarbage } from "../user_code/LibianCrawlerGarbage.ts";
import { Json, sleep, Strs, Times } from "../util.ts";
import {
  MediaContent,
  MediaContentSimple,
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

export async function* cleaner_for_libian_crawler() {
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
                  danmu_count: null,
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
          const res: MediaContentSimple = {
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
    }
  }
}

async function _main() {
  const gen = cleaner_for_libian_crawler();
  for await (const garbages of read_TJNocoPGLibianCrawlerGarbage()) {
    for (const garbage of garbages) {
      const media = await gen.next(garbage);
      if (typeof media.value === "object" && "title" in media.value) {
        console.log("Output: ", Json.dump(media, { indent: 2 }));
        await sleep(1000);
      }
      //   if (
      //     typeof media.value === "object" &&
      //     "related_questions" in media.value
      //   ) {
      //     console.log("Output: ", Json.dump(media, { indent: 2 }));
      //     await sleep(1000);
      //   }
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
