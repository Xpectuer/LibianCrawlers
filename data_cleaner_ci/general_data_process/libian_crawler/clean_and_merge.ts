import { platform } from "node:os";
import {
  LibianCrawlerGarbage,
  read_LibianCrawlerGarbage,
} from "../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  chain,
  DataClean,
  DataCleanJsHtmlTree,
  DataMerge,
  Errors,
  is_deep_equal,
  is_nullish,
  Mappings,
  Nums,
  ProcessBar,
  Streams,
  Strs,
  Times,
  Trees,
  Typings,
} from "../../util.ts";
import { create_cache_in_memory } from "../caches.ts";
import {
  MediaContent,
  MediaSearchContext,
  MediaVideo,
  PlatformEnum,
  MediaRelatedSearches,
  MediaContentAuthor,
  MediaContentTag,
} from "../media.ts";
import { Paragraphs } from "../paragraph_analysis.ts";
import {
  create_and_init_libian_srawler_database_scope,
  MediaPostTable,
} from "./data_storage.ts";

export function xiaohongshu_note_content_link_url(param: {
  note_id: string;
  xsec_token: string;
}) {
  const { note_id, xsec_token } = param;
  return `https://www.xiaohongshu.com/discovery/item/${note_id}?source=webshare&xhsshare=pc_web&xsec_token=${xsec_token}` as const;
}

export function xiaohongshu_author_home_link_url(param: { user_id: string }) {
  const { user_id } = param;
  return `https://www.xiaohongshu.com/user/profile/${user_id}?channel_type=web_note_detail_r10&parent_page_channel_type=web_profile_board&xsec_token=&xsec_source=pc_note` as const;
}

export function xiaohongshu_related_searches() {}

export async function* read_garbage_for_libian_crawler(_param?: {
  // deno-lint-ignore no-explicit-any
  logw?: (text: string, obj: any) => void;
}) {
  const __param = _param !== undefined ? _param : {};
  const { logw } = __param;
  const _logw = logw ?? ((text, obj) => console.warn(text, obj));
  while (1) {
    const garbage: LibianCrawlerGarbage = yield;
    try {
      if (garbage.group__xiaohongshu_note__) {
        const { g_content, g_search_key } = garbage.group__xiaohongshu_note__;
        const g_create_time = garbage.group__xiaohongshu_note__
          .g_create_time as any as string;
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
          last_crawl_time: Times.parse_text_to_instant(g_create_time),
          title,
          content_text_summary: desc,
          content_text_detail: desc,
          content_link_url: xiaohongshu_note_content_link_url({
            note_id,
            xsec_token,
          }),
          ip_location: ip_location ?? null,
          cover_url: DataClean.url_use_https_emptyable(
            cover_image?.url ?? null
          ),
          tags: tag_list.map((tag) => ({ text: tag.name })),
          authors: [
            {
              nickname: user.nickname ?? user.nick_name,
              platform_user_id: user.user_id,
              avater_url: DataClean.url_use_https_noempty(user.avatar),
              home_link_url: xiaohongshu_author_home_link_url({
                user_id: user.user_id,
              }),
            },
          ],
          platform: PlatformEnum.小红书,
          platform_duplicate_id: `${note.type}__${note_id}`,
          create_time: Times.unix_to_time(time),
          update_time: Times.unix_to_time(last_update_time),
          count_like: DataClean.cast_and_must_be_natural_number(
            DataClean.parse_number(liked_count)
          ),
          count_share: DataClean.cast_and_must_be_natural_number(
            DataClean.parse_number(share_count)
          ),
          count_star: DataClean.cast_and_must_be_natural_number(
            DataClean.parse_number(collected_count)
          ),
          count_comment: DataClean.cast_and_must_be_natural_number(
            DataClean.parse_number(comment_count)
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
                    download_urls: Object.entries(video.media.stream).flatMap(
                      ([stream_key, streams]) =>
                        streams.flatMap((s) => [
                          {
                            url: DataClean.url_use_https_noempty(s.master_url),
                            is_master: true,
                            key: `${stream_key}_master`,
                          },
                          ...s.backup_urls.map((it, idx) => ({
                            url: DataClean.url_use_https_noempty(it),
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
        const { g_content, g_search_key } =
          garbage.group__xiaohongshu_search_result__lib_xhs;
        const { result } = g_content;
        const { items } = result;
        if (!items) {
          continue;
        }
        const g_create_time = garbage.group__xiaohongshu_search_result__lib_xhs
          .g_create_time as any as string;
        for (const item of items) {
          const { id, xsec_token, note_card, rec_query, hot_query } = item;
          if (note_card) {
            const { display_title, interact_info, user } = note_card;
            const res: MediaContent = {
              last_crawl_time: Times.parse_text_to_instant(g_create_time),
              title: display_title ?? "",
              content_link_url: xiaohongshu_note_content_link_url({
                note_id: id,
                xsec_token,
              }),
              content_text_summary: null,
              content_text_detail: null,
              authors: [
                {
                  nickname: user.nickname ?? user.nick_name,
                  platform_user_id: user.user_id,
                  avater_url: DataClean.url_use_https_noempty(user.avatar),
                  home_link_url: xiaohongshu_author_home_link_url({
                    user_id: user.user_id,
                  }),
                },
              ],
              platform: PlatformEnum.小红书,
              platform_duplicate_id: `${note_card.type}__${id}`,
              count_like: DataClean.cast_and_must_be_natural_number(
                DataClean.parse_number(interact_info.liked_count)
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
            };
            yield res;
          }
          type Query = NonNullable<typeof rec_query | typeof hot_query>;
          const query_mapper = (q: Query) => {
            const related_questions = q.queries.map(
              (it) =>
                ({
                  name: it.name,
                  cover_url: DataClean.url_use_https_emptyable(
                    it.cover ?? null
                  ),
                  search_word: it.search_word,
                } satisfies MediaRelatedSearches["related_questions"][number])
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
      } else if (
        garbage["group__bilibili_search_result__lib_bilibili-api-python"]
      ) {
        const { g_content, g_search_key } =
          garbage["group__bilibili_search_result__lib_bilibili-api-python"];
        const g_create_time = garbage[
          "group__bilibili_search_result__lib_bilibili-api-python"
        ].g_create_time as any as string;
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
          const duration_sec =
            duration.trim() === "" ? null : Times.parse_duration_sec(duration);
          if (typeof duration_sec === "string") {
            _logw("Parse duration failed !", [
              duration,
              `Reason: ${duration_sec}`,
            ]);
          }
          let content_link_url: DataClean.HttpUrl;
          let platform_duplicate_id: string;
          if (bvid.trim() === "") {
            const _type = search_result.type;
            if (_type.trim() === "" || aid === 0) {
              Errors.logerror_and_throw("Missing bvid", search_result);
            } else {
              platform_duplicate_id = `${_type}__${aid}`;
              if (_type === "ketang") {
                content_link_url = DataClean.url_use_https_noempty(arcurl);
              } else {
                Errors.logerror_and_throw(
                  "Missing bvid and invalid type",
                  search_result
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
              Math.max(play, like, review, video_review, favorites)
            ),
            count_like: DataClean.cast_and_must_be_natural_number(like),
            count_star: DataClean.cast_and_must_be_natural_number(favorites),
            video_total_count_danmaku:
              DataClean.cast_and_must_be_natural_number(danmaku),
            video_total_duration_sec: DataClean.nan_infinity_to_null(duration_sec),
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
          };
          yield res;
        }
      } else {
        const p_entry =
          Mappings.find_entry_which_defined_value_and_key_startswith(
            "group__webpage_smart_extract",
            garbage
          );
        if (p_entry) {
          const g_create_time = p_entry[1].g_create_time as any as string;
          const p_waited_title =
            p_entry[1].g_content.page_info_smart_wait.title;
          const p_waited_url =
            p_entry[1].g_content.page_info_smart_wait.url.url;
          const p_resp_goto_title =
            p_entry[1].g_content.common_info.body_resp_goto.html_info?.title
              ?.str;
          const param_url = p_entry[1].g_content.cmd_param_json?.url;
          // const a_root =
          //   webpage_entry[1].g_content.common_info.body_resp_goto.html_info?.root;
          // if (a_root) {
          //   for (const node of Trees.travel_node({
          //     root: a_root,
          //     children_key: "children",
          //   })) {

          //   }
          // }
          const content_link_url: DataClean.HttpUrl =
            DataClean.url_use_https_noempty(
              Streams.find_first(Strs.is_not_blank, [param_url])?.item ??
                p_waited_url
            );
          const match_xhs_explore_note_id =
            /xiaohongshu\.com\/explore\/([a-zA-Z0-9]+)/.exec(content_link_url);

          // const xsec_token =
          //   /xsec_token=([A-Za-z0-9=])+/.exec(content_link_url)?.at(1) ?? null;

          // const xhs_note_entry =
          //   Mappings.find_entry_which_defined_value_and_key_startswith(
          //     "group__webpage_smart_extract__xhs_note:",
          //     garbage
          //   );

          if (match_xhs_explore_note_id) {
            const xhs_note_id = match_xhs_explore_note_id[1];
            const xhs_note = p_entry[1];
            const html_root =
              xhs_note.g_content.common_info.page_content.html_info?.root;

            if (html_root) {
              let title: string | null = null;
              let author_first_nickname: string = "";
              let author_first_avater_url: DataClean.HttpUrl | null = null;
              let author_first_home_link_url: DataClean.HttpUrl | null = null;
              let author_first_platform_user_id: string | number | null = null;
              let tags: MediaContentTag[] | null = null;
              let desc: string = "";
              let count_like: DataClean.NaturalNumber | null = null;
              let from_search_context: MediaSearchContext[] = [];
              let create_time: Date | null = null;
              let update_time: Date | null = null;
              let ip_location: string | null = null;
              let cover_url: DataClean.HttpUrl | null = null;
              let count_share: DataClean.NaturalNumber | null = null;
              let count_star: DataClean.NaturalNumber | null = null;
              let count_comment: DataClean.NaturalNumber | null = null;
              for (const node of Trees.travel_node_dfs({
                root: html_root,
                children_key: "children",
              })) {
                if (
                  DataCleanJsHtmlTree.has_class_no_typeguard(
                    node,
                    "author-container"
                  )
                ) {
                  if (node.children) {
                    for (const node2 of node.children.flatMap((it) => [
                      ...Trees.travel_node_dfs({
                        root: it,
                        children_key: "children",
                      }),
                    ])) {
                      if (
                        DataCleanJsHtmlTree.has_class(node2, "username") &&
                        Strs.is_not_blank(node2.str)
                      ) {
                        author_first_nickname = node2.str;
                      }
                      if (
                        DataCleanJsHtmlTree.has_class_no_typeguard(
                          node2,
                          "avater-item"
                        ) &&
                        node2.name === "img" &&
                        "src" in node2.attrs &&
                        Strs.is_not_blank(node2.attrs.src)
                      ) {
                        author_first_avater_url =
                          DataClean.url_use_https_noempty(node2.attrs.src);
                      }

                      if (
                        node2.name === "a" &&
                        node2.attrs &&
                        "href" in node2.attrs &&
                        Strs.is_not_blank(node2.attrs.href)
                      ) {
                        const user_profiles =
                          /\/user\/profile\/([a-zA-Z0-9]+)/.exec(
                            node2.attrs.href
                          );
                        if (user_profiles) {
                          author_first_home_link_url =
                            DataClean.url_use_https_noempty(
                              "https://www.xiaohongshu.com" + node2.attrs.href
                            );
                          author_first_platform_user_id = user_profiles[1];
                        }
                      }
                    }
                  }
                }
                if (
                  node.attrs &&
                  "id" in node.attrs &&
                  node.attrs.id === "detail-title" &&
                  typeof node.str === "string" &&
                  Strs.is_not_blank(node.str)
                ) {
                  // console.debug("title node", node);
                  title = node.str;
                }
                if (
                  node.attrs &&
                  "id" in node.attrs &&
                  node.attrs.id === "detail-desc"
                ) {
                  if (node.children) {
                    for (const node2 of node.children.flatMap((it) => [
                      ...Trees.travel_node_dfs({
                        root: it,
                        children_key: "children",
                      }),
                    ])) {
                      if (
                        DataCleanJsHtmlTree.has_class(node2, "tag") &&
                        typeof node2.str === "string"
                      ) {
                        if (tags === null) {
                          tags = [];
                        }
                        let tag_text = node2.str;
                        if (Strs.startswith(tag_text, "#")) {
                          tag_text = Strs.remove_prefix(tag_text, "#");
                        }
                        tags.push({
                          text: tag_text,
                          ...("href" in node2.attrs &&
                          Strs.is_not_blank(node2.attrs.href)
                            ? {
                                url: DataClean.url_use_https_noempty(
                                  node2.attrs.href
                                ),
                              }
                            : {}),
                        });
                      } else if (
                        typeof node2.str === "string" &&
                        node2.bs4_type !== "<class 'bs4.element.Comment'>"
                      ) {
                        let s = node2.str;
                        if (!Strs.is_not_blank(node2.str)) {
                          s = " ";
                        }
                        if (!Strs.endswith(desc, " ")) {
                          desc += s;
                        }
                      }
                    }
                  }
                }
                if (
                  DataCleanJsHtmlTree.has_class_no_typeguard(
                    node,
                    "bottom-container"
                  )
                ) {
                  if (node.children) {
                    for (const node2 of node.children.flatMap((it) => [
                      ...Trees.travel_node_dfs({
                        root: it,
                        children_key: "children",
                      }),
                    ])) {
                      if (
                        DataCleanJsHtmlTree.has_class(node2, "date") &&
                        Strs.is_not_blank(node2.str)
                      ) {
                        // const { edited } = DataClean.parse_gray_font_at_note_end({
                        //   crawl_time: g_create_time,
                        //   text: node2.str,
                        // });
                      }
                    }
                  }
                }

                if (
                  DataCleanJsHtmlTree.has_class_no_typeguard(
                    node,
                    "interactions"
                  )
                  // ||
                  // DataCleanJsHtmlTree.has_class_no_typeguard(
                  //   node,
                  //   "interaction-container"
                  // )
                ) {
                  if (node.children) {
                    for (const node2 of node.children.flatMap((it) => [
                      ...Trees.travel_node_dfs({
                        root: it,
                        children_key: "children",
                      }),
                    ])) {
                      const find_count_in_children = () =>
                        chain(
                          () =>
                            node2
                              .children!.flatMap((it) => [
                                ...Trees.travel_node_dfs({
                                  root: it,
                                  children_key: "children",
                                }),
                              ])
                              .find((it) =>
                                DataCleanJsHtmlTree.has_class(it, "count")
                              )?.str
                        )
                          .map((it) =>
                            it
                              ? DataClean.cast_and_must_be_natural_number(
                                  DataClean.parse_number(it, (it) =>
                                    it === "赞"
                                      ? 0
                                      : (() => {
                                          throw new Error(`NaN of ${it}`);
                                        })()
                                  )
                                )
                              : null
                          )
                          .get_value();

                      if (
                        DataCleanJsHtmlTree.has_class(node2, "like-wrapper")
                      ) {
                        count_like = find_count_in_children();
                      }
                      if (
                        DataCleanJsHtmlTree.has_class_no_typeguard(
                          node2,
                          "collect-wrapper"
                        )
                      ) {
                        count_star = find_count_in_children();
                      }
                      if (
                        DataCleanJsHtmlTree.has_class_no_typeguard(
                          node2,
                          "chat-wrapper"
                        )
                      ) {
                        count_comment = find_count_in_children();
                      }
                    }
                  }
                }
              }
              if (Strs.endswith(desc, " ")) {
                desc = Strs.remove_suffix(desc, " ");
              }

              const res: MediaContent = {
                last_crawl_time: Times.parse_text_to_instant(g_create_time),
                title:
                  Streams.find_first(Strs.is_not_blank, [title])?.item ??
                  p_waited_title,
                content_text_summary: desc,
                content_text_detail: desc,
                content_link_url,
                authors: [
                  ...(author_first_home_link_url &&
                  author_first_platform_user_id
                    ? [
                        {
                          nickname: author_first_nickname,
                          avater_url: author_first_avater_url,
                          home_link_url: author_first_home_link_url,
                          platform_user_id: author_first_platform_user_id,
                        },
                      ]
                    : []),
                ],
                platform: PlatformEnum.小红书,
                platform_duplicate_id: `note__${xhs_note_id}`,
                count_read: null,
                count_like,
                from_search_context,
                create_time,
                update_time,
                tags,
                ip_location,
                cover_url,
                count_share,
                count_star,
                video_total_count_danmaku: null,
                video_total_duration_sec: null,
                count_comment,
                platform_rank_score: null,
                videos: null,
              };
              yield res;
            }
          }
        }
      }
    } catch (err) {
      // console.warn('',{garbage})
      throw new Error(
        `Failed on read garbage for libian crawler item : g_id is ${garbage.obj.g_id}`,
        {
          cause: err,
        }
      );
    }
  }
}

export type MediaContentMerged = Omit<
  MediaContent,
  | "count_read"
  | "title"
  | "ip_location"
  | "authors"
  | "content_link_url"
  | "from_search_context"
  | "cover_url"
  | "platform_rank_score"
  | "tags"
  | "content_text_summary"
  | "content_text_detail"
  | "videos"
> & {
  count_read: MediaContent["count_read"];
  title: Set<string>;
  title_timeline: DataMerge.Timeline<string>;
  ip_location: Set<string>;
  authors: Map<
    MediaContent["authors"][number]["platform_user_id"],
    DataMerge.Timeline<
      Omit<MediaContent["authors"][number], "platform_user_id">
    >
  >;
  content_link_urls: Set<string>;
  from_search_questions: Set<string>;
  cover_urls: Set<string>;
  platform_rank_score_timeline: DataMerge.Timeline<
    NonNullable<MediaContent["platform_rank_score"]>
  >;
  tag_texts: Set<string>;
  content_text_summary_uncleaned_timeline: DataMerge.Timeline<string>;
  content_text_detail_uncleaned_timeline: DataMerge.Timeline<string>;
};

export async function* merge_media_content_for_libian_crawler() {
  const all_key: Set<string> = new Set();
  const cache = create_cache_in_memory<MediaContentMerged>();
  const get_key = (m: MediaContent) =>
    `mc__${m.platform}__${m.platform_duplicate_id}`;
  const merge = (
    prev: MediaContentMerged | null,
    cur: MediaContent
  ): MediaContentMerged => {
    const to_timeline_item = <V>(value: V): DataMerge.Timeline<V>[number] => ({
      time: cur.update_time ?? cur.create_time ?? "unknown",
      value,
    });
    if (
      prev !== null &&
      (cur.platform !== prev.platform ||
        cur.platform_duplicate_id !== prev.platform_duplicate_id)
    ) {
      throw new Error(
        `Platform and id not match : cur.platform=${cur.platform} , prev.platform=${prev.platform} , cur.platform_duplicate_id=${cur.platform_duplicate_id} , prev.platform_duplicate_id=${prev.platform_duplicate_id}`
      );
    }
    const last_crawl_time = Nums.take_extreme_value("max", [
      prev?.last_crawl_time ?? null,
      cur.last_crawl_time,
    ]);
    const create_time = Nums.take_extreme_value("min", [
      prev?.update_time ?? null,
      cur.update_time,
      prev?.create_time ?? null,
      cur.create_time,
    ]);
    const update_time = Nums.take_extreme_value("max", [
      prev?.update_time ?? null,
      cur.update_time,
      prev?.create_time ?? null,
      cur.create_time,
    ]);
    const count_like = Nums.take_extreme_value("max", [
      prev?.count_like ?? null,
      cur.count_like,
    ]);
    const count_share = Nums.take_extreme_value("max", [
      prev?.count_share ?? null,
      cur.count_share,
    ]);
    const count_star = Nums.take_extreme_value("max", [
      prev?.count_star ?? null,
      cur.count_star,
    ]);
    const count_read = Nums.take_extreme_value("max", [
      prev?.count_read ?? null,
      cur.count_read,
      count_like,
      count_share,
      count_star,
    ]);
    const count_comment = Nums.take_extreme_value("max", [
      prev?.count_comment ?? null,
      cur.count_comment,
    ]);
    const video_total_count_danmaku = Nums.take_extreme_value("max", [
      prev?.video_total_count_danmaku ?? null,
      cur.video_total_count_danmaku,
    ]);
    const video_total_duration_sec = Nums.take_extreme_value("max", [
      prev?.video_total_duration_sec ?? null,
      cur.video_total_duration_sec,
    ]);
    const title = prev?.title ?? new Set();
    const cur_title = DataClean.strip_html(cur.title).trim();
    if (Strs.is_not_blank(cur_title)) {
      title.add(cur_title);
    }
    const title_timeline = DataMerge.merge_and_sort_timeline({
      old: prev?.title_timeline ?? [],
      timeline: chain(() => cur_title)
        .array_wrap_nonnull()
        .map((it) => to_timeline_item(it)),
    });
    const ip_location = prev?.ip_location ?? new Set();
    if (Strs.is_not_blank(cur.ip_location)) {
      ip_location.add(cur.ip_location);
    }
    const authors: MediaContentMerged["authors"] = prev?.authors ?? new Map();
    for (const author of cur.authors) {
      const { platform_user_id } = author;
      const authors_timeline = DataMerge.merge_and_sort_timeline({
        old: authors.get(platform_user_id) ?? [],
        timeline: chain(() => author)
          .array_wrap_nonnull()
          .map((it) => to_timeline_item(it)),
      });
      authors.set(platform_user_id, authors_timeline);
    }
    const content_link_urls = prev?.content_link_urls ?? new Set();
    if (Strs.is_not_blank(cur.content_link_url)) {
      content_link_urls.add(cur.content_link_url);
    }
    const from_search_questions = prev?.from_search_questions ?? new Set();
    if (Arrays.length_greater_then_0(cur.from_search_context)) {
      const { question } = Arrays.first(cur.from_search_context);
      if (Strs.is_not_blank(question)) {
        from_search_questions.add(question);
      }
    }
    const cover_urls = prev?.cover_urls ?? new Set();
    if (Strs.is_not_blank(cur.cover_url)) {
      cover_urls.add(cur.cover_url);
    }
    const tag_texts = prev?.tag_texts ?? new Set();
    const on_tag = (t: string) => {
      const tag = Paragraphs.to_tag(t);
      if (tag) {
        tag_texts.add(tag);
      }
    };
    if (!is_nullish(cur.tags)) {
      for (const tag of cur.tags) {
        on_tag(tag.text);
      }
    }
    const platform_rank_score_timeline = DataMerge.merge_and_sort_timeline({
      old: prev?.platform_rank_score_timeline ?? [],
      timeline: chain(() => cur.platform_rank_score)
        .array_wrap_nonnull()
        .map((it) => to_timeline_item(it)),
    });
    const content_text_summary_uncleaned = cur.content_text_summary;
    const content_text_summary_uncleaned_timeline =
      DataMerge.merge_and_sort_timeline({
        old: prev?.content_text_summary_uncleaned_timeline ?? [],
        timeline: chain(() => content_text_summary_uncleaned)
          .array_wrap_nonnull()
          .map((it) => to_timeline_item(it)),
      });
    const content_text_detail_uncleaned = cur.content_text_detail;
    const content_text_detail_uncleaned_timeline =
      DataMerge.merge_and_sort_timeline({
        old: prev?.content_text_detail_uncleaned_timeline ?? [],
        timeline: chain(() => content_text_detail_uncleaned)
          .array_wrap_nonnull()
          .map((it) => to_timeline_item(it)),
      });

    return {
      platform: cur.platform,
      platform_duplicate_id: cur.platform_duplicate_id,
      last_crawl_time,
      create_time,
      update_time,
      count_read,
      count_like,
      count_share,
      count_star,
      count_comment,
      video_total_count_danmaku,
      video_total_duration_sec,
      title,
      title_timeline,
      content_link_urls,
      from_search_questions,
      ip_location,
      authors,
      cover_urls,
      platform_rank_score_timeline,
      tag_texts,
      content_text_summary_uncleaned_timeline,
      content_text_detail_uncleaned_timeline,
    } satisfies MediaContentMerged;
  };
  while (1) {
    const content: MediaContent | "stop" = yield;
    try {
      if ("stop" === content) {
        break;
      }
      if (
        content.platform_duplicate_id.trim() === "" ||
        content.platform_duplicate_id.indexOf("null") >= 0 ||
        content.platform_duplicate_id.indexOf("undefined") >= 0
      ) {
        throw new Error(
          `content.platform_duplicate_id maybe invalid : ${content.platform_duplicate_id}`
        );
      }
      const k = get_key(content);
      all_key.add(k);
      const cache_get_result = cache.get_batch(new Set([k]));
      let exists: MediaContentMerged | null;
      if (cache_get_result[k]) {
        exists = await Promise.resolve(cache_get_result[k]);
      } else {
        exists = null;
      }
      const res = merge(exists, content);
      cache.set(k, res);
    } catch (err) {
      throw new Error(
        `Failed on merge : content is ${JSON.stringify(content)}`,
        { cause: err }
      );
    }
  }
  yield [all_key, cache] as const;
}

export async function insert_or_update(
  db: Parameters<
    Parameters<typeof create_and_init_libian_srawler_database_scope>[0]
  >[0],
  data: {
    mode: "MediaContentMerged";
    values: MediaContentMerged[];
  },
  options: {
    on_bar_text: (text: string) => Promise<void>;
  }
) {
  const { on_bar_text } = options;
  if (data.mode === "MediaContentMerged") {
    try {
      const { values } = data;
      const get_id = (value: (typeof values)[number]) =>
        `${value.platform}___${value.platform_duplicate_id}`;
      const existed_list = await db
        .selectFrom("libian_crawler_cleaned.media_post")
        .selectAll()
        .where("id", "in", [...values.map((value) => get_id(value))])
        .execute();

      const get_dto_for_insert_or_update = (value: (typeof values)[number]) => {
        const author_first = chain(() =>
          Arrays.first_or_null([...value.authors.keys()])
        )
          .map((k) =>
            k === null ? null : ([k, value.authors.get(k)!] as const)
          )
          .map((entry) =>
            entry === null
              ? null
              : ([
                  entry[0],
                  Arrays.last_or_null(entry[1])?.value ?? null,
                ] as const)
          )
          .get_value();
        const author_first_platform_user_id = chain(() => author_first?.[0])
          .map((it) => (it === null ? null : `${it}`))
          .get_value();
        const {
          content_text_timeline_count,
          context_text_latest_str_length,
          context_text_latest,
          content_text_deleted_at_least_once,
          content_text_deleted_first_time,
          content_text_resume_after_deleted,
          content_text_timeline,
          found_tags_in_context_text,
        } = DataClean.select_context_text({
          content_text_summary_uncleaned_timeline:
            value.content_text_summary_uncleaned_timeline,
          content_text_detail_uncleaned_timeline:
            value.content_text_detail_uncleaned_timeline,
          platform: value.platform,
        });
        const tag_texts = new Set([
          ...value.tag_texts,
          ...found_tags_in_context_text,
        ]);
        const res = {
          ...Mappings.filter_keys(value, "pick", [
            "platform",
            "platform_duplicate_id",
          ]),
          ...Mappings.object_from_entries(
            (
              [
                "count_read",
                "count_like",
                "count_share",
                "count_star",
                "count_comment",
                "video_total_count_danmaku",
                "video_total_duration_sec",
              ] as const
            ).map((k) => [k, value[k]?.toString() ?? null])
          ),
          create_time: Times.instant_to_date(value.create_time),
          update_time: Times.instant_to_date(value.update_time),
          title: value.title_timeline.findLast((it) => it)?.value ?? "",
          titles: [...value.title],
          title_timeline: DataMerge.timeline_to_json(value.title_timeline),
          content_link_url: Arrays.first_or_null([...value.content_link_urls]),
          content_link_urls: [...value.content_link_urls],
          from_search_questions: [...value.from_search_questions],
          ip_location: [...value.ip_location],
          author_first_unique_user_id: `${value.platform}___${author_first_platform_user_id}`,
          author_first_platform_user_id,
          author_first_nickname: author_first?.[1]?.nickname ?? null,
          author_first_avater_url: author_first?.[1]?.avater_url ?? null,
          author_first_home_link_url: author_first?.[1]?.home_link_url ?? null,
          authors: Mappings.object_entries(
            Mappings.map_to_record(value.authors)
          ).map(([platform_user_id, timeline]) => ({
            platform_user_id: `${platform_user_id}`,
            timeline: DataMerge.timeline_to_json(timeline),
          })),
          cover_first_url: Arrays.first_or_null([...value.cover_urls]),
          cover_urls: [...value.cover_urls],
          platform_rank_score_timeline: DataMerge.timeline_to_json(
            value.platform_rank_score_timeline
          ),
          tag_texts: [...tag_texts],
          tag_text_joined: [...tag_texts].join(";"),
          content_text_timeline_count,
          context_text_latest_str_length,
          context_text_latest,
          content_text_deleted_at_least_once,
          content_text_deleted_first_time:
            content_text_deleted_first_time === "unknown"
              ? null
              : Times.instant_to_date(content_text_deleted_first_time),
          content_text_resume_after_deleted,
          content_text_timeline: DataMerge.timeline_to_json(
            content_text_timeline
          ),
          content_text_summary_uncleaned_timeline: DataMerge.timeline_to_json(
            value.content_text_summary_uncleaned_timeline
          ),
          content_text_detail_uncleaned_timeline: DataMerge.timeline_to_json(
            value.content_text_detail_uncleaned_timeline
          ),
          context_text_latest_lines_count:
            context_text_latest?.split("\n").length ?? null,
          last_crawl_time: Times.instant_to_date(value.last_crawl_time),
        } satisfies Omit<
          Parameters<
            ReturnType<
              typeof db.insertInto<"libian_crawler_cleaned.media_post">
            >["values"]
          >[0],
          "id"
        >;
        const _res_typecheck = res satisfies Omit<
          // deno-lint-ignore no-explicit-any
          { [P in keyof MediaPostTable]: any },
          "id"
        >;
        return _res_typecheck;
      };

      const update_results = [];
      const samed_count = {
        value: 0,
      };
      const update_bar = async () =>
        await on_bar_text(
          `(updated ${update_results.length} + samed ${samed_count.value} / existed ${existed_list.length} / total ${values.length})`
        );
      for (const existed of existed_list) {
        await update_bar();
        const value = values.find((value) => get_id(value) === existed.id);
        if (value === undefined) {
          throw new Error(
            `BUG, value_new not found in values , but values id should in existed list , context is : ${JSON.stringify(
              { existed, existed_list, values }
            )}`
          );
        }
        const expect_existed = {
          id: existed.id,
          ...get_dto_for_insert_or_update(value),
        };
        if (is_deep_equal(existed, expect_existed)) {
          // if (
          //   existed.create_time &&
          //   existed.update_time &&
          //   existed.create_time > existed.update_time
          // ) {
          //   console.debug("bug", {
          //     value,
          //     existed,
          //     expect_existed,
          //   });
          // }
          samed_count.value += 1;
          continue;
        } else {
          // console.debug("data changed", {
          //   value,
          //   existed,
          //   expect_existed,
          // });
        }

        const update_result = await db
          .updateTable("libian_crawler_cleaned.media_post")
          .set((_eb) => {
            return {
              ...get_dto_for_insert_or_update(value),
              // ip_location: ['']
            };
          })
          .where("id", "=", existed.id)
          .executeTakeFirstOrThrow();
        update_results.push(update_result);
        continue;
      }
      await update_bar();

      const not_existed = [...values].filter((it) => {
        return (
          undefined === existed_list.find((exist) => exist.id === get_id(it))
        );
      });

      const insert_result =
        not_existed.length > 0
          ? await db
              .insertInto("libian_crawler_cleaned.media_post")
              .values([
                ...not_existed.map((value) => {
                  return {
                    id: get_id(value),
                    ...get_dto_for_insert_or_update(value),
                  };
                }),
                // {
                //   titles
                // },
              ])
              .execute()
          : null;

      return {
        update_results,
        insert_result,
      };
    } catch (err) {
      if (`${err}`.includes("duplicate key value violates")) {
        // cause by pkey duplicate
      } else {
        throw err;
      }
    }
  }
}

async function _main() {
  const merger = merge_media_content_for_libian_crawler();
  const reader = read_garbage_for_libian_crawler();
  for await (const garbages of read_LibianCrawlerGarbage()) {
    for (const garbage of garbages) {
      const media = await reader.next(garbage);
      if (typeof media.value === "object" && "title" in media.value) {
        await merger.next(media.value);
      }
    }
  }
  console.log("Finish reader");
  const merger_res = await merger.next("stop");
  console.debug("merger_res is ", merger_res);
  if (!merger_res.value) {
    throw new Error("should return");
  }
  const [all_key, cache] = merger_res.value;
  await ProcessBar.create_scope(
    { title: "LibianCrawler insert or update to remote database" },
    async (bars) => {
      await create_and_init_libian_srawler_database_scope(async (db) => {
        for (const {
          start,
          end,
          sliced,
          total,
        } of Streams.split_array_use_batch_size(100, [...all_key])) {
          const values = await Promise.all(
            Mappings.object_entries(cache.get_batch(new Set(sliced))).map((e) =>
              Promise.resolve(e[1])
            )
          );
          const on_bar_text = async (text: string) => {
            await bars.render([
              { completed: end, total, text: `Batch(${start}~${end}) ${text}` },
            ]);
          };
          await insert_or_update(
            db,
            {
              mode: "MediaContentMerged",
              values,
            },
            {
              on_bar_text,
            }
          );
          await on_bar_text("OK");
        }
      });
    }
  );
}

// ```
// deno run --allow-env=PG* general_data_process/libian_crawler/clean_and_merge.ts
// ```
if (import.meta.main) {
  await _main();
}
