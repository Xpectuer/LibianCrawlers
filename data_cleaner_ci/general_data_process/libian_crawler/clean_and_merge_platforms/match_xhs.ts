import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  DataClean,
  is_nullish,
  Mappings,
  Strs,
  Times,
  Typings,
} from "../../../util.ts";
import {
  MediaContent,
  MediaContentAuthor,
  MediaRelatedSearches,
  MediaSearchContext,
  MediaVideo,
  PlatformEnum,
} from "../../common/media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_xhs_html: LibianCrawlerGarbageCleaner<
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
    const { template_parse_html_tree } = smart_crawl;
    if (
      "xhs" in template_parse_html_tree &&
      typeof template_parse_html_tree.xhs === "object" &&
      template_parse_html_tree.xhs &&
      "title" in template_parse_html_tree.xhs &&
      typeof template_parse_html_tree.xhs.title === "string" &&
      "author_username" in template_parse_html_tree.xhs &&
      typeof template_parse_html_tree.xhs.author_username === "string"
    ) {
      const from_search_context: MediaSearchContext[] = [];
      if (
        "dump_page_info" in smart_crawl.g_content &&
        smart_crawl.g_content.dump_page_info
      ) {
        // deno-lint-ignore no-explicit-any
        type ExcludeAnyArray<T> = T extends (infer X)[] ? any extends X ? never
          : X[]
          : never;

        const _all_steps_run =
          smart_crawl.g_content.dump_page_info.all_steps_run;

        const all_steps_run: ExcludeAnyArray<typeof _all_steps_run> =
          // deno-lint-ignore no-explicit-any
          _all_steps_run as any;
        const search_word = all_steps_run
          .find((it): it is { fn: "page_type"; args: string[] } =>
            typeof it === "object" && "fn" in it && "args" in it &&
            Array.isArray(it.args) &&
            it.fn === "page_type" && it.args.length === 2
          )?.args
          ?.at(1);
        if (typeof search_word === "string" && Strs.is_not_blank(search_word)) {
          from_search_context.push({
            question: search_word,
          });
        }
      }

      const { xhs } = template_parse_html_tree;
      const content_link_url_props = "dump_page_info" in smart_crawl.g_content
        ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait
          ?.url
        : null;
      if (typeof content_link_url_props?.url !== "string") {
        console.warn("Why content_link_url_props?.url not string ?", {
          content_link_url_props,
          xhs,
        });
        return;
      }
      const content_link_url = DataClean.url_use_https_noempty(
        content_link_url_props.url,
      );
      let platform_duplicate_id: string;
      if (
        Strs.startswith(
          content_link_url,
          "https://www.xiaohongshu.com/explore/",
        )
      ) {
        const match_res =
          /^https:\/\/www.xiaohongshu.com\/explore\/(.*)([?](.*))?$/g
            .exec(
              content_link_url,
            );
        if (match_res && match_res[1]) {
          platform_duplicate_id = match_res[1];
        } else {
          console.warn("Why match_res failed", {
            content_link_url_props,
            match_res,
            xhs,
          });
          return;
        }
      } else {
        console.warn("Why content_link_url not prefixed", {
          content_link_url_props,
          xhs,
        });
        return;
      }
      let content_text_detail: string | null;
      if ("desc" in xhs && typeof xhs.desc === "string") {
        content_text_detail = xhs.desc;
      } else {
        content_text_detail = null;
      }
      let author: MediaContentAuthor | null = null;
      if (xhs.author_username && xhs.author_link) {
        const home_link_url = Arrays.first_or_null(
          xhs.author_link.map((it) => {
            let u: string = it;
            if (!Strs.startswith(u, "https://")) {
              u = ["https://xiaohongshu.com", u]
                .map((it) => Strs.remove_prefix_suffix_recursion(it, "/"))
                .join("/");
            }
            return DataClean.url_use_https_noempty(u);
          }),
        );
        if (!home_link_url) {
          return;
        }
        let platform_user_id: string | undefined;
        if (
          Strs.startswith(
            home_link_url,
            "https://xiaohongshu.com/user/profile/",
          )
        ) {
          platform_user_id = Strs.remove_prefix(
            home_link_url,
            "https://xiaohongshu.com/user/profile/",
          )
            .split(/[\/\?]/g)
            .at(0);
        } else {
          console.warn(
            "Why home link url not startwith xhs user profile ?",
            { home_link_url, xhs },
          );
          return;
        }
        if (!platform_user_id) {
          console.warn("Why platform_user_id invalid ?", {
            platform_user_id,
            xhs,
          });
          return;
        }
        author = {
          nickname: xhs.author_username,
          avater_url: DataClean.url_use_https_emptyable(
            xhs.author_avater,
          ),
          home_link_url,
          platform_user_id,
        };
      }
      const res: MediaContent = {
        last_crawl_time: Times.parse_text_to_instant(
          smart_crawl.g_create_time,
        ),
        title: xhs.title ?? "",
        content_text_summary: null,
        content_text_detail,
        content_link_url,
        authors: [...(author === null ? [] : [author])],
        platform: PlatformEnum.小红书,
        platform_duplicate_id,
        count_read: null,
        count_like: xhs.like
          ? xhs.like === "点赞"
            ? BigInt(0)
            : DataClean.cast_and_must_be_natural_number(
              DataClean.parse_number(xhs.like, "raise"),
            )
          : null,
        from_search_context,
        create_time: null,
        update_time: null,
        tags: null,
        ip_location: null,
        cover_url: DataClean.url_use_https_emptyable(
          LibianCrawlerCleanAndMergeUtil.get_screenshot(smart_crawl),
        ),
        count_share: null,
        count_star: xhs.collect
          ? xhs.collect === "收藏"
            ? BigInt(0)
            : DataClean.cast_and_must_be_natural_number(
              DataClean.parse_number(xhs.collect, "raise"),
            )
          : null,
        video_total_count_danmaku: null,
        video_total_duration_sec: null,
        count_comment: xhs.comment
          ? xhs.comment === "评论"
            ? BigInt(0)
            : DataClean.cast_and_must_be_natural_number(
              DataClean.parse_number(xhs.comment, "raise"),
            )
          : null,
        platform_rank_score: null,
        videos: null,
        literatures: null,
        language: null,
      };
      yield res;
    }
  },
};

export const match_xhs_apilib_search_list: LibianCrawlerGarbageCleaner<
  MediaContent | MediaRelatedSearches
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
    if (
      "group__xiaohongshu_search_result__lib_xhs" in garbage &&
      garbage.group__xiaohongshu_search_result__lib_xhs
    ) {
      const { g_content, g_search_key } =
        garbage.group__xiaohongshu_search_result__lib_xhs;
      const { result } = g_content;
      if (!("items" in result)) {
        return;
      }
      const { items } = result;
      if (!items) {
        return;
      }
      const g_create_time: string =
        garbage.group__xiaohongshu_search_result__lib_xhs.g_create_time;
      for (const item of items) {
        const { id, xsec_token, note_card } = item;
        const rec_query = "rec_query" in item ? item.rec_query : null;
        const hot_query = "hot_query" in item ? item.hot_query : null;
        if (note_card) {
          const { display_title, interact_info, user } = note_card;
          const res: MediaContent = {
            last_crawl_time: Times.parse_text_to_instant(g_create_time),
            title: display_title ?? "",
            content_link_url: LibianCrawlerCleanAndMergeUtil
              .xiaohongshu_note_content_link_url(
                {
                  note_id: id,
                  xsec_token,
                },
              ),
            content_text_summary: null,
            content_text_detail: null,
            authors: [
              {
                nickname: user.nickname ?? user.nick_name,
                platform_user_id: user.user_id,
                avater_url: DataClean.url_use_https_noempty(user.avatar),
                home_link_url: LibianCrawlerCleanAndMergeUtil
                  .xiaohongshu_author_home_link_url(
                    {
                      user_id: user.user_id,
                    },
                  ),
              },
            ],
            platform: PlatformEnum.小红书,
            platform_duplicate_id: `${note_card.type}__${id}`,
            count_like: DataClean.cast_and_must_be_natural_number(
              DataClean.parse_number(interact_info.liked_count),
            ),
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
            literatures: null,
            language: null,
          };
          yield res;
        }
        type Query = NonNullable<typeof rec_query | typeof hot_query>;
        const query_mapper = (_q: Query) => {
          const q = DataClean.type_flag(_q);
          const related_questions = q.queries.map(
            (it: typeof q["queries"][number]) => ({
              name: it.name,
              cover_url: DataClean.url_use_https_emptyable(
                "cover" in it ? it.cover ?? null : null,
              ),
              search_word: it.search_word,
            } satisfies MediaRelatedSearches["related_questions"][number]),
          );
          const request_time = Times.parse_text_to_instant(g_create_time);
          const res: MediaRelatedSearches = {
            question: g_search_key,
            related_questions,
            tip_text: q.title,
            request_time,
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
  },
};

export const match_xhs_apilib_note: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    if (
      "group__xiaohongshu_note__" in garbage &&
      garbage.group__xiaohongshu_note__
    ) {
      const { g_content, g_search_key } = garbage.group__xiaohongshu_note__;
      const g_create_time: string =
        garbage.group__xiaohongshu_note__.g_create_time;
      const { note, note_id } = g_content;
      const {
        title,
        desc,
        time,
        interact_info,
        tag_list,
        image_list,
        user,
        last_update_time,
      } = note;
      const ip_location = "ip_location" in note
        ? note.ip_location ? note.ip_location : null
        : null;
      const video = "video" in note ? (note.video ? note.video : null) : null;
      const xsec_token = g_content.xsec_token ?? note.xsec_token;
      const { share_count, liked_count, comment_count, collected_count } =
        interact_info;
      const first_frame_fileid = video?.image
        ? "first_frame_fileid" in video.image
          ? video.image.first_frame_fileid
          : null
        : null;
      const cover_fileid = [
        first_frame_fileid,
        video?.image.thumbnail_fileid,
      ].find((it) => !!it);
      let cover_image: (typeof image_list)[number] | null = null;
      if (!cover_image && cover_fileid) {
        cover_image = image_list.find((it) => it.file_id === cover_fileid) ??
          null;
      }
      if (!cover_image && image_list.length > 0) {
        cover_image = image_list[0];
      }

      const res: MediaContent = {
        last_crawl_time: Times.parse_text_to_instant(g_create_time),
        title,
        content_text_summary: desc,
        content_text_detail: desc,
        content_link_url: LibianCrawlerCleanAndMergeUtil
          .xiaohongshu_note_content_link_url({
            note_id,
            xsec_token,
          }),
        ip_location: ip_location ?? null,
        cover_url: DataClean.url_use_https_emptyable(
          cover_image?.url ?? null,
        ),
        tags: tag_list.map((tag) => ({ text: tag.name })),
        authors: [
          {
            nickname: user.nickname,
            platform_user_id: user.user_id,
            avater_url: DataClean.url_use_https_noempty(user.avatar),
            home_link_url: LibianCrawlerCleanAndMergeUtil
              .xiaohongshu_author_home_link_url(
                {
                  user_id: user.user_id,
                },
              ),
          },
        ],
        platform: PlatformEnum.小红书,
        platform_duplicate_id: `${note.type}__${note_id}`,
        create_time: Times.unix_to_time(time),
        update_time: Times.unix_to_time(last_update_time),
        count_like: DataClean.cast_and_must_be_natural_number(
          DataClean.parse_number(liked_count),
        ),
        count_share: DataClean.cast_and_must_be_natural_number(
          DataClean.parse_number(share_count),
        ),
        count_star: DataClean.cast_and_must_be_natural_number(
          DataClean.parse_number(collected_count),
        ),
        count_comment: DataClean.cast_and_must_be_natural_number(
          DataClean.parse_number(comment_count),
        ),
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
                download_urls: Mappings.object_entries(
                  video.media.stream,
                ).flatMap(([stream_key, streams]) => {
                  const streams2: Typings.TuplifyUnion<
                    typeof streams
                  >[number] = streams;

                  return streams2.flatMap((s) => {
                    if (!("master_url" in s) || !("backup_urls" in s)) {
                      return [];
                    }
                    return [
                      {
                        url: DataClean.url_use_https_noempty(
                          s.master_url,
                        ),
                        is_master: true,
                        key: `${stream_key}_master`,
                      },
                      ...s.backup_urls.map((it, idx) => ({
                        url: DataClean.url_use_https_noempty(it),
                        is_master: false,
                        key: `${stream_key}_backup_${idx}`,
                      })),
                    ];
                  });
                }),
                duration_sec: video.capa.duration,
                count_review: null,
                count_danmaku: null,
              } satisfies MediaVideo,
            ]
            : []),
        ],
        literatures: null,
        language: null,
      };
      yield res;
    }
  },
};
