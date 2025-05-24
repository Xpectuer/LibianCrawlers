import {
  type LibianCrawlerGarbage,
  read_LibianCrawlerGarbage,
} from "../../user_code/LibianCrawlerGarbage.ts";
import { type UpdateResult, type InsertResult } from "kysely";
import {
  Arrays,
  chain,
  DataClean,
  DataMerge,
  Errors,
  is_nullish,
  Jsonatas,
  Jsons,
  Mappings,
  Nums,
  ProcessBar,
  Streams,
  Strs,
  Times,
  Typings,
} from "../../util.ts";
import { create_cache_in_memory, ICache } from "../caches.ts";
import {
  MediaContent,
  MediaSearchContext,
  MediaVideo,
  PlatformEnum,
  MediaRelatedSearches,
  MediaContentAuthor,
} from "../media.ts";
import { Paragraphs } from "../paragraph_analysis.ts";
import { ShopGood } from "../shop_good.ts";
import {
  ChatMessageTable,
  create_and_init_libian_srawler_database_scope,
  MediaPostTable,
  ShopGoodTable,
} from "./data_storage.ts";
import { pg_dto_equal } from "../../pg.ts";
import { ChatMessage } from "../chat_message.ts";
import { createHash } from "node:crypto";

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
    >
  ) {
    const hash = createHash("sha512")
      .update(
        `${msg.platform}___${Times.instant_to_date(
          msg.create_time
        ).toISOString()}___${msg.user_sendfrom?.nickname ?? ""}___${
          msg.content_plain_text ?? ""
        }___${msg.content_img_url ?? ""}`
      )
      .digest("hex");

    return `cpdi___${msg.user_sendfrom?.nickname ?? ``}___${hash}` as const;
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
      const garbage: LibianCrawlerGarbage = yield;
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
          const ip_location =
            "ip_location" in note
              ? note.ip_location
                ? note.ip_location
                : null
              : null;
          const video =
            "video" in note ? (note.video ? note.video : null) : null;
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
            content_link_url:
              LibianCrawlerCleanAndMergeUtil.xiaohongshu_note_content_link_url({
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
                nickname: user.nickname,
                platform_user_id: user.user_id,
                avater_url: DataClean.url_use_https_noempty(user.avatar),
                home_link_url:
                  LibianCrawlerCleanAndMergeUtil.xiaohongshu_author_home_link_url(
                    {
                      user_id: user.user_id,
                    }
                  ),
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
                      download_urls: Mappings.object_entries(
                        video.media.stream
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
                                s.master_url
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
                content_link_url:
                  LibianCrawlerCleanAndMergeUtil.xiaohongshu_note_content_link_url(
                    {
                      note_id: id,
                      xsec_token,
                    }
                  ),
                content_text_summary: null,
                content_text_detail: null,
                authors: [
                  {
                    nickname: user.nickname ?? user.nick_name,
                    platform_user_id: user.user_id,
                    avater_url: DataClean.url_use_https_noempty(user.avatar),
                    home_link_url:
                      LibianCrawlerCleanAndMergeUtil.xiaohongshu_author_home_link_url(
                        {
                          user_id: user.user_id,
                        }
                      ),
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
                literatures: null,
                language: null,
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
                      "cover" in it ? it.cover ?? null : null
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
            const duration_sec =
              duration.trim() === ""
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
              video_total_duration_sec:
                DataClean.nan_infinity_to_null(duration_sec),
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
                const gifUrl =
                  "gifUrl" in it
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
                          DataClean.parse_number((v * mul).toFixed(3))
                        )
                      )
                  ),
                  label:
                    "sideCarLabels" in sku
                      ? sku.sideCarLabels
                          ?.map((it) => it.text)
                          .filter((it) => Strs.is_not_blank(it))
                          .join(";") ?? ""
                      : "",
                };
              }),
              link_url: `https://mobile.yangkeduo.com/goods.html?goods_id=${goods.goodsID}`,
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
                  "https://www.baidu.com/link?url="
                )
              ) {
                platform_duplicate_id = Strs.remove_prefix(
                  content_link_url,
                  "https://www.baidu.com/link?url="
                );
              } else {
                console.warn(
                  "content link url prefix not match , it is :",
                  content_link_url
                );
                continue;
              }
              const res: MediaContent = {
                last_crawl_time: Times.parse_text_to_instant(
                  smart_crawl.g_create_time
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
                      ? smart_crawl.g_content.dump_page_info?.frame_tree.url ??
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
                ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait.url
                : null;
            if (typeof content_link_url_props?.url !== "string") {
              console.warn("Why content_link_url_props?.url not string ?", {
                content_link_url_props,
                xhs,
              });
              continue;
            }
            const content_link_url = DataClean.url_use_https_noempty(
              content_link_url_props.url
            );
            let platform_duplicate_id: string;
            if (
              Strs.startswith(
                content_link_url,
                "https://www.xiaohongshu.com/explore/"
              )
            ) {
              const match_res =
                /^https:\/\/www.xiaohongshu.com\/explore\/(.*)([?](.*))?$/g.exec(
                  content_link_url
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
                })
              );
              if (!home_link_url) {
                continue;
              }
              let platform_user_id: string | undefined;
              if (
                Strs.startswith(
                  home_link_url,
                  "https://xiaohongshu.com/user/profile/"
                )
              ) {
                platform_user_id = Strs.remove_prefix(
                  home_link_url,
                  "https://xiaohongshu.com/user/profile/"
                )
                  .split(/[\/\?]/g)
                  .at(0);
              } else {
                console.warn(
                  "Why home link url not startwith xhs user profile ?",
                  { home_link_url, xhs }
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
                  xhs.author_avater
                ),
                home_link_url,
                platform_user_id,
              };
            }
            const res: MediaContent = {
              last_crawl_time: Times.parse_text_to_instant(
                smart_crawl.g_create_time
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
                      DataClean.parse_number(xhs.like, "raise")
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
                      DataClean.parse_number(xhs.collect, "raise")
                    )
                : null,
              video_total_count_danmaku: null,
              video_total_duration_sec: null,
              count_comment: xhs.comment
                ? xhs.comment === "评论"
                  ? BigInt(0)
                  : DataClean.cast_and_must_be_natural_number(
                      DataClean.parse_number(xhs.comment, "raise")
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
            const url =
              "dump_page_info" in smart_crawl.g_content
                ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait.url
                    .url
                : null;
            const { title } = cnki;
            if (!url || !title) {
              continue;
            }
            const content_link_url = DataClean.url_use_https_noempty(url);
            const authors =
              typeof cnki.authors === "undefined"
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
                smart_crawl.g_create_time
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
              platform_duplicate_id: `TitleAuthors---${title}---${authors
                .map((it) => it.name)
                .join(";")}`,
              count_read: null,
              count_like: null,
              from_search_context: !search_keyword
                ? []
                : [
                    {
                      question: search_keyword,
                    },
                  ],
              create_time: !cnki.public_time
                ? null
                : Times.parse_text_to_instant(cnki.public_time.split("（")[0]),
              update_time: null,
              tags: cnki.keywords?.map((it) => ({ text: it })) ?? null,
              ip_location: null,
              cover_url:
                typeof page_info_smart_wait === "object" &&
                page_info_smart_wait &&
                "files" in page_info_smart_wait &&
                typeof page_info_smart_wait.files === "object" &&
                "public_url" in page_info_smart_wait.files &&
                page_info_smart_wait.files.public_url
                  ? DataClean.url_use_https_noempty(
                      page_info_smart_wait.files.public_url
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
                        "."
                      ).trim()
                    : null,
                  doi: cnki.doi ? cnki.doi.trim() : null,
                  category: null,
                  level_of_evidence: null,
                },
              ],
              language: null,
            };
            yield res;
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

            let messages_ordered: Array<
              (typeof messages_no_order)[number] & {
                create_time: Temporal.Instant;
              }
            > = [];
            let current_group_time: string | null = null;
            for (const msg of messages_no_order) {
              if (Mappings.object_keys(msg).length <= 0) {
                continue;
              }
              if ("groupTime" in msg && msg.groupTime) {
                current_group_time = msg.groupTime;
                continue;
              }
              if (current_group_time === null) {
                throw new Error(
                  `Why current group time not setting , qianniu_message_export is :${Jsons.dump(
                    template_parse_html_tree.qianniu_message_export,
                    { indent: 2 }
                  )}`
                );
              }
              if (
                !msg.chatTime ||
                !msg.chatName ||
                (!msg.chatTextLeft && !msg.img)
              ) {
                throw new Error(
                  `Not found msg property , msg is ${Jsons.dump(msg)}`
                );
              }
              const create_time = Times.parse_instant(
                `${current_group_time} ${msg.chatTime}`
              );
              if (!create_time) {
                throw new Error(
                  `Parse time invalid , msg is ${Jsons.dump(msg)}`
                );
              }
              messages_ordered.push({
                ...msg,
                create_time,
              });
            }
            messages_ordered = messages_ordered.sort((a, b) => {
              return Temporal.Instant.compare(a.create_time, b.create_time);
            });
            let user_employee: ChatMessage["user_employee"] = null;
            for (const msg of messages_ordered) {
              if (
                !msg.chatTime ||
                !msg.chatName ||
                (!msg.chatTextLeft && !msg.img)
              ) {
                throw new Error(
                  `Not found msg property , msg is ${Jsons.dump(msg)}`
                );
              }
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
                platform_duplicate_id:
                  LibianCrawlerCleanAndMergeUtil.compute_platform_duplicate_id_for_chat_message(
                    res
                  ),
              };
              yield res2;
              continue;
            }
          }
        } else {
          if (
            "group__entrez_search_result__lib_biopython" in garbage &&
            garbage["group__entrez_search_result__lib_biopython"]
          ) {
            const { template_parse_html_tree, g_create_time, g_search_key } =
              garbage.group__entrez_search_result__lib_biopython;
            const { ref_works } = template_parse_html_tree;
            if (!ref_works) {
              throw new Error("Why parse ref_works failed ?");
            }
            const find_value = (
              label: (typeof ref_works)["entries"][number]["label"]
            ) =>
              ref_works.entries_multiple.find((it) => it.label === label)
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
              if (!line) {
                return null;
              }
              return line;
            };
            const pubmed_id = find_value("PMID");
            if (!pubmed_id) {
              throw new Error("TODO: other platform");
            }
            const dcom = find_value("DCOM");
            const lr = find_value("LR");
            let content_text_summary = find_value("AB");
            if (content_text_summary && content_text_summary.length > 700) {
              content_text_summary =
                content_text_summary.substring(0, 700) + "...";
            }
            const res: MediaContent = {
              last_crawl_time: Times.parse_text_to_instant(g_create_time),
              title: find_value("TI") ?? "",
              content_text_summary,
              content_text_detail: null,
              content_link_url: `https://pubmed.ncbi.nlm.nih.gov/${pubmed_id}`,
              authors: ref_works.authors.map((it) => {
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
              from_search_context: !g_search_key
                ? []
                : [
                    {
                      question: g_search_key,
                    },
                  ],
              create_time: Arrays.first_or_null(
                [
                  dcom ? Times.parse_text_to_instant(dcom) : null,
                  lr ? Times.parse_text_to_instant(lr) : null,
                ].filter((it) => it !== null)
              ),
              update_time: null,
              tags:
                chain(() =>
                  ref_works.entries_multiple
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
          }
        );
      }
    }
  }

  async function* create_reducer_for_type<
    Prev,
    Cur extends {
      platform: PlatformEnum;
      platform_duplicate_id: string;
    }
  >(options: {
    get_key_prefix: string;
    reduce: (prev: Prev | null, cur: Cur) => Prev;
  }) {
    const all_key: Set<string> = new Set();
    const cache = create_cache_in_memory<Prev>();
    const { get_key_prefix, reduce } = options;
    const get_key = (cur: Cur) =>
      `${get_key_prefix}__${cur.platform}__${cur.platform_duplicate_id}`;
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
            `content.platform_duplicate_id maybe invalid : ${content.platform_duplicate_id}`
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
        cache.set(k, res);
      } catch (err) {
        throw new Error(
          `Failed on merge : content is ${JSON.stringify(content)}`,
          { cause: err }
        );
      }
    }
  }

  export function create_reducer_for_media_content() {
    return create_reducer_for_type<
      LibianCrawlerCleanAndMergeUtil.MediaContentMerged,
      MediaContent
    >({
      get_key_prefix: "mc",
      reduce: (prev, cur) => {
        const to_timeline_item = <V>(
          value: V
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
        const authors: LibianCrawlerCleanAndMergeUtil.MediaContentMerged["authors"] =
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
        const content_text_latest =
          DataMerge.merge_and_sort_timeline({
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
            }).length > 0
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

  /**
   * 本来想把 kysely 的增删改查也封装的，奈何类型体操令人头晕目眩，所以先不管。
   */
  export async function _insert_or_update<
    Item,
    SelectDto extends { id: string }
  >(
    values: Item[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
    },
    ctx: {
      get_id: (t: Item) => string;
      // get_dto_for_insert_or_update: (t: Item) => Omit<ItemDto, "id">;
      is_value_equal_then_value_dto: (
        value: Item,
        existed_dto: SelectDto
      ) => boolean;
      read_existed_list: () => Promise<SelectDto[]>;
      exec_update_result: (ctx2: {
        value: Item;
        existed: SelectDto;
      }) => Promise<UpdateResult>;
      exec_insert_result: (ctx2: {
        not_existed: Item[];
      }) => Promise<InsertResult[]>;
      // get_dto_for_insert_or_update: (value: Item) => UpdateObject; //UpdateObjectExpression<DB, TB, UT>;
    }
  ) {
    const { on_bar_text } = options;
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
        if (is_value_equal_then_value_dto(value, existed)) {
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
        const insert_result =
          not_existed.length > 0
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
      Parameters<typeof create_and_init_libian_srawler_database_scope>[0]
    >[0],
    values: Item[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
    }
  ) => Promise<{
    insert_result: InsertResult[] | null;
    update_results: UpdateResult[];
  }>;

  export async function insert_or_update_media_content(
    db: Parameters<
      Parameters<typeof create_and_init_libian_srawler_database_scope>[0]
    >[0],
    values: LibianCrawlerCleanAndMergeUtil.MediaContentMerged[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
    }
  ) {
    const get_id = (
      value: LibianCrawlerCleanAndMergeUtil.MediaContentMerged
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
        content_text_timeline_count: content_text_timeline_count.toString(),
        context_text_latest_str_length:
          context_text_latest_str_length.toString(),
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
          context_text_latest?.split("\n").length?.toString() ?? null,
        last_crawl_time: Times.instant_to_date(value.last_crawl_time),
        authors_names,
        from_search_question_texts,
        literature_first_journal: literature_first?.journal ?? null,
        literature_first_doi: literature_first?.doi ?? null,
        literature_first_category: literature_first?.category ?? null,
        literature_first_level_of_evidence:
          literature_first?.level_of_evidence ?? null,
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
        return pg_dto_equal(value_to_dto, existed_dto);
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
      Parameters<typeof create_and_init_libian_srawler_database_scope>[0]
    >[0],
    values: LibianCrawlerCleanAndMergeUtil.ShopGoodMerged[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
    }
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
          ])
        ),
        create_time: Times.instant_to_date(value.create_time),
        update_time: Times.instant_to_date(value.update_time),
        search_from: [...value.search_from],
        good_images: value.good_images,
        good_first_image_url: Arrays.first_or_null(
          value.good_images
            .map((it) => it.url)
            .filter((url) => Strs.is_not_blank(url))
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
        return pg_dto_equal(value_to_dto, existed_dto);
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
      Parameters<typeof create_and_init_libian_srawler_database_scope>[0]
    >[0],
    values: ChatMessage[],
    options: {
      on_bar_text: (text: string) => Promise<void>;
    }
  ) {
    const get_id = (value: ChatMessage) => {
      return `${value.platform}___${value.platform_duplicate_id}`;
    };
    const table = `libian_crawler_cleaned.chat_message`;
    const get_dto_for_insert_or_update = (value: (typeof values)[number]) => {
      const create_time = Times.instant_to_date(value.create_time);
      const create_date = Times.instant_to_date(value.create_time);
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
        return pg_dto_equal(value_to_dto, existed_dto);
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

async function _main() {
  await ProcessBar.create_scope({ title: "LibianCrawler" }, async (bars) => {
    console.debug("try connect to cleaned db");
    // deno-lint-ignore require-await
    await create_and_init_libian_srawler_database_scope(async (db) => {
      console.debug("success connect to cleaned db", db);
    });

    const reader =
      LibianCrawlerCleanAndMergeUtil.read_garbage_for_libian_crawler();

    const reducer_for_media_content =
      LibianCrawlerCleanAndMergeUtil.create_reducer_for_media_content();
    const reducer_for_shop_good =
      LibianCrawlerCleanAndMergeUtil.create_reducer_for_shop_good();
    const reducer_for_chat_message =
      LibianCrawlerCleanAndMergeUtil.create_reducer_for_chat_message();

    const render_param: Parameters<typeof bars.render>[0] = [
      { completed: 0, total: 1, text: "Reading garbage" },
      {
        completed: 0,
        total: 1,
        text: "Wait to insert or update to remote database",
      },
    ];

    for await (const garbages of read_LibianCrawlerGarbage({
      on_bar: async (it) => {
        render_param[0].completed = it.completed;
        render_param[0].total = it.total;
        await bars.render(render_param);
      },
    })) {
      for (const garbage of garbages) {
        const item = await reader.next(garbage);
        if (
          typeof item.value === "object" &&
          "title" in item.value &&
          "content_link_url" in item.value
        ) {
          await reducer_for_media_content.next(item.value);
        } else if (
          typeof item.value === "object" &&
          "good_name" in item.value &&
          "shop_name" in item.value
        ) {
          await reducer_for_shop_good.next(item.value);
        } else if (
          typeof item.value === "object" &&
          "__mode__" in item.value &&
          "chat_message" === item.value.__mode__
        ) {
          await reducer_for_chat_message.next(item.value);
        }
      }
    }

    render_param[0].text = "Finish read garbage";

    function create_context_of_insert_or_update_reduced_data<
      Prev,
      Cur
    >(params: {
      tag_text: string;
      reducer: AsyncGenerator<
        undefined,
        readonly [Set<string>, ICache<string, Prev>] | undefined,
        Cur | "stop"
      >;
      insert_or_update: LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>;
    }) {
      const { tag_text, reducer, insert_or_update } = params;
      return {
        tag_text,
        stop: async () => {
          const reduced_result = await reducer.next("stop");
          if (!reduced_result.done || !reduced_result.value) {
            throw new Error("should return");
          }
          const [all_key, cache] = reduced_result.value;
          return {
            all_key,
            cache,
          };
        },
        insert_or_update: async (
          db: Parameters<
            LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
          >[0],
          values: Parameters<
            LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
          >[1],
          options: Parameters<
            LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
          >[2]
        ) => {
          try {
            return await insert_or_update(db, values, options);
          } catch (err) {
            throw new Error(`Insert or update failed`, {
              cause: err,
            });
          }
        },
      };
    }

    const ctx_list = await Promise.all(
      (
        [
          create_context_of_insert_or_update_reduced_data({
            tag_text: "MediaContent",
            reducer: reducer_for_media_content,
            insert_or_update:
              LibianCrawlerCleanAndMergeUtil.insert_or_update_media_content,
          }),
          create_context_of_insert_or_update_reduced_data({
            tag_text: "ShopGood",
            reducer: reducer_for_shop_good,
            insert_or_update:
              LibianCrawlerCleanAndMergeUtil.insert_or_update_shop_good,
          }),
          create_context_of_insert_or_update_reduced_data({
            tag_text: "ChatMessage",
            reducer: reducer_for_chat_message,
            insert_or_update:
              LibianCrawlerCleanAndMergeUtil.insert_or_update_chat_message,
          }),
        ] as const
      ).map(async (ctx) => {
        const { all_key, cache } = await ctx.stop();
        return {
          ctx,
          all_key,
          cache,
        };
      })
    );
    const total = ctx_list.reduce((prev, cur) => prev + cur.all_key.size, 0);
    await create_and_init_libian_srawler_database_scope(async (db) => {
      let completed_offset = 0;
      for (const { ctx, all_key, cache } of ctx_list) {
        for (const { start, end, sliced } of Streams.split_array_use_batch_size(
          100,
          [...all_key]
        )) {
          const values = await Promise.all(
            Mappings.object_entries(cache.get_batch(new Set(sliced))).map((e) =>
              Promise.resolve(e[1])
            )
          );
          const on_bar_text = async (text: string) => {
            render_param[1].completed = completed_offset + end;
            render_param[1].total = total;
            render_param[1].text = `${ctx.tag_text} Batch(${start}~${end}) ${text}`;
            await bars.render(render_param);
          };
          // 只要不乱改，这的类型就没问题。
          // 我只想偷懒。
          // deno-lint-ignore no-explicit-any
          await ctx.insert_or_update(db, values as any, {
            on_bar_text,
          });
        }
        completed_offset += all_key.size;
      }
    });
  });
}

// ```
// deno run --allow-env=PG* general_data_process/libian_crawler/clean_and_merge.ts
// ```
if (import.meta.main) {
  try {
    await _main();
  } finally {
    await Jsonatas.shutdown_all_workers();
  }
}
