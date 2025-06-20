import {
  type LibianCrawlerGarbage,
} from "../../user_code/LibianCrawlerGarbage.ts";
import { type InsertResult, type UpdateResult } from "kysely";
import {
  Arrays,
  chain,
  DataClean,
  DataMerge,
  Errors,
  is_nullish,
  Jsons,
  Mappings,
  Nums,
  Paths,
  SerAny,
  Streams,
  Strs,
  Times,
  Typings,
} from "../../util.ts";
import { create_cache_in_memory } from "../caches.ts";
import {
  MediaContent,
  MediaContentAuthor,
  MediaRelatedSearches,
  MediaSearchContext,
  MediaVideo,
  PlatformEnum,
} from "../media.ts";
import { Paragraphs } from "../paragraph_analysis.ts";
import { ShopGood } from "../shop_good.ts";
import {
  ChatMessageTable,
  create_and_init_libian_crawler_database_scope,
  LiteratureTable,
  MediaPostTable,
  ShopGoodTable,
} from "./data_storage.ts";
import { pg_dto_equal } from "../../pg.ts";
import { ChatMessage } from "../chat_message.ts";
import { createHash } from "node:crypto";
import { Literature } from "../literature.ts";

// deno-lint-ignore no-namespace
export namespace LibianCrawlerCleanAndMergeUtil {
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

  export function compute_platform_duplicate_id_for_chat_message(
    msg: Pick<
      ChatMessage,
      | "create_time"
      | "platform"
      | "content_plain_text"
      | "content_img_url"
      | "user_sendfrom"
    >,
  ) {
    const hash = createHash("sha512")
      .update(
        `${msg.platform}___${
          Times.instant_to_date(
            msg.create_time,
          ).toISOString()
        }___${msg.user_sendfrom?.nickname ?? ""}___${
          msg.content_plain_text ?? ""
        }___${msg.content_img_url ?? ""}`,
      )
      .digest("hex");

    return `cpdi___${msg.user_sendfrom?.nickname ?? ``}___${hash}` as const;
  }

  export function compute_platform_duplicate_id_for_embase(
    title: string,
    author_names: string,
  ) {
    const hash = createHash("sha512")
      .update(
        `${title}___${author_names}`,
      )
      .digest("hex");

    return `embase__${hash}` as const;
  }

  export function find_embase_search_query_exp(
    search_query: string,
  ): string | null {
    const res = new RegExp("'(.+)'\\/exp").exec(search_query);
    return res?.at(1) ?? null;
  }

  /**
   * 如果指定issn则使用issn。
   */
  export function get_literature_duplicated_id(
    _param: {
      issn: DataClean.ISSN;
    } | {
      eissn: string;
    },
  ) {
    const issn = "issn" in _param ? _param.issn : undefined;
    const eissn = "eissn" in _param ? _param.eissn : undefined;
    if (Strs.is_not_blank(issn)) {
      return `ISSN_${issn}` as const;
    }
    if (Strs.is_not_blank(eissn)) {
      return `eISSN_${eissn}` as const;
    }
    Errors.throw_and_format(`Can't get literature duplicated id`, { _param });
  }

  export type MediaContentMerged =
    & Omit<
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
    >
    & {
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
      content_text_latest: string;
    };

  export type ShopGoodMerged = Omit<ShopGood, never>;

  export async function* read_garbage_for_libian_crawler(_param?: {
    // deno-lint-ignore no-explicit-any
    logw?: (text: string, obj: any) => void;
  }) {
    const __param = _param !== undefined ? _param : {};
    const { logw } = __param;
    const _logw = logw ?? ((text, obj) => console.warn(text, obj));
    while (1) {
      const garbage: LibianCrawlerGarbage | undefined = yield;
      if (typeof garbage === "undefined") {
        yield undefined;
        continue;
      }
      try {
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
          const video = "video" in note
            ? (note.video ? note.video : null)
            : null;
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
            cover_image = image_list.find((it) =>
              it.file_id === cover_fileid
            ) ?? null;
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
        } else if (
          "group__xiaohongshu_search_result__lib_xhs" in garbage &&
          garbage.group__xiaohongshu_search_result__lib_xhs
        ) {
          const { g_content, g_search_key } =
            garbage.group__xiaohongshu_search_result__lib_xhs;
          const { result } = g_content;
          if (!("items" in result)) {
            continue;
          }
          const { items } = result;
          if (!items) {
            continue;
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
            const query_mapper = (q: Query) => {
              const related_questions = q.queries.map(
                (it) => ({
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
        } else if (
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
        } else if (
          "group__github__suqingdong__impact_factor_search_result__github__suqingdong__impact_factor" in
            garbage &&
          garbage[
            "group__github__suqingdong__impact_factor_search_result__github__suqingdong__impact_factor"
          ]
        ) {
          const { g_content, g_create_time } = garbage[
            "group__github__suqingdong__impact_factor_search_result__github__suqingdong__impact_factor"
          ];
          for (const item of g_content.result.obj) {
            const issn = DataClean.find_issn(item.issn);
            if (issn === null) {
              console.warn("Missing issn", { item });
              continue;
            }
            const res: Literature = {
              platform: PlatformEnum.文献,
              last_crawl_time: Times.parse_text_to_instant(g_create_time),
              platform_duplicate_id: get_literature_duplicated_id({ issn }),
              crawl_from_platform: PlatformEnum.lib_impact_factor,
              title: item.journal,
              languages: [],
              create_year: null,
              international_standard_serial_number: issn,
              international_standard_book_number: null,
              china_standard_serial_number: null,
              publication_organizer: item.journal_abbr,
              publication_place: null,
              keywords: [],
              count_published_documents: null,
              count_download_total: null,
              count_citations_total: null,
              impact_factor_latest:
                Nums.is_invalid(item.factor) || item.factor < 0
                  ? null
                  : item.factor,
              eissn: item.eissn,
            };
            yield {
              __mode__: "literature" as const,
              ...res,
            };
          }
        } else if (
          "dump_page_info" in garbage.obj.g_content &&
          garbage.obj.g_content?.dump_page_info &&
          "dump_obj" in garbage.obj.g_content?.dump_page_info &&
          garbage.obj.g_content?.dump_page_info?.dump_obj
        ) {
          const dump_obj = garbage.obj.g_content?.dump_page_info?.dump_obj;
          if (
            "data" in dump_obj && dump_obj.data && "rows" in dump_obj.data &&
            Array.isArray(dump_obj.data.rows) && dump_obj.data.rows.length >= 1
          ) {
            const { rows, prefix } = dump_obj.data;

            const prefix_first_line = Arrays.first_or_null(
              prefix.split("\n"),
            );

            const last_crawl_time = Times.parse_text_to_instant(
              garbage.obj.g_create_time,
            );
            // console.debug("\n\nrows length", rows.length);
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              if (typeof (row["Embase Accession ID"]) === "string") {
                // console.debug("\n\nROW ------------------ \n\n");
                let from_search_context: MediaSearchContext[];
                if (prefix_first_line) {
                  if (
                    prefix_first_line.split(",")[0] === '"SEARCH QUERY"' &&
                    prefix_first_line.split(",").length === 2
                  ) {
                    const search_query = prefix_first_line.split(",")[1];
                    const embase_search_exp = find_embase_search_query_exp(
                      search_query,
                    );
                    if (embase_search_exp) {
                      from_search_context = [
                        {
                          question: embase_search_exp,
                        },
                      ];
                    } else {
                      from_search_context = [];
                    }
                  } else {
                    console.warn(
                      `Why missing SEARCH QUERY header in embase csv header`,
                      { prefix_first_line, g_id: garbage.obj.g_id },
                    );
                    throw new Error(
                      `Why missing SEARCH QUERY header in embase csv header`,
                    );
                    // break;
                  }
                } else {
                  console.warn(
                    `Why not found embase csv header`,
                    { prefix_first_line, g_id: garbage.obj.g_id },
                  );
                  throw new Error(`Why not found embase csv header`);
                  // break;
                }

                const entry_times = [
                  row["AiP/IP Entry Date"],
                  row["Full Record Entry Date"],
                  // row["Date of Publication"],
                  // row["Conference Date"],
                ].map((it) => {
                  try {
                    return Times.parse_text_to_instant(it);
                  } catch (err) {
                    return null;
                  }
                }).filter((it) => it !== null && it !== undefined);
                let create_time: Temporal.Instant | null;
                let update_time: Temporal.Instant | null;
                if (Arrays.length_greater_then_0(entry_times)) {
                  create_time = Nums.take_extreme_value("min", entry_times);
                  update_time = Nums.take_extreme_value("max", entry_times);
                } else {
                  create_time = null;
                  update_time = null;
                }
                const tags = Streams.deduplicate([
                  ...row["Author Keywords"].split(","),
                  ...row["Emtree Drug Index Terms (Major Focus)"].split(","),
                  ...row["Emtree Medical Index Terms (Major Focus)"].split(","),
                  ...row["Emtree Drug Index Terms (Major Focus)"].split(","),
                  ...row["Emtree Medical Index Terms"].split(","),
                  ...row["CAS Registry Numbers"].split(","),
                  ...row["Embase Classification"].split(","),
                ].map((it) => it.trim())).map((it) => ({
                  text: it,
                }));
                let summary = row.Abstract;
                if (Strs.startswith(summary, "Brief Summary")) {
                  summary = Strs.remove_prefix(summary, "Brief Summary");
                }
                const res: MediaContent = {
                  last_crawl_time,
                  title: row.Title,
                  content_text_summary: summary,
                  content_text_detail: null,
                  content_link_url: (() => {
                    for (
                      const u of [
                        row["Full Text Link"],
                        row["Open URL Link"],
                        row["Embase Link"],
                      ]
                    ) {
                      try {
                        return DataClean.url_use_https_noempty(u);
                      } catch (err) {
                        continue;
                      }
                    }
                    throw new Error(
                      `row links all invalid ! row is: ${
                        Jsons.dump(row, { indent: 2 })
                      }`,
                    );
                  })(),
                  authors: [
                    ...(
                      row["Author Names"].split(",").filter((it) =>
                        Strs.is_not_blank(it)
                      )
                        .map((it) => ({
                          nickname: it,
                          avater_url: null,
                          platform_user_id: `PersonName---${it}`,
                          home_link_url: null,
                        }))
                    ),
                  ],
                  platform: PlatformEnum.Embase或镜像站,
                  platform_duplicate_id:
                    compute_platform_duplicate_id_for_embase(
                      row.Title,
                      row["Author Names"],
                    ),
                  platform_rank_score: null,
                  count_read: null,
                  count_like: null,
                  count_star: null,
                  video_total_count_danmaku: null,
                  video_total_duration_sec: null,
                  tags,
                  create_time,
                  update_time,
                  cover_url: null,
                  videos: null,
                  from_search_context,
                  ip_location: null,
                  count_share: null,
                  count_comment: null,
                  literatures: [
                    {
                      journal: null,
                      issn: DataClean.find_issn(row.ISSN),
                      isbn: Strs.is_not_blank(row.ISBN) ? row.ISBN : null,
                      publication_type:
                        Strs.is_not_blank(row["Publication Type"])
                          ? row["Publication Type"]
                          : null,
                      doi: Strs.is_not_blank(row.DOI) ? row.DOI : null,
                      pui: Strs.is_not_blank(row.PUI) ? row.PUI : null,
                      category: null,
                      level_of_evidence: null,
                      book_publisher: null,
                      cnsn: null,
                    },
                  ],
                  language: Strs.is_not_blank(row["Article Language"])
                    ? row["Article Language"]
                    : row["Summary Language"],
                };
                yield res;
              } else {
                console.warn(
                  "Unknown type for dump_obj , garbage.obj.g_id is",
                  garbage.obj.g_id,
                );
              }
            }
          } else {
            // console.warn("Invalid dump_obj.data.rows , dump_obj info: ", {
            //   g_id: garbage.obj.g_id,
            // });
            continue;
          }
        }
        // const find_entry_which_defined_value_and_key_startswith = () => {
        //   // const g: Typings.ReduceUnionMapping<typeof garbage> =
        //   //   // deno-lint-ignore no-explicit-any
        //   //   garbage as any;
        //   if (garbage.obj.g_type === "smart-crawl-v1") {
        //     return [void 0, garbage] as const;
        //   } else {
        //     return null;
        //   }
        //   // return (
        //   //   Mappings.object_keys(garbage)
        //   //     .map((key) => {
        //   //       // if (Strs.startswith(key, "group__smart-crawl-v1")) {
        //   //       //   const k = key;
        //   //       //   if (k === undefined) {
        //   //       //     return null;
        //   //       //   }
        //   //       //   // if ("group__smart-crawl-v1__cli-group:at_202505" in garbage) {
        //   //       //   //   const o = garbage["group__smart-crawl-v1__cli-group:at_202505"]
        //   //       //   // }

        //   //       //   // https://github.com/microsoft/TypeScript/issues/34933#issuecomment-889570502

        //   //       //   const o2: Typings.ReduceUnionMapping<typeof garbage> =
        //   //       //     // deno-lint-ignore no-explicit-any
        //   //       //     garbage as any;
        //   //       //   let a: (typeof o2)["group__smart-crawl-v1__cli-group:at_202505"];

        //   //       //   // const o: Omit<typeof o2, never> = o2;
        //   //       //   // if (k in o) {
        //   //       //   //   const v = o[k];
        //   //       //   //   if (v === undefined) {
        //   //       //   //     return null;
        //   //       //   //   }
        //   //       //   //   return [k, v] as const;
        //   //       //   // } else {
        //   //       //   //   return null;
        //   //       //   // }
        //   //       // } else {
        //   //       //   return null;
        //   //       // }
        //   //     })
        //   //     .find((it) => it) ?? null
        //   // );
        // };

        // const smart_crawl_entry =
        //   find_entry_which_defined_value_and_key_startswith();
        const { template_parse_html_tree } = garbage.obj;
        if (template_parse_html_tree) {
          // const [_smart_crawl_key, smart_crawl] = smart_crawl_entry;
          // if ("template_parse_html_tree" in smart_crawl) {
          //   let template_parse_html_tree =
          //     smart_crawl["template_parse_html_tree"];
          // }
          // const { template_parse_html_tree } = smart_crawl;
          const smart_crawl = garbage.obj;
          if (
            template_parse_html_tree.yangkeduo &&
            template_parse_html_tree.yangkeduo.window_raw_data_eval &&
            template_parse_html_tree.yangkeduo.window_raw_data_eval.success &&
            template_parse_html_tree.yangkeduo.window_raw_data_eval.stdout_json
          ) {
            const { store } =
              template_parse_html_tree.yangkeduo.window_raw_data_eval
                .stdout_json;
            const { goods, mall } = store.initDataObj;
            const activity = "activity" in goods ? goods.activity : undefined;
            const create_time = Nums.take_extreme_value("min", [
              Times.parse_instant(activity?.startTime),
              Times.parse_instant(smart_crawl.g_create_time),
              Temporal.Now.instant(),
            ]);
            const update_time = Nums.take_extreme_value("max", [
              create_time,
              Times.parse_instant(activity?.startTime),
              Times.parse_instant(store.initDataObj.goods.nowTime),
            ]);
            const res: ShopGood = {
              platform: PlatformEnum.拼多多h5yangkeduo,
              platform_duplicate_id: `goodsid_${goods.goodsID}`,
              create_time,
              update_time,
              good_id: goods.goodsID,
              good_name: goods.goodsName,
              shop_id: goods.mallID,
              shop_name: mall.mallName,
              search_from: new Set([
                ...(store.initDataObj.queries._x_query
                  ? [store.initDataObj.queries._x_query]
                  : []),
              ]),
              good_images: goods.detailGallery.map((it) => {
                const gifUrl = "gifUrl" in it
                  ? it.gifUrl
                  : "gif_url" in it
                  ? it.gif_url
                  : undefined;
                return {
                  url: DataClean.url_use_https_noempty(it.url),
                  width: it.width,
                  height: it.height,
                  gifurl: DataClean.url_use_https_emptyable(gifUrl) ?? null,
                  id: chain(() => ("id" in it ? it.id : null))
                    .map((d) => (typeof d === "number" ? `${d}` : null))
                    .get_value(),
                };
              }),
              sku_list: goods.skus.map((sku) => {
                return {
                  sku_id: sku.skuId,
                  pic_url: DataClean.url_use_https_noempty(sku.thumbUrl),
                  desc: sku.specs
                    .map((spec) => `${spec.spec_key}:${spec.spec_value}`)
                    .join(";"),
                  price_display_cny_unit001: Arrays.first_or_null(
                    (
                      [
                        ["skuPrice" in sku ? sku.skuPrice : null, 1],
                        [
                          "priceDisplay" in sku
                            ? sku.priceDisplay?.price
                            : null,
                          100,
                        ],
                        [sku.groupPrice, 100],
                        [sku.normalPrice, 100],
                        [sku.normalSavePrice, 100],
                        [sku.price, 100],
                        [sku.marketPrice, 100],
                      ] as const
                    )
                      .map(([v, mul]) =>
                        v !== undefined && v !== null
                          ? ([
                            DataClean.parse_number(v, "allow_nan"),
                            mul,
                          ] as const)
                          : null
                      )
                      .filter((it) => it !== null)
                      .filter((it) => !Nums.is_invalid(it[0]) && it[0] > 0)
                      .map(([v, mul]) =>
                        DataClean.cast_and_must_be_natural_number(
                          DataClean.parse_number((v * mul).toFixed(3)),
                        )
                      ),
                  ),
                  label: "sideCarLabels" in sku
                    ? sku.sideCarLabels
                      ?.map((it) => it.text)
                      .filter((it) => Strs.is_not_blank(it))
                      .join(";") ?? ""
                    : "",
                };
              }),
              link_url:
                `https://mobile.yangkeduo.com/goods.html?goods_id=${goods.goodsID}`,
            };
            yield res;
            continue;
          }
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
                  const { query_dict } =
                    "dump_page_info" in smart_crawl.g_content
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
                cover_url: null,
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
          if (
            template_parse_html_tree.xhs &&
            "title" in template_parse_html_tree.xhs &&
            typeof template_parse_html_tree.xhs.title === "string" &&
            "author_username" in template_parse_html_tree.xhs &&
            typeof template_parse_html_tree.xhs.author_username === "string"
          ) {
            const { xhs } = template_parse_html_tree;
            const content_link_url_props =
              "dump_page_info" in smart_crawl.g_content
                ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait
                  ?.url
                : null;
            if (typeof content_link_url_props?.url !== "string") {
              console.warn("Why content_link_url_props?.url not string ?", {
                content_link_url_props,
                xhs,
              });
              continue;
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
                continue;
              }
            } else {
              console.warn("Why content_link_url not prefixed", {
                content_link_url_props,
                xhs,
              });
              continue;
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
                continue;
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
                continue;
              }
              if (!platform_user_id) {
                console.warn("Why platform_user_id invalid ?", {
                  platform_user_id,
                  xhs,
                });
                continue;
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
              from_search_context: [],
              create_time: null,
              update_time: null,
              tags: null,
              ip_location: null,
              cover_url: null,
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
            continue;
          }
          if (
            template_parse_html_tree.cnki &&
            "summary" in template_parse_html_tree.cnki &&
            template_parse_html_tree.cnki.summary
          ) {
            const cnki = template_parse_html_tree.cnki;
            const url = "dump_page_info" in smart_crawl.g_content
              ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait?.url
                .url
              : null;
            const { title } = cnki;
            if (!url || !title) {
              continue;
            }
            const content_link_url = DataClean.url_use_https_noempty(url);
            const authors = typeof cnki.authors === "undefined"
              ? []
              : Array.isArray(cnki.authors)
              ? cnki.authors
              : [cnki.authors];
            const page_info_smart_wait =
              "dump_page_info" in smart_crawl.g_content
                ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait
                : null;
            let search_keyword: string | null = null;
            if (
              "cmd_param_json" in smart_crawl.g_content &&
              smart_crawl.g_content.cmd_param_json &&
              "steps" in smart_crawl.g_content.cmd_param_json &&
              smart_crawl.g_content.cmd_param_json.steps
            ) {
              const { searchParams } =
                URL.parse(smart_crawl.g_content.cmd_param_json.steps) ?? {};
              if (searchParams && searchParams.get("q")) {
                search_keyword = searchParams.get("q");
              }
            }
            const res: MediaContent = {
              last_crawl_time: Times.parse_text_to_instant(
                smart_crawl.g_create_time,
              ),
              title,
              content_text_summary: cnki.summary ?? "",
              content_text_detail: null,
              content_link_url,
              authors: authors.map((it) => {
                if ("href" in it && it.href && it.name) {
                  return {
                    platform_user_id: `PersonName---${it.name}`,
                    nickname: it.name,
                    avater_url: null,
                    home_link_url: DataClean.url_use_https_noempty(it.href),
                  };
                }
                console.error("invalid user , it is", it);
                throw new Error("invalid user");
              }),
              platform: PlatformEnum.知网,
              platform_duplicate_id: `TitleAuthors---${title}---${
                authors
                  .map((it) => it.name)
                  .join(";")
              }`,
              count_read: null,
              count_like: null,
              from_search_context: !search_keyword ? [] : [
                {
                  question: search_keyword,
                },
              ],
              create_time: !cnki.public_time
                ? null
                : Times.parse_text_to_instant(cnki.public_time.split("（")[0]),
              update_time: null,
              tags: "keywords" in cnki
                ? cnki.keywords?.map((it) => ({ text: it })) ?? null
                : null,
              ip_location: null,
              cover_url: typeof page_info_smart_wait === "object" &&
                  page_info_smart_wait &&
                  "files" in page_info_smart_wait &&
                  typeof page_info_smart_wait.files === "object" &&
                  "public_url" in page_info_smart_wait.files &&
                  page_info_smart_wait.files.public_url
                ? DataClean.url_use_https_noempty(
                  page_info_smart_wait.files.public_url,
                )
                : null,
              count_share: null,
              count_star: null,
              video_total_count_danmaku: null,
              video_total_duration_sec: null,
              count_comment: null,
              platform_rank_score: null,
              videos: null,
              literatures: [
                {
                  journal: cnki.journal
                    ? Strs.remove_prefix_suffix_recursion(
                      cnki.journal,
                      ".",
                    ).trim()
                    : null,
                  doi: "doi" in cnki && Strs.is_not_blank(cnki.doi)
                    ? cnki.doi.trim()
                    : null,
                  category: null,
                  level_of_evidence: null,
                  issn: null,
                  isbn: null,
                  publication_type: null,
                  pui: null,
                  book_publisher: null,
                  cnsn: null,
                },
              ],
              language: null,
            };
            yield res;
          }
          if (
            template_parse_html_tree.cnki_journal_detail &&
            "info_dict" in template_parse_html_tree.cnki_journal_detail &&
            template_parse_html_tree.cnki_journal_detail.info_dict &&
            typeof template_parse_html_tree.cnki_journal_detail.info_dict ===
              "object" &&
            "ISSN" in template_parse_html_tree.cnki_journal_detail.info_dict &&
            Strs.is_not_blank(
              template_parse_html_tree.cnki_journal_detail.info_dict.ISSN,
            )
          ) {
            const g_id = smart_crawl.g_id;
            const { info_dict, title } =
              template_parse_html_tree.cnki_journal_detail;
            const issn = DataClean.find_issn(info_dict.ISSN ?? "");
            if (!Strs.is_not_blank(title) || !Strs.is_not_blank(issn)) {
              console.warn("Why title or issn empty ?", {
                g_id,
                issn,
                title,
                info_dict,
              });
            } else {
              if (!DataClean.check_issn(issn)) {
                Errors.throw_and_format("Invalid issn", {
                  issn,
                  g_id,
                  title,
                  info_dict,
                });
              }
              const cnsn = Strs.is_not_blank(info_dict.CN?.trim())
                ? info_dict.CN.trim()
                : null;
              const isbn = null;
              let impact_factor_latest_year = 1970;
              let impact_factor_latest: null | number = null;
              for (const [key, value] of Mappings.object_entries(info_dict)) {
                if (!Strs.has_text(key, "影响因子" as const)) {
                  continue;
                }
                const v = DataClean.parse_number(value ?? "-1", "allow_nan");
                if (Nums.is_invalid(v) || v < 0) {
                  continue;
                }
                const year_str = key.match(new RegExp("(\\d{4})"))?.at(1) ??
                  null;
                if (!year_str) {
                  continue;
                }
                const year = DataClean.parse_number(year_str);
                if (year > impact_factor_latest_year) {
                  impact_factor_latest = v;
                  impact_factor_latest_year = year;
                } else if (year === impact_factor_latest_year) {
                  impact_factor_latest = Math.max(v, impact_factor_latest ?? 0);
                } else {
                  continue;
                }
              }
              let keywords: string[] = [];
              for (
                const kwds of [info_dict.专辑名称, info_dict.专题名称] as const
              ) {
                for (
                  const kw of Strs.remove_prefix_suffix_recursion(
                    kwds.trim(),
                    ";",
                  ).split(";")
                ) {
                  if (Strs.is_not_blank(kw)) {
                    keywords.push(kw.trim());
                  }
                }
              }
              keywords = Streams.deduplicate(keywords);

              const res: Literature = {
                platform: PlatformEnum.文献,
                last_crawl_time: Times.parse_text_to_instant(
                  smart_crawl.g_create_time,
                ),
                platform_duplicate_id: get_literature_duplicated_id({ issn }),
                crawl_from_platform: PlatformEnum.知网,
                title,
                languages: [
                  ...Paragraphs.find_languages_in_text(info_dict.语种 ?? ""),
                  ...Strs.remove_prefix_suffix_recursion(
                    (info_dict.语种 ?? "").trim().replace("；", ";"),
                    ";",
                  ).split(";"),
                ],
                create_year: chain(() =>
                  info_dict.创刊时间
                    ? DataClean.parse_number(
                      info_dict.创刊时间,
                      "allow_nan",
                    )
                    : null
                ).map((it) =>
                  null === it
                    ? null
                    : Nums.is_invalid(it)
                    ? null
                    : !Nums.is_int(it)
                    ? null
                    : it <= 1000
                    ? null
                    : it
                ).get_value(),
                international_standard_serial_number: issn,
                international_standard_book_number: isbn,
                china_standard_serial_number: cnsn,
                publication_organizer: info_dict.主办单位 ?? null,
                publication_place: info_dict.出版地 ?? null,
                keywords,
                count_published_documents: chain(() =>
                  DataClean.parse_number(
                    Strs.remove_suffix_recursion(
                      info_dict.出版文献量 ?? "-1",
                      "篇",
                    ).trim(),
                    "allow_nan",
                  )
                ).map((it) =>
                  Nums.is_invalid(it)
                    ? null
                    : !Nums.is_int(it)
                    ? null
                    : it < 0
                    ? null
                    : it
                ).get_value(),
                count_download_total: chain(() =>
                  DataClean.parse_number(
                    Strs.remove_suffix_recursion(
                      info_dict.总下载次数 ?? "-1",
                      "次",
                    ).trim(),
                    "allow_nan",
                  )
                ).map((it) =>
                  Nums.is_invalid(it)
                    ? null
                    : !Nums.is_int(it)
                    ? null
                    : it < 0
                    ? null
                    : it
                ).get_value(),
                count_citations_total: chain(() =>
                  DataClean.parse_number(
                    Strs.remove_suffix_recursion(
                      info_dict.总被引次数 ?? "-1",
                      "次",
                    ).trim(),
                    "allow_nan",
                  )
                ).map((it) =>
                  Nums.is_invalid(it)
                    ? null
                    : !Nums.is_int(it)
                    ? null
                    : it < 0
                    ? null
                    : it
                ).get_value(),
                impact_factor_latest,
                eissn: null,
              };
              yield {
                __mode__: "literature" as const,
                ...res,
              };
            }
          }
          if (
            template_parse_html_tree.qianniu_message_export &&
            "messages" in template_parse_html_tree.qianniu_message_export &&
            template_parse_html_tree.qianniu_message_export.messages
          ) {
            const {
              messages: messages_no_order,
              active_user_nickname,
              shopname,
              shop_icon,
            } = template_parse_html_tree.qianniu_message_export;
            const user_employer: ChatMessage["user_employer"] = {
              nickname: shopname ?? null,
              platform_id: null,
              avater_url: DataClean.url_use_https_emptyable(shop_icon),
            };
            const user_customer: ChatMessage["user_customer"] = {
              nickname: active_user_nickname ?? null,
              platform_id: null,
              avater_url: null,
            };

            const messages_no_order_2 = Array.isArray(messages_no_order)
              ? messages_no_order
              : [messages_no_order] as const;

            let messages_ordered: Array<
              {
                create_time: Temporal.Instant;
                chatName: string;
                chatTextLeft: string | null;
                img: string | null;
              }
            > = [];
            let current_group_time: string | null = null;
            for (const msg of messages_no_order_2) {
              if (Mappings.object_keys(msg).length <= 0) {
                continue;
              }
              if ("groupTime" in msg && msg.groupTime) {
                current_group_time = msg.groupTime;
                continue;
              }
              if (current_group_time === null) {
                continue;
                // throw new Error(
                //   `Why current group time not setting , qianniu_message_export is :${
                //     Jsons.dump(
                //       template_parse_html_tree.qianniu_message_export,
                //       { indent: 2 },
                //     )
                //   }`,
                // );
              }
              if (
                !("chatTime" in msg && msg.chatTime) ||
                !("chatName" in msg && msg.chatName) ||
                (!msg.chatTextLeft && !msg.img)
              ) {
                continue;
                // throw new Error(
                //   `Not found msg property , msg is ${Jsons.dump(msg)}`,
                // );
              }
              const create_time = Times.parse_instant(
                `${current_group_time} ${msg.chatTime}`,
              );
              if (!create_time) {
                throw new Error(
                  `Parse time invalid , msg is ${Jsons.dump(msg)}`,
                );
              }
              messages_ordered.push({
                chatName: msg.chatName,
                chatTextLeft: msg.chatTextLeft?.trim()
                  ? msg.chatTextLeft
                  : null,
                img: msg.img?.trim() ? msg.img : null,
                create_time,
              });
            }
            messages_ordered = messages_ordered.sort((a, b) => {
              return Temporal.Instant.compare(a.create_time, b.create_time);
            });
            let user_employee: ChatMessage["user_employee"] = null;
            for (const msg of messages_ordered) {
              const _chatName = msg.chatName;
              let user_sendfrom: ChatMessage["user_sendfrom"];
              let user_sendto: ChatMessage["user_sendto"];
              if (_chatName === user_customer.nickname) {
                user_sendfrom = user_customer;
                if (user_employee === null) {
                  user_sendto = user_employer;
                } else {
                  user_sendto = user_employee;
                }
              } else {
                user_employee = {
                  nickname: _chatName,
                  platform_id: null,
                  avater_url: null,
                };
                user_sendfrom = user_employee;
                user_sendto = user_customer;
              }
              const res: Omit<ChatMessage, "platform_duplicate_id"> = {
                platform: PlatformEnum.千牛聊天记录,
                create_time: msg.create_time,
                update_time: null,
                content_plain_text: msg.chatTextLeft ?? null,
                content_img_url: DataClean.url_use_https_emptyable(msg.img),
                user_sendfrom,
                user_sendto,
                group_sendto: null,
                user_employer,
                user_employee,
                user_customer,
              };
              const res2: ChatMessage & {
                __mode__: "chat_message";
              } = {
                __mode__: "chat_message",
                ...res,
                platform_duplicate_id: LibianCrawlerCleanAndMergeUtil
                  .compute_platform_duplicate_id_for_chat_message(
                    res,
                  ),
              };
              yield res2;
              continue;
            }
          }
          if (
            "wos_journal" in template_parse_html_tree &&
            Array.isArray(template_parse_html_tree.wos_journal) &&
            template_parse_html_tree.wos_journal.length > 0
          ) {
            const wos_journal = template_parse_html_tree.wos_journal;
            let issn: null | DataClean.ISSN = null;
            let eissn: null | string = null;
            let jif: null | number = null;
            let journal: null | string = null;
            for (
              let i = 0;
              i < wos_journal.length;
              i++
            ) {
              const item = wos_journal[i];
              const find_content = (_i: number) => {
                if (_i + 1 >= wos_journal.length) {
                  Errors.throw_and_format(
                    "not found content for title , index out of range",
                    {
                      item,
                      _i,
                      wos_journal,
                      journal,
                      jif,
                      issn,
                      eissn,
                    },
                  );
                }
                const content = wos_journal[_i + 1];
                if (!content.is_content || content.content === null) {
                  if (content.is_title) {
                    // The content str is blank
                    i = _i;
                    return null;
                  }
                  Errors.throw_and_format(
                    "not found content for title , i+1 item not a content element",
                    {
                      item,
                      content,
                      _i,
                      wos_journal,
                      journal,
                      jif,
                      issn,
                      eissn,
                    },
                  );
                }
                i = _i + 1;
                return content.content;
              };
              if (item.title) {
                switch (item.title) {
                  case "eISSN":
                    eissn = eissn !== null
                      ? Errors.throw_and_format("eissn already set", {
                        item,
                        wos_journal,
                        journal,
                        jif,
                        issn,
                        eissn,
                      })
                      : chain(() => find_content(i)).map((it) =>
                        !Strs.is_not_blank(it) ? null : it
                      ).get_value();
                    break;
                  case "ID":
                    break;
                  case "ISSN":
                    issn = issn !== null
                      ? Errors.throw_and_format("issn already set", {
                        item,
                        wos_journal,
                        journal,
                        jif,
                        issn,
                        eissn,
                      })
                      : chain(() => find_content(i)).map((it) =>
                        !Strs.is_not_blank(it)
                          ? null
                          : DataClean.check_issn(it)
                          ? it
                          : null
                      ).get_value();
                    break;
                  case "Journal Impact Factor (JIF)":
                    jif = jif !== null
                      ? Errors.throw_and_format("jif already set", {
                        item,
                        wos_journal,
                        journal,
                        jif,
                        issn,
                        eissn,
                      })
                      : chain(() => find_content(i)).map((it) =>
                        !Strs.is_not_blank(it)
                          ? null
                          : DataClean.parse_number(it, "allow_nan")
                      )
                        .map((it) =>
                          it === null ? null : Nums.is_invalid(it) ? null : it
                        )
                        .get_value();
                    break;
                  case "Journal Title":
                    journal = journal !== null
                      ? Errors.throw_and_format("journal already set", {
                        item,
                        wos_journal,
                        journal,
                        jif,
                        issn,
                        eissn,
                      })
                      : chain(() => find_content(i)).map((it) =>
                        !Strs.is_not_blank(it) ? null : it
                      ).get_value();
                    break;
                  case "WoS Core Citation Indexes":
                    break;
                  default:
                    Errors.throw_and_format("unknown item title", {
                      item,
                      wos_journal,
                      journal,
                      jif,
                      issn,
                      eissn,
                    });
                }
              }
            }
            let platform_duplicate_id: string;
            if (!Strs.is_not_blank(journal)) {
              Errors.throw_and_format("journal name is blank", {
                wos_journal,
                journal,
                jif,
                issn,
                eissn,
              });
            }
            if (issn !== null) {
              platform_duplicate_id = get_literature_duplicated_id({ issn });
            } else if (eissn !== null) {
              platform_duplicate_id = get_literature_duplicated_id({ eissn });
            } else {
              Errors.throw_and_format("issn and eissn both null", {
                wos_journal,
                journal,
                jif,
                issn,
                eissn,
              });
            }
            const res: Literature = {
              platform: PlatformEnum.文献,
              last_crawl_time: Times.parse_text_to_instant(
                smart_crawl.g_create_time,
              ),
              platform_duplicate_id,
              crawl_from_platform: PlatformEnum.wos_journal,
              title: journal,
              languages: [],
              create_year: null,
              international_standard_serial_number: issn,
              international_standard_book_number: null,
              china_standard_serial_number: null,
              publication_organizer: null,
              publication_place: null,
              keywords: [],
              count_published_documents: null,
              count_download_total: null,
              count_citations_total: null,
              impact_factor_latest: jif === null
                ? null
                : Nums.is_invalid(jif) || jif < 0
                ? null
                : jif,
              eissn,
            };
            yield {
              __mode__: "literature" as const,
              ...res,
            };
          }
        } else {
          if (
            "group__entrez_search_result__lib_biopython" in garbage &&
            garbage["group__entrez_search_result__lib_biopython"]
          ) {
            const { template_parse_html_tree, g_create_time, g_search_key } =
              garbage.group__entrez_search_result__lib_biopython;
            // 我原以为这是 RefWorks 格式，然而不是。
            const { ref_works: ncbi_fmt } = template_parse_html_tree;
            if (!ncbi_fmt) {
              throw new Error("Why parse ref_works failed ?");
            }
            const find_value = (
              label: (typeof ncbi_fmt)["entries"][number]["label"],
            ) =>
              ncbi_fmt.entries_multiple.find((it) => it.label === label)
                ?.values_join ?? null;
            const get_doi = () => {
              let line = find_value("LID");
              if (!line) {
                return null;
              }
              line = line.trim();
              if (!line || line.indexOf("[doi]") < 0) {
                return null;
              }
              line = line.replace("[doi]", "").trim();
              return Strs.is_not_blank(line) ? line : null;
            };
            const get_issn = () => {
              const values = ncbi_fmt.entries_multiple.find((it) =>
                it.label === "IS"
              )?.values;
              if (typeof values === "undefined" || values.length <= 0) {
                return null;
              }
              const issn_list = values.map((value) => {
                return DataClean.find_issn(value);
              }).filter((it) => it !== null);
              if (issn_list.length <= 0) {
                return null;
              } else if (issn_list.length > 1) {
                for (const issn of issn_list) {
                  if (issn !== issn_list[0]) {
                    Errors.throw_and_format("Why not same issn ?", {
                      issn_list,
                      ncbi_fmt,
                    });
                  }
                }
                return issn_list[0];
              } else {
                return issn_list[0];
              }
            };
            const pubmed_id = find_value("PMID");
            if (!pubmed_id) {
              Errors.throw_and_format("TODO: other platform", {
                pubmed_id,
                ncbi_fmt,
              });
            }
            const dcom = find_value("DCOM");
            const lr = find_value("LR");
            let content_text_summary = find_value("AB");
            if (content_text_summary && content_text_summary.length > 700) {
              content_text_summary = content_text_summary.substring(0, 700) +
                "...";
            }
            const res: MediaContent = {
              last_crawl_time: Times.parse_text_to_instant(g_create_time),
              title: find_value("TI") ?? "",
              content_text_summary,
              content_text_detail: null,
              content_link_url: `https://pubmed.ncbi.nlm.nih.gov/${pubmed_id}`,
              authors: ncbi_fmt.authors.map((it) => {
                return {
                  platform_user_id: `PersonName---${it.AU}`,
                  nickname: it.AU,
                  avater_url: null,
                  home_link_url: null,
                };
              }),
              platform: PlatformEnum.PubMed,
              platform_duplicate_id: `${pubmed_id}`,
              count_read: null,
              count_like: null,
              from_search_context: !g_search_key ? [] : [
                {
                  question: g_search_key,
                },
              ],
              create_time: Arrays.first_or_null(
                [
                  dcom ? Times.parse_text_to_instant(dcom) : null,
                  lr ? Times.parse_text_to_instant(lr) : null,
                ].filter((it) => it !== null),
              ),
              update_time: null,
              tags: chain(() =>
                ncbi_fmt.entries_multiple
                  .find((it) => it.label === "OT")
                  ?.values.map((it) => ({ text: it }))
              )
                .map((it) => (it && it.length > 0 ? it : null))
                .get_value() ?? null,
              ip_location: null,
              cover_url: null,
              count_share: null,
              count_star: null,
              video_total_count_danmaku: null,
              video_total_duration_sec: null,
              count_comment: null,
              platform_rank_score: null,
              videos: null,
              literatures: [
                {
                  journal: find_value("JT"),
                  doi: get_doi(),
                  category: null,
                  level_of_evidence: null,
                  issn: get_issn(),
                  isbn: null,
                  publication_type: null,
                  pui: null,
                  book_publisher: null,
                  cnsn: null,
                },
              ],
              language: find_value("LA"),
            };
            yield res;
          }
        }
      } catch (err) {
        // console.warn('',{garbage})
        throw new Error(
          `Failed on read garbage for libian crawler item : g_id is ${garbage.obj.g_id}`,
          {
            cause: err,
          },
        );
      }
    }
  }

  function create_reducer_for_type<
    Prev,
    Cur extends {
      platform: PlatformEnum;
      platform_duplicate_id: string;
    },
  >(options: {
    get_key_prefix: string;
    reduce: (prev: Prev | null, cur: Cur) => Prev;
  }) {
    const all_key: Set<string> = new Set();
    const cache = create_cache_in_memory<Prev>();
    const { get_key_prefix, reduce } = options;

    const reducer = async function* () {
      const get_key = (cur: Cur) =>
        `${get_key_prefix}__${cur.platform}__${cur.platform_duplicate_id}`;

      console.debug("create_reducer_for_type ", { get_key_prefix });
      while (1) {
        const content: Cur | "stop" = yield;
        try {
          if ("stop" === content) {
            return [all_key, cache] as const;
          }
          if (
            "platform_duplicate_id" in content &&
            typeof content.platform_duplicate_id === "string" &&
            (content.platform_duplicate_id.trim() === "" ||
              content.platform_duplicate_id.indexOf("null") >= 0 ||
              content.platform_duplicate_id.indexOf("undefined") >= 0)
          ) {
            throw new Error(
              `content.platform_duplicate_id maybe invalid : ${content.platform_duplicate_id}`,
            );
          }
          const k = get_key(content);
          all_key.add(k);
          const cache_get_result = cache.get_batch(new Set([k]));
          let exists: Prev | null;
          if (cache_get_result[k]) {
            exists = await Promise.resolve(cache_get_result[k]);
          } else {
            exists = null;
          }
          const res = reduce(exists, content);
          const cache_set_result = await Promise.resolve(cache.set(k, res));
          if (cache_set_result !== "ok") {
            throw new Error(
              `Cache set should return "ok" , but not : ${cache_set_result}`,
            );
          }
        } catch (err) {
          console.error("Failed dump content , content is", {
            content,
            err,
          });
          let content_output: string;
          try {
            content_output = Jsons.dump(content, { indent: 2 });
          } catch (err) {
            // it can't be json
            content_output =
              `{{ Can't be json, See it at console.log (jsonstringify failed by ${err}) }}`;
          }
          throw new Error(
            `Failed on merge : content is ${content_output}`,
            { cause: err },
          );
        }
      }
    };
    return {
      reducer: reducer(),
      serial_to_file: async function (basedir: string, tag_text: string) {
        console.debug("Serial Reducer cache to file :", { tag_text, basedir });
        const cached_data = await Promise.all(
          Mappings.object_entries(cache.get_batch(all_key)).map((it) =>
            Promise.resolve(it[1]).then((res) => [it[0], res] as const)
          ),
        );
        await SerAny.ser_to_file(
          Paths.join2(basedir, `${tag_text}.serany.json`),
          {
            all_key,
            cached_data,
          },
          {
            pretty: true,
          },
        );
        // console.debug("Finish serial Reducer cache to file :", {
        //   tag_text,
        //   basedir,
        // });
      },
      deser_cache: async function (
        reducer_cache_file_path: `${string}.serany.json`,
      ) {
        let reducer_cache_file: Deno.FileInfo;
        try {
          reducer_cache_file = await Deno.stat(reducer_cache_file_path);
        } catch (err) {
          if (err instanceof Deno.errors.NotFound) {
            // Reduced cache file missing
            console.warn(
              "Reduced cache file not found , Disable deser cache",
              {
                reducer_cache_file_path,
              },
            );
            return "DisableCache" as const;
          } else {
            throw new Error("Failed stat reducer_cache_file", {
              cause: err,
            });
          }
        }
        if (!reducer_cache_file.isFile) {
          throw new Error(
            `reducer_cache_file is not a file : ${reducer_cache_file_path}`,
          );
        }
        const deser_obj = await SerAny.deser_from_file(
          reducer_cache_file_path,
        );
        if (
          typeof deser_obj === "object" && deser_obj &&
          "all_key" in deser_obj && deser_obj.all_key instanceof Set &&
          "cached_data" in deser_obj && Array.isArray(deser_obj.cached_data)
        ) {
          console.info(
            "Loading reduced result cache from file :",
            { reducer_cache_file_path },
          );
          for (const key of deser_obj.all_key) {
            if (typeof key !== "string") {
              throw new Error("key not string");
            }
            all_key.add(key);
          }
          for (const data_entry of deser_obj.cached_data) {
            if (
              Array.isArray(data_entry) && data_entry.length === 2 &&
              typeof data_entry[0] === "string" &&
              typeof data_entry[1] === "object" &&
              all_key.has(data_entry[0])
            ) {
              cache.set(data_entry[0], data_entry[1]);
            } else {
              throw new Error(
                `data_entry not [string, object] but ${data_entry} , (all_key.has(data_entry[0]))==${
                  all_key.has(data_entry[0])
                } `,
              );
            }
          }
          return "OK" as const;
        } else {
          throw new Error(
            `Invalid format of deser_obj from reducer_cache_file : ${reducer_cache_file_path}`,
          );
        }
      },
    };
  }

  export function create_reducer_for_media_content() {
    return create_reducer_for_type<
      LibianCrawlerCleanAndMergeUtil.MediaContentMerged,
      MediaContent
    >({
      get_key_prefix: "mc",
      reduce: (prev, cur) => {
        const to_timeline_item = <V>(
          value: V,
        ): DataMerge.Timeline<V>[number] => ({
          time: cur.update_time ?? cur.create_time ?? "unknown",
          value,
        });
        if (
          prev !== null &&
          (cur.platform !== prev.platform ||
            cur.platform_duplicate_id !== prev.platform_duplicate_id)
        ) {
          throw new Error(
            `Platform and id not match : cur.platform=${cur.platform} , prev.platform=${prev.platform} , cur.platform_duplicate_id=${cur.platform_duplicate_id} , prev.platform_duplicate_id=${prev.platform_duplicate_id}`,
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
        const authors:
          LibianCrawlerCleanAndMergeUtil.MediaContentMerged["authors"] =
            prev?.authors ?? new Map();
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
        const content_text_summary_uncleaned_timeline = DataMerge
          .merge_and_sort_timeline({
            old: prev?.content_text_summary_uncleaned_timeline ?? [],
            timeline: chain(() => content_text_summary_uncleaned)
              .array_wrap_nonnull()
              .map((it) => to_timeline_item(it)),
          });
        const content_text_detail_uncleaned = cur.content_text_detail;
        const content_text_detail_uncleaned_timeline = DataMerge
          .merge_and_sort_timeline({
            old: prev?.content_text_detail_uncleaned_timeline ?? [],
            timeline: chain(() => content_text_detail_uncleaned)
              .array_wrap_nonnull()
              .map((it) => to_timeline_item(it)),
          });
        const content_text_latest = DataMerge.merge_and_sort_timeline({
          old: content_text_summary_uncleaned_timeline,
          timeline: content_text_detail_uncleaned_timeline,
        }).findLast((it) => it.value)?.value ?? null;
        let literatures: MediaContent["literatures"] = prev?.literatures ?? [];
        if (cur.literatures && cur.literatures.length >= 1) {
          literatures.push(...cur.literatures);
        }
        literatures = literatures.filter(
          (it) =>
            Mappings.object_entries(it).filter((e) => {
              const v = e[1];
              return (
                v !== null &&
                v !== undefined &&
                (typeof v !== "string" || v.length > 0)
              );
            }).length > 0,
        );
        if (literatures.length <= 0) {
          literatures = null;
        }
        const language = prev?.language ?? cur.language;
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
          content_text_latest: content_text_latest ? content_text_latest : "",
          literatures,
          language,
        };
      },
    });
  }

  export function create_reducer_for_shop_good() {
    return create_reducer_for_type<
      LibianCrawlerCleanAndMergeUtil.ShopGoodMerged,
      ShopGood
    >({
      get_key_prefix: "shopgood",
      reduce(prev, cur) {
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
        return {
          ...cur,
          create_time,
          update_time,
        };
      },
    });
  }

  export function create_reducer_for_chat_message() {
    return create_reducer_for_type<ChatMessage, ChatMessage>({
      get_key_prefix: "chatmessage",
      reduce(prev, cur) {
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
        return {
          ...cur,
          create_time,
          update_time,
        };
      },
    });
  }

  export function create_reducer_for_literature() {
    return create_reducer_for_type<Literature, Literature>({
      get_key_prefix: "literature",
      reduce(prev, cur) {
        const last_crawl_time = Nums.take_extreme_value("max", [
          prev?.last_crawl_time ?? null,
          cur.last_crawl_time,
        ]);
        const languages = Streams.deduplicate([
          ...(prev?.languages ?? []),
          ...(cur.languages ?? []),
        ]);
        const keywords = Streams.deduplicate([
          ...(prev?.keywords ?? []),
          ...(cur.keywords ?? []),
        ]);
        const create_year = chain(() =>
          [prev?.create_year, cur.create_year].map((it) =>
            typeof it === "number" ? it : -1
          ).filter((it) => it > 1000)
        ).map((it) => it.length <= 0 ? null : Math.min(...it)).get_value();
        const international_standard_serial_number = Arrays.first_or_null([
          prev?.international_standard_serial_number ?? null,
          cur.international_standard_serial_number,
        ].filter((it) => Strs.is_not_blank(it)));
        const international_standard_book_number = Arrays.first_or_null([
          prev?.international_standard_book_number ?? null,
          cur.international_standard_book_number,
        ].filter((it) => Strs.is_not_blank(it)));
        const china_standard_serial_number = Arrays.first_or_null([
          prev?.china_standard_serial_number ?? null,
          cur.china_standard_serial_number,
        ].filter((it) => Strs.is_not_blank(it)));
        const publication_organizer = Arrays.first_or_null([
          prev?.publication_organizer ?? null,
          cur.publication_organizer,
        ].filter((it) => Strs.is_not_blank(it)));
        const publication_place = Arrays.first_or_null([
          prev?.publication_place ?? null,
          cur.publication_place,
        ].filter((it) => Strs.is_not_blank(it)));
        const count_published_documents = Nums.take_extreme_value("max", [
          prev?.count_published_documents ?? null,
          cur.count_published_documents,
        ]);
        const count_download_total = Nums.take_extreme_value("max", [
          prev?.count_download_total ?? null,
          cur.count_download_total,
        ]);
        const count_citations_total = Nums.take_extreme_value("max", [
          prev?.count_citations_total ?? null,
          cur.count_citations_total,
        ]);
        let impact_factor_latest: number | null;
        if (prev?.impact_factor_latest) {
          const pt = prev?.last_crawl_time;
          const ct = cur.last_crawl_time;
          const pv = prev.impact_factor_latest;
          const cv = cur.impact_factor_latest;
          if (cv && cv > 0) {
            if (pt && ct) {
              impact_factor_latest = Temporal.Instant.compare(pt, ct) < 0
                ? cv
                : pv;
            } else if (pt) {
              impact_factor_latest = pv;
            } else if (ct) {
              impact_factor_latest = cv;
            } else {
              impact_factor_latest = pv > cv ? pv : cv;
            }
          } else {
            impact_factor_latest = pv;
          }
        } else {
          const cv = cur.impact_factor_latest;
          if (cv && cv > 0) {
            impact_factor_latest = cv;
          } else {
            impact_factor_latest = null;
          }
        }
        return {
          ...cur,
          last_crawl_time,
          languages,
          keywords,
          create_year,
          international_standard_serial_number,
          international_standard_book_number,
          china_standard_serial_number,
          publication_organizer,
          publication_place,
          count_published_documents,
          count_download_total,
          count_citations_total,
          impact_factor_latest,
        };
      },
    });
  }

  /**
   * 本来想把 kysely 的增删改查也封装的，奈何类型体操令人头晕目眩，所以先不管。
   */
  export async function _insert_or_update<
    Item,
    SelectDto extends { id: string },
  >(
    values: Item[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
      pause_on_dbupdate: boolean;
    },
    ctx: {
      get_id: (t: Item) => string;
      // get_dto_for_insert_or_update: (t: Item) => Omit<ItemDto, "id">;
      is_value_equal_then_value_dto: (
        value: Item,
        existed_dto: SelectDto,
      ) => {
        result: boolean;
        value_to_dto: unknown;
      };
      read_existed_list: () => Promise<SelectDto[]>;
      exec_update_result: (ctx2: {
        value: Item;
        existed: SelectDto;
      }) => Promise<UpdateResult>;
      exec_insert_result: (ctx2: {
        not_existed: Item[];
      }) => Promise<InsertResult[]>;
      // get_dto_for_insert_or_update: (value: Item) => UpdateObject; //UpdateObjectExpression<DB, TB, UT>;
    },
  ) {
    const { on_bar_text, pause_on_dbupdate } = options;
    const {
      get_id,
      is_value_equal_then_value_dto,
      read_existed_list,
      exec_update_result,
      exec_insert_result,
    } = ctx;
    const existed_list = await read_existed_list();
    try {
      const update_results: UpdateResult[] = [];
      const samed_count = {
        value: 0,
      };
      const update_bar = async () =>
        await on_bar_text(
          `(updated ${update_results.length} + samed ${samed_count.value} / existed ${existed_list.length} / total ${values.length})`,
        );
      for (const existed of existed_list) {
        await update_bar();
        const value = values.find((value) => get_id(value) === existed.id);
        if (value === undefined) {
          throw new Error(
            `BUG, value_new not found in values , but values id should in existed list , context is : ${
              Deno.inspect(
                { existed, existed_list, values },
              )
            }`,
          );
        }
        let value_equal_then_value_dto: ReturnType<
          typeof is_value_equal_then_value_dto
        >;
        try {
          value_equal_then_value_dto = is_value_equal_then_value_dto(
            value,
            existed,
          );
        } catch (err) {
          throw new Error(
            `Failed check is_value_equal_then_value_dto(value, existed) !
---------------------------
value inspect is:
${Deno.inspect(value, { depth: 4 })}

existed inspect is:
${Deno.inspect(existed, { depth: 4 })}
`,
            { cause: err },
          );
        }

        if (value_equal_then_value_dto.result) {
          samed_count.value += 1;
          continue;
        }
        if (pause_on_dbupdate) {
          console.debug("Diff when pause_on_dbupdate", {
            value,
            value_to_dto: value_equal_then_value_dto.value_to_dto,
            existed,
          });
          prompt("Pause on db update , press any key to continue ...");
        }
        try {
          const update_result = await exec_update_result({
            value,
            existed,
          });
          update_results.push(update_result);
        } catch (err2) {
          throw new Error(`update failed : ${Jsons.dump({ value, existed })}`, {
            cause: err2,
          });
        }
        continue;
      }
      await update_bar();

      const not_existed = [...values].filter((it) => {
        return (
          undefined === existed_list.find((exist) => exist.id === get_id(it))
        );
      });

      try {
        const insert_result = not_existed.length > 0
          ? await exec_insert_result({ not_existed })
          : null;

        return {
          update_results,
          insert_result,
        };
      } catch (err) {
        throw new Error(`insert failed`, {
          cause: err,
        });
      }
    } catch (err) {
      // if (`${err}`.includes("duplicate key value violates")) {
      //   // cause by pkey duplicate
      // } else {
      throw err;
      // }
    }
  }

  export type InsertOrUpdateProvider<Item> = (
    db: Parameters<
      Parameters<typeof create_and_init_libian_crawler_database_scope>[0]
    >[0],
    values: Item[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
      pause_on_dbupdate: boolean;
    },
  ) => Promise<{
    insert_result: InsertResult[] | null;
    update_results: UpdateResult[];
  }>;

  export async function insert_or_update_media_content(
    db: Parameters<
      Parameters<typeof create_and_init_libian_crawler_database_scope>[0]
    >[0],
    values: LibianCrawlerCleanAndMergeUtil.MediaContentMerged[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
      pause_on_dbupdate: boolean;
    },
  ) {
    const get_id = (
      value: LibianCrawlerCleanAndMergeUtil.MediaContentMerged,
    ) => {
      return `${value.platform}___${value.platform_duplicate_id}`;
    };
    const table = `libian_crawler_cleaned.media_post`;
    const get_dto_for_insert_or_update = (value: (typeof values)[number]) => {
      const author_first = chain(() =>
        Arrays.first_or_null([...value.authors.keys()])
      )
        .map((k) => (k === null ? null : ([k, value.authors.get(k)!] as const)))
        .map((entry) =>
          entry === null ? null : ([
            entry[0],
            Arrays.last_or_null(entry[1])?.value ?? null,
          ] as const)
        )
        .get_value();
      const author_first_platform_user_id = chain(() => author_first?.[0])
        .map((it) => (it === null ? null : `${it}`))
        .get_value();
      const literature_first =
        value.literatures === null || value.literatures === undefined
          ? null
          : Arrays.first_or_null(value.literatures);
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
      let authors_names = chain(() =>
        value.authors
          .values()
          .map((it) => Arrays.last_or_null(it)?.value?.nickname)
          .toArray()
          .filter((it) => typeof it === "string")
          .filter((it) => it.length > 0)
          .join(",")
      )
        .map((it) => (it ? it : null))
        .get_value();
      if (authors_names && authors_names.length > 700) {
        authors_names = authors_names.substring(0, 700) + "...";
      }
      let from_search_question_texts = chain(() =>
        value.from_search_questions.values().toArray().join(",")
      )
        .map((it) => (it ? it : null))
        .get_value();
      if (
        from_search_question_texts &&
        from_search_question_texts.length > 700
      ) {
        from_search_question_texts =
          from_search_question_texts.substring(0, 700) + "...";
      }
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
          ).map((k) => [k, value[k]?.toString() ?? null]),
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
        author_first_unique_user_id:
          `${value.platform}___${author_first_platform_user_id}`,
        author_first_platform_user_id,
        author_first_nickname: author_first?.[1]?.nickname ?? null,
        author_first_avater_url: author_first?.[1]?.avater_url ?? null,
        author_first_home_link_url: author_first?.[1]?.home_link_url ?? null,
        authors: Mappings.object_entries(
          Mappings.map_to_record(value.authors),
        ).map(([platform_user_id, timeline]) => ({
          platform_user_id: `${platform_user_id}`,
          timeline: DataMerge.timeline_to_json(timeline),
        })),
        cover_first_url: Arrays.first_or_null([...value.cover_urls]),
        cover_urls: [...value.cover_urls],
        platform_rank_score_timeline: DataMerge.timeline_to_json(
          value.platform_rank_score_timeline,
        ),
        tag_texts: [...tag_texts],
        tag_text_joined: Strs.limit_length([...tag_texts].join(";"), 900),
        content_text_timeline_count: content_text_timeline_count.toString(),
        context_text_latest_str_length: context_text_latest_str_length
          .toString(),
        context_text_latest,
        content_text_deleted_at_least_once,
        content_text_deleted_first_time:
          content_text_deleted_first_time === "unknown"
            ? null
            : Times.instant_to_date(content_text_deleted_first_time),
        content_text_resume_after_deleted,
        content_text_timeline: DataMerge.timeline_to_json(
          content_text_timeline,
        ),
        content_text_summary_uncleaned_timeline: DataMerge.timeline_to_json(
          value.content_text_summary_uncleaned_timeline,
        ),
        content_text_detail_uncleaned_timeline: DataMerge.timeline_to_json(
          value.content_text_detail_uncleaned_timeline,
        ),
        context_text_latest_lines_count:
          context_text_latest?.split("\n").length?.toString() ?? null,
        last_crawl_time: Times.instant_to_date(value.last_crawl_time),
        authors_names,
        from_search_question_texts,
        literature_first_journal: literature_first?.journal ?? null,
        literature_first_doi: literature_first?.doi ?? null,
        literature_first_category: literature_first?.category ?? null,
        literature_first_level_of_evidence:
          literature_first?.level_of_evidence ?? null,
        literature_first_issn: literature_first?.issn ?? null,
        literature_first_isbn: literature_first?.isbn ?? null,
        literature_first_cnsn: literature_first?.cnsn ?? null,
      } satisfies Omit<
        Parameters<ReturnType<typeof db.insertInto<typeof table>>["values"]>[0],
        "id"
      >;
      const _res_typecheck = res satisfies Omit<
        // deno-lint-ignore no-explicit-any
        { [P in keyof MediaPostTable]: any },
        "id"
      >;
      return _res_typecheck;
    };
    return await _insert_or_update(values, options, {
      get_id,
      is_value_equal_then_value_dto(value, existed_dto) {
        const value_to_dto: typeof existed_dto = {
          id: existed_dto.id,
          ...get_dto_for_insert_or_update(value),
        };
        return {
          result: pg_dto_equal(value_to_dto, existed_dto),
          value_to_dto,
        };
      },
      read_existed_list: async () => {
        const existed_list = await db
          .selectFrom(table)
          .selectAll()
          .where("id", "in", [...values.map((value) => get_id(value))])
          .execute();
        return existed_list;
      },
      exec_update_result: async (ctx2) => {
        return await db
          .updateTable(table)
          .set((_eb) => {
            return {
              ...get_dto_for_insert_or_update(ctx2.value),
            };
          })
          .where("id", "=", ctx2.existed.id)
          .executeTakeFirstOrThrow();
      },
      exec_insert_result: async (ctx2) => {
        return await db
          .insertInto(table)
          .values([
            ...ctx2.not_existed.map((value) => {
              return {
                id: get_id(value),
                ...get_dto_for_insert_or_update(value),
              };
            }),
          ])
          .execute();
      },
    });
  }

  export async function insert_or_update_shop_good(
    db: Parameters<
      Parameters<typeof create_and_init_libian_crawler_database_scope>[0]
    >[0],
    values: LibianCrawlerCleanAndMergeUtil.ShopGoodMerged[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
      pause_on_dbupdate: boolean;
    },
  ) {
    const get_id = (value: LibianCrawlerCleanAndMergeUtil.ShopGoodMerged) => {
      return `${value.platform}___${value.platform_duplicate_id}`;
    };
    const table = `libian_crawler_cleaned.shop_good`;
    const get_dto_for_insert_or_update = (value: (typeof values)[number]) => {
      const res = {
        ...Mappings.filter_keys(value, "pick", [
          "platform",
          "platform_duplicate_id",
          "good_name",
          "shop_name",
          "link_url",
        ]),
        ...Mappings.object_from_entries(
          (["good_id", "shop_id"] as const).map((k) => [
            k,
            value[k]?.toString() ?? null,
          ]),
        ),
        create_time: Times.instant_to_date(value.create_time),
        update_time: Times.instant_to_date(value.update_time),
        search_from: [...value.search_from],
        good_images: value.good_images,
        good_first_image_url: Arrays.first_or_null(
          value.good_images
            .map((it) => it.url)
            .filter((url) => Strs.is_not_blank(url)),
        ),
        sku_list: value.sku_list.map((it) => {
          return {
            ...it,
            price_display_cny_unit001:
              it.price_display_cny_unit001?.toString() ?? null,
          };
        }),
        sku_min_price_cny001: (
          Nums.take_extreme_value("min", [
            null,
            ...value.sku_list.map((it) => it.price_display_cny_unit001),
          ]) ?? 0
        ).toString(),
        sku_max_price_cny001: Nums.take_extreme_value("max", [
          BigInt(0),
          ...value.sku_list.map((it) => it.price_display_cny_unit001),
        ]).toString(),
      } satisfies Omit<
        Parameters<ReturnType<typeof db.insertInto<typeof table>>["values"]>[0],
        "id"
      >;
      const _res_typecheck = res satisfies Omit<
        // deno-lint-ignore no-explicit-any
        { [P in keyof ShopGoodTable]: any },
        "id"
      >;
      return _res_typecheck;
    };
    return await _insert_or_update(values, options, {
      get_id,
      is_value_equal_then_value_dto(value, existed_dto) {
        const value_to_dto: typeof existed_dto = {
          id: existed_dto.id,
          ...get_dto_for_insert_or_update(value),
        };
        return {
          result: pg_dto_equal(value_to_dto, existed_dto),
          value_to_dto,
        };
      },
      read_existed_list: async () => {
        const existed_list = await db
          .selectFrom(table)
          .selectAll()
          .where("id", "in", [...values.map((value) => get_id(value))])
          .execute();
        return existed_list;
      },
      exec_update_result: async (ctx2) => {
        return await db
          .updateTable(table)
          .set((_eb) => {
            return {
              ...get_dto_for_insert_or_update(ctx2.value),
            };
          })
          .where("id", "=", ctx2.existed.id)
          .executeTakeFirstOrThrow();
      },
      exec_insert_result: async (ctx2) => {
        return await db
          .insertInto(table)
          .values([
            ...ctx2.not_existed.map((value) => {
              return {
                id: get_id(value),
                ...get_dto_for_insert_or_update(value),
              };
            }),
          ])
          .execute();
      },
    });
  }

  export async function insert_or_update_chat_message(
    db: Parameters<
      Parameters<typeof create_and_init_libian_crawler_database_scope>[0]
    >[0],
    values: ChatMessage[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
      pause_on_dbupdate: boolean;
    },
  ) {
    const get_id = (value: ChatMessage) => {
      return `${value.platform}___${value.platform_duplicate_id}`;
    };
    const table = `libian_crawler_cleaned.chat_message`;
    const get_dto_for_insert_or_update = (value: (typeof values)[number]) => {
      const create_time = Times.instant_to_date(value.create_time);
      const create_date = new Date(create_time);
      // create_date.setUTCDate(
      //   create_time.getTime() + create_time.getTimezoneOffset(),
      // );
      create_date.setHours(0, 0, 0, 0);
      const res = {
        ...Mappings.filter_keys(value, "pick", [
          "platform",
          "platform_duplicate_id",
          "content_plain_text",
          "content_img_url",
        ]),
        create_time,
        update_time: Times.instant_to_date(value.update_time),

        user_sendfrom_platform_id: value.user_sendfrom?.platform_id ?? null,
        user_sendfrom_nickname: value.user_sendfrom?.nickname ?? null,
        user_sendfrom_avater_url: value.user_sendfrom?.avater_url ?? null,

        user_sendto_platform_id: value.user_sendto?.platform_id ?? null,
        user_sendto_nickname: value.user_sendto?.nickname ?? null,
        user_sendto_avater_url: value.user_sendto?.avater_url ?? null,

        group_sendto_platform_id: value.group_sendto?.platform_id ?? null,
        group_sendto_nickname: value.group_sendto?.nickname ?? null,
        group_sendto_avater_url: value.group_sendto?.avater_url ?? null,

        user_employer_platform_id: value.user_employer?.platform_id ?? null,
        user_employer_nickname: value.user_employer?.nickname ?? null,
        user_employer_avater_url: value.user_employer?.avater_url ?? null,

        user_employee_platform_id: value.user_employee?.platform_id ?? null,
        user_employee_nickname: value.user_employee?.nickname ?? null,
        user_employee_avater_url: value.user_employee?.avater_url ?? null,

        user_customer_platform_id: value.user_customer?.platform_id ?? null,
        user_customer_nickname: value.user_customer?.nickname ?? null,
        user_customer_avater_url: value.user_customer?.avater_url ?? null,

        create_date,
      } satisfies Omit<
        Parameters<ReturnType<typeof db.insertInto<typeof table>>["values"]>[0],
        "id"
      >;
      const _res_typecheck = res satisfies Omit<
        // deno-lint-ignore no-explicit-any
        { [P in keyof ChatMessageTable]: any },
        "id"
      >;
      return _res_typecheck;
    };
    return await _insert_or_update(values, options, {
      get_id,
      is_value_equal_then_value_dto(value, existed_dto) {
        const value_to_dto: typeof existed_dto = {
          id: existed_dto.id,
          ...get_dto_for_insert_or_update(value),
        };
        return {
          result: pg_dto_equal(value_to_dto, existed_dto),
          value_to_dto,
        };
      },
      read_existed_list: async () => {
        const existed_list = await db
          .selectFrom(table)
          .selectAll()
          .where("id", "in", [...values.map((value) => get_id(value))])
          .execute();
        return existed_list;
      },
      exec_update_result: async (ctx2) => {
        return await db
          .updateTable(table)
          .set((_eb) => {
            return {
              ...get_dto_for_insert_or_update(ctx2.value),
            };
          })
          .where("id", "=", ctx2.existed.id)
          .executeTakeFirstOrThrow();
      },
      exec_insert_result: async (ctx2) => {
        return await db
          .insertInto(table)
          .values([
            ...ctx2.not_existed.map((value) => {
              return {
                id: get_id(value),
                ...get_dto_for_insert_or_update(value),
              };
            }),
          ])
          .execute();
      },
    });
  }

  export async function insert_or_update_literature(
    db: Parameters<
      Parameters<typeof create_and_init_libian_crawler_database_scope>[0]
    >[0],
    values: Literature[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
      pause_on_dbupdate: boolean;
    },
  ) {
    const get_id = (value: Literature) => {
      return `${value.platform}___${value.platform_duplicate_id}`;
    };
    const table = `libian_crawler_cleaned.literature`;
    const get_dto_for_insert_or_update = (value: (typeof values)[number]) => {
      const last_crawl_time = Times.instant_to_date(value.last_crawl_time);
      const res = {
        ...Mappings.filter_keys(value, "pick", [
          "platform",
          "platform_duplicate_id",
          "crawl_from_platform",
          "title",
          "languages",
          "create_year",
          "international_standard_serial_number",
          "international_standard_book_number",
          "china_standard_serial_number",
          "publication_organizer",
          "publication_place",
          "keywords",
          "count_published_documents",
          "count_download_total",
          "count_citations_total",
          "impact_factor_latest",
          "eissn",
        ]),
        last_crawl_time,
        languages_joined: (value.languages ?? []).join(","),
        keywords_joined: (value.keywords ?? []).join(","),
      } satisfies Omit<
        Parameters<ReturnType<typeof db.insertInto<typeof table>>["values"]>[0],
        "id"
      >;
      const _res_typecheck = res satisfies Omit<
        // deno-lint-ignore no-explicit-any
        { [P in keyof LiteratureTable]: any },
        "id"
      >;
      return _res_typecheck;
    };
    return await _insert_or_update(values, options, {
      get_id,
      is_value_equal_then_value_dto(value, existed_dto) {
        const value_to_dto: typeof existed_dto = {
          id: existed_dto.id,
          ...get_dto_for_insert_or_update(value),
        };
        return {
          result: pg_dto_equal(value_to_dto, existed_dto),
          value_to_dto,
        };
      },
      read_existed_list: async () => {
        const existed_list = await db
          .selectFrom(table)
          .selectAll()
          .where("id", "in", [...values.map((value) => get_id(value))])
          .execute();
        return existed_list;
      },
      exec_update_result: async (ctx2) => {
        return await db
          .updateTable(table)
          .set((_eb) => {
            return {
              ...get_dto_for_insert_or_update(ctx2.value),
            };
          })
          .where("id", "=", ctx2.existed.id)
          .executeTakeFirstOrThrow();
      },
      exec_insert_result: async (ctx2) => {
        return await db
          .insertInto(table)
          .values([
            ...ctx2.not_existed.map((value) => {
              return {
                id: get_id(value),
                ...get_dto_for_insert_or_update(value),
              };
            }),
          ])
          .execute();
      },
    });
  }
}
