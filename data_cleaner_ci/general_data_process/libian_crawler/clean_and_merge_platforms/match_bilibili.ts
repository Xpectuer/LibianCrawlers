import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  chain,
  DataClean,
  DataMerge,
  Errors,
  is_nullish,
  Nums,
  Streams,
  Strs,
  Times,
} from "../../../util.ts";
import {
  MediaContent,
  MediaContentAuthor,
  MediaContentTag,
  PlatformEnum,
} from "../../media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

// export const match_bilibili_api_search_result: LibianCrawlerGarbageCleaner<
//   MediaContent
// > = {
//   match: async function* (
//     garbage: LibianCrawlerGarbage,
//   ) {
//     const smart_crawl = garbage.obj;
//     if (!("template_parse_html_tree" in smart_crawl)) {
//       return;
//     }
//     if (
//       "group__bilibili_search_result__lib_bilibili-api-python" in garbage &&
//       garbage["group__bilibili_search_result__lib_bilibili-api-python"]
//     ) {
//       const { g_content, g_search_key } =
//         garbage["group__bilibili_search_result__lib_bilibili-api-python"];
//       const g_create_time: string =
//         garbage["group__bilibili_search_result__lib_bilibili-api-python"]
//           .g_create_time;
//       const search_result_list = g_content.result.obj.result;
//       for (const search_result of search_result_list) {
//         const {
//           aid,
//           arcurl,
//           bvid,
//           title,
//           description,
//           author,
//           upic,
//           pic,
//           danmaku,
//           tag,
//           review,
//           pubdate,
//           senddate,
//           video_review,
//           play,
//           favorites,
//           rank_score,
//           mid,
//           like,
//           duration,
//         } = search_result;
//         const duration_sec = duration.trim() === ""
//           ? null
//           : Times.parse_duration_sec(duration);
//         if (typeof duration_sec === "string") {
//           console.warn("Parse duration failed !", [
//             duration,
//             `Reason: ${duration_sec}`,
//           ]);
//         }
//         let content_link_url: DataClean.HttpUrl;
//         let platform_duplicate_id: string;
//         if (bvid.trim() === "") {
//           const _type = search_result.type;
//           if (_type.trim() === "" || aid === 0) {
//             Errors.throw_and_format("Missing bvid", search_result);
//           } else {
//             platform_duplicate_id = `${_type}__${aid}`;
//             if (_type === "ketang") {
//               content_link_url = DataClean.url_use_https_noempty(arcurl);
//             } else {
//               Errors.throw_and_format(
//                 "Missing bvid and invalid type",
//                 search_result,
//               );
//             }
//           }
//         } else {
//           content_link_url = `https://www.bilibili.com/video/${bvid}`;
//           platform_duplicate_id = `bvid__${bvid}`;
//         }
//         const res: MediaContent = {
//           last_crawl_time: Times.parse_text_to_instant(g_create_time),
//           title,
//           content_text_summary: description,
//           content_text_detail: description,
//           content_link_url,
//           authors: [
//             {
//               nickname: author,
//               avater_url: DataClean.url_use_https_emptyable(upic),
//               platform_user_id: mid,
//               home_link_url: `https://space.bilibili.com/${mid}`,
//             },
//           ],
//           platform: PlatformEnum.哔哩哔哩,
//           platform_duplicate_id,
//           platform_rank_score: DataClean.nan_infinity_to_null(rank_score),
//           count_read: DataClean.cast_and_must_be_natural_number(
//             Math.max(play, like, review, video_review, favorites),
//           ),
//           count_like: DataClean.cast_and_must_be_natural_number(like),
//           count_star: DataClean.cast_and_must_be_natural_number(favorites),
//           video_total_count_danmaku: DataClean
//             .cast_and_must_be_natural_number(danmaku),
//           video_total_duration_sec: DataClean.nan_infinity_to_null(
//             duration_sec,
//           ),
//           tags: [
//             {
//               text: search_result.typename,
//             },
//             ...tag.split(",").map((it) => ({ text: it.trim() })),
//           ],
//           create_time: Times.unix_to_time(pubdate),
//           update_time: Times.unix_to_time(senddate),
//           cover_url: DataClean.url_use_https_noempty(pic),
//           videos: null,
//           from_search_context: [
//             {
//               question: g_search_key,
//             },
//           ],
//           ip_location: null,
//           count_share: null,
//           count_comment: null,
//           literatures: null,
//           language: null,
//         };
//         yield res;
//       }
//     }
//   },
// };

function cast_tag(it: {
  tag_id: number;
  tag_name: string;
  music_id: string;
  tag_type: "old_channel" | "bgm";
  jump_url: string;
}) {
  return {
    text: it.tag_type === "bgm" ? `BGM:${it.tag_name}` : it.tag_name,
    url: DataClean.url_use_https_emptyable(it.jump_url) ??
      undefined,
  };
}

type BilibiliSubtitleItem = {
  from: number;
  to: number;
  text: string;
};

type BilibiliAiConclusionItem = {
  start_time: number;
  title: string;
  children: BilibiliAiConclusionItem[];
};

type BilibiliVideoSnapshotItem = {
  start_time: number;
  img_element: `<img ${string}>`;
};

type BilibiliAiConclusionDurationItem =
  & Omit<BilibiliAiConclusionItem, "children">
  & { child_level: number };

type BilibiliVideoMarkdownDurationLine = DataMerge.DurationLine<
  | BilibiliSubtitleItem
  | BilibiliAiConclusionDurationItem
  | BilibiliVideoSnapshotItem
>;

function extract_bilibili_video_markdown(param: {
  md_min_title_level: 1 | 2 | 3 | 4 | 5 | 6;
  subtitles: BilibiliSubtitleItem[];
  ai_conclusion: BilibiliAiConclusionItem[];
  video_snapshot: null | {
    images: string[];
    img_x_len: number;
    img_y_len: number;
    img_x_size: number;
    img_y_size: number;
    index: number[];
  };
}) {
  const { md_min_title_level, subtitles, ai_conclusion, video_snapshot } =
    param;
  const bilibili_ai_conclusion_item_to_duration_line = (
    it: BilibiliAiConclusionItem,
    child_level: number,
  ) => {
    const arr: DataMerge.DurationLine<BilibiliAiConclusionDurationItem> = [];
    arr.push({
      time: it.start_time,
      value: {
        start_time: it.start_time,
        title: it.title,
        child_level,
      },
    });
    for (const child of it.children) {
      arr.push(
        ...bilibili_ai_conclusion_item_to_duration_line(child, child_level + 1),
      );
    }

    return arr;
  };

  let snapshots: DataMerge.DurationLine<BilibiliVideoSnapshotItem> = [];
  if (video_snapshot !== null) {
    const { img_x_len, img_y_len, img_x_size, img_y_size, images } =
      video_snapshot;
    snapshots = video_snapshot.index.map((it, idx) => {
      const img_idx = Math.floor(idx / (img_x_len * img_y_len));
      const x_pos = (idx % img_x_len) *
        img_x_size;
      const y_pos =
        Math.floor((idx - img_idx * img_x_len * img_y_len) / img_x_len) *
        img_y_size;

      return {
        time: it,
        value: {
          start_time: it,
          img_element: `<img src="${
            DataClean.url_use_https_noempty(images[img_idx])
          }" style="object-fit: none; object-position: -${x_pos}px -${y_pos}px;width: ${img_x_size}px;height: ${img_y_size}px;" alt="video screenshot at ${
            Times.duration_to_text(it)
          }">` as const,
        },
      };
    });
  }

  const timeline: BilibiliVideoMarkdownDurationLine = [
    ...subtitles.map((it) => {
      return {
        time: it.from,
        value: it,
      };
    }),
    ...ai_conclusion.flatMap((it) => {
      return bilibili_ai_conclusion_item_to_duration_line(it, 0);
    }),
    ...(video_snapshot !== null ? snapshots : []),
  ];
  timeline.sort((a, b) => a.time - b.time);
  let before_is_subtitle = false;
  return timeline.flatMap((it) => {
    if ("img_element" in it.value) {
      try {
        return [
          ...(before_is_subtitle ? [""] : []),
          "",
          it.value.img_element,
          "",
        ];
      } finally {
        before_is_subtitle = false;
      }
    } else if ("from" in it.value) {
      try {
        return [
          before_is_subtitle ? ">" : "",
          `> ${Times.duration_to_text(it.value.from)} - ${
            Times.duration_to_text(it.value.to)
          } : ${it.value.text}`,
        ];
      } finally {
        before_is_subtitle = true;
      }
    } else {
      try {
        const level = md_min_title_level + it.value.child_level;
        let ai_cons_title = "";
        if (level <= 6) {
          for (let i = 0; i < level; i++) {
            ai_cons_title += "#";
          }
          ai_cons_title += " " + it.value.title;
        } else {
          ai_cons_title += `**${it.value.title}**`;
        }
        return [
          ...(before_is_subtitle ? [""] : []),
          ai_cons_title,
          // "",
          // `> ${Times.duration_to_text(it.time)} : 由 bilibili 官方提供 AI 总结`,
          "",
        ];
      } finally {
        before_is_subtitle = false;
      }
    }
  }).join("\n");
}

// Copy from:
// https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/misc/bvid_desc.md
const XOR_CODE = 23442827791579n;
const MASK_CODE = 2251799813685247n;
const MAX_AID = 1n << 51n;
const BASE = 58n;
const data = "FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf";

export function aid2bvid(aid: number) {
  const bytes = ["B", "V", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
  let bvIndex = bytes.length - 1;
  let tmp = (MAX_AID | BigInt(aid)) ^ XOR_CODE;
  while (tmp > 0) {
    bytes[bvIndex] = data[Number(tmp % BigInt(BASE))];
    tmp = tmp / BASE;
    bvIndex -= 1;
  }
  [bytes[3], bytes[9]] = [bytes[9], bytes[3]];
  [bytes[4], bytes[7]] = [bytes[7], bytes[4]];
  return bytes.join("");
}

export function bvid2aid(bvid: string) {
  const bvidArr = Array.from(bvid);
  [bvidArr[3], bvidArr[9]] = [bvidArr[9], bvidArr[3]];
  [bvidArr[4], bvidArr[7]] = [bvidArr[7], bvidArr[4]];
  bvidArr.splice(0, 3);
  const tmp = bvidArr.reduce(
    (pre, bvidChar) => pre * BASE + BigInt(data.indexOf(bvidChar)),
    0n,
  );
  return Number((tmp & MASK_CODE) ^ XOR_CODE);
}

export const match_bilibili_video: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    // const smart_crawl = garbage.obj;
    if (
      "group__bilibili_api_python_video_v2__" in garbage &&
      garbage["group__bilibili_api_python_video_v2__"]
    ) {
      const { g_type, g_content, g_search_key, g_create_time } =
        garbage["group__bilibili_api_python_video_v2__"];
      if (g_type !== "bilibili_api_python_video_v2") {
        return;
      }
      const { login_res, no_login_res } = g_content.result;
      const { video_info: video_info_no_login, video_cid_pages } = no_login_res;

      // 处理本视频详情信息
      try {
        const {
          // video_info: video_info_login,
          video_cid_pages_only_query_login_api,
        } = login_res;
        const dv = video_info_no_login.detail.View;
        const { stat } = dv;
        const author_card = video_info_no_login.detail.Card.card;

        const _get_tags = (other: ReturnType<typeof cast_tag>[]) => {
          return Streams.deduplicate<MediaContentTag>(
            [
              ...video_info_no_login.detail.Tags.map((it) => cast_tag(it)),
              ...other,
              ...[
                dv.tname,
                dv.tname_v2,
                ...(dv.honor_reply.honor?.map((it) => it.desc) ?? []),
                ...(video_info_no_login.detail.participle ?? []),
              ].filter((it) => DataClean.is_not_blank_and_valid(it)).map(
                (it) => ({
                  text: it,
                }),
              ),
            ],
            (a, b) => a.text === b.text,
          );
        };

        const _get_target_video = (
          param: null | {
            only_one_page: boolean;
            i: number;
            cid: number;
            tags: ReturnType<typeof cast_tag>[];
            page_part: string;
            page_duration: number;
            page_ctime: Temporal.Instant | null;
            language: string[];
            content_text_detail: string | null;
            page_first_frame: DataClean.HttpUrl | null;
          },
        ) => {
          const {
            i,
            only_one_page,
            cid,
            tags,
            page_part,
            page_duration,
            page_ctime,
            page_first_frame,
            language,
            content_text_detail,
          } = param ?? {};
          const not_part = is_nullish(i) || i <= 0 || only_one_page;
          let langs: null | typeof language = (language ?? []).filter(
            DataClean.is_not_blank_and_valid,
          );
          langs = Streams.deduplicate(langs);
          if (langs.length <= 0) {
            langs = null;
          }
          const times: [
            (Temporal.Instant | null),
            ...(Temporal.Instant | null)[],
          ] = [
            Times.unix_to_time(dv.pubdate),
            Times.unix_to_time(dv.ctime),
            is_nullish(page_ctime) ? null : page_ctime,
          ];
          const staff = video_info_no_login.info.staff;
          const owner = video_info_no_login.info.owner;
          const target_video: MediaContent = {
            last_crawl_time: Times.parse_text_to_instant(g_create_time),
            title: not_part ? dv.title : `${dv.title} P${i + 1} ${page_part}`,
            content_text_summary: dv.desc,
            content_text_detail:
              DataClean.is_not_blank_and_valid(content_text_detail)
                ? content_text_detail
                : null,
            content_link_url: not_part
              ? `https://www.bilibili.com/${dv.bvid}`
              : `https://www.bilibili.com/${dv.bvid}?p=${i + 1}`,
            authors: Streams.deduplicate(
              [
                ...(
                  is_nullish(staff) || staff.length <= 0
                    ? []
                    : staff.map((it) => {
                      const res: MediaContentAuthor = {
                        nickname: it.name,
                        avater_url: DataClean.url_use_https_emptyable(it.face),
                        platform_user_id: it.mid,
                        home_link_url: `https://space.bilibili.com/${it.mid}`,
                      };
                      return res;
                    })
                ),
                {
                  nickname: author_card.name,
                  avater_url: DataClean.url_use_https_emptyable(
                    author_card.face,
                  ),
                  platform_user_id: author_card.mid,
                  home_link_url:
                    `https://space.bilibili.com/${author_card.mid}`,
                },
                {
                  nickname: owner.name,
                  avater_url: DataClean.url_use_https_emptyable(owner.face),
                  platform_user_id: owner.mid,
                  home_link_url: `https://space.bilibili.com/${owner.mid}`,
                },
              ],
              (a, b) => a.platform_user_id === b.platform_user_id,
            ),
            platform: PlatformEnum.哔哩哔哩,
            platform_duplicate_id: is_nullish(cid)
              ? `bvid__${dv.bvid}`
              : `bvid__${dv.bvid}___cid__${cid}`,
            platform_rank_score: null, //DataClean.nan_infinity_to_null(rank_score),
            count_read: DataClean.cast_and_must_be_natural_number(stat.view),
            count_like: DataClean.cast_and_must_be_natural_number(stat.like),
            count_star: DataClean.cast_and_must_be_natural_number(
              stat.favorite ?? 0,
            ),
            count_share: null,
            count_comment: null,
            video_total_count_danmaku: DataClean
              .cast_and_must_be_natural_number(
                stat.danmaku,
              ),
            video_total_duration_sec: not_part
              ? DataClean.nan_infinity_to_null(
                dv.duration,
              )
              : DataClean.nan_infinity_to_null(
                page_duration,
              ),
            tags: _get_tags([
              ...(is_nullish(tags) ? [] : tags),
            ]),
            create_time: Nums.take_extreme_value<typeof times>("min", times),
            update_time: Nums.take_extreme_value<typeof times>("max", times),
            cover_url: not_part
              ? DataClean.url_use_https_noempty(dv.pic)
              : Strs.is_not_blank(page_first_frame)
              ? page_first_frame
              : DataClean.url_use_https_noempty(dv.pic),
            videos: null,
            from_search_context: [
              ...(DataClean.is_not_blank_and_valid(g_search_key)
                ? [
                  {
                    question: g_search_key,
                  },
                ]
                : []),
            ],
            ip_location: null,
            literatures: null,
            language: langs,
          };
          return target_video;
        };

        if (video_cid_pages.length <= 0) {
          yield _get_target_video(null);
        } else {
          for (let i = 0; i < video_cid_pages.length; i++) {
            const page = video_cid_pages[i];
            const page2 = video_cid_pages_only_query_login_api.find((it) =>
              it.cid === page.cid
            );
            const { video_snapshot_wrap } = page.attrs;
            const { img_x_len, img_y_len, img_x_size, img_y_size } =
              video_snapshot_wrap;
            const language: string[] = [];
            let content_text_detail: string = "";
            const video_snapshot_images = video_snapshot_wrap.image;
            if (page2) {
              // content_text_detail = detail.desc;
              const { ai_conclusion, subtitle_wrap } = page2.attrs;
              if (
                DataClean.is_not_blank_and_valid(
                  ai_conclusion.model_result.summary,
                )
              ) {
                content_text_detail += "\n\n## AI总结:\n\n" +
                  ai_conclusion.model_result.summary;
              }
              content_text_detail += "\n\n## 正文摘要\n\n" +
                extract_bilibili_video_markdown({
                  md_min_title_level: 3,
                  subtitles: ai_conclusion.model_result.subtitle.length > 0
                    ? ai_conclusion.model_result.subtitle.flatMap((s) => {
                      return s.part_subtitle.map((it) => {
                        return {
                          from: it.start_timestamp,
                          to: it.end_timestamp,
                          text: it.content,
                        };
                      });
                    })
                    : subtitle_wrap.downloaded.length > 0
                    ? subtitle_wrap.downloaded.flatMap((d) =>
                      d.body.map((it) => ({
                        from: it.from,
                        to: it.to,
                        text: it.content,
                      }))
                    )
                    : [],
                  ai_conclusion: ai_conclusion.model_result.outline.map((o) => {
                    return {
                      start_time: o.timestamp,
                      title: o.title,
                      children: o.part_outline.map((c) => {
                        return {
                          start_time: c.timestamp,
                          title: c.content,
                          children: [],
                        };
                      }),
                    };
                  }),
                  video_snapshot: {
                    images: video_snapshot_images,
                    img_x_len,
                    img_y_len,
                    img_x_size,
                    img_y_size,
                    index: page.attrs.video_snapshot_wrap.index,
                  },
                });
            }
            if (DataClean.is_not_blank_and_valid(content_text_detail)) {
              content_text_detail = dv.desc + "\n\n---" +
                content_text_detail;
            }
            yield _get_target_video({
              only_one_page: video_cid_pages.length === 1,
              i,
              cid: page.cid,
              tags: [
                ...page.attrs.tags.map((it) => cast_tag(it)),
              ],
              page_part: page.page.part,
              page_duration: page.page.duration,
              page_ctime: page.page.ctime
                ? Times.unix_to_time(page.page.ctime)
                : null,
              page_first_frame: Strs.is_not_blank(page.page.first_frame)
                ? DataClean.url_use_https_noempty(page.page.first_frame)
                : null,
              language,
              content_text_detail:
                DataClean.is_not_blank_and_valid(content_text_detail)
                  ? content_text_detail
                  : null,
            });
          }
        }
      } finally {
        // 局部变量作用域结束
      }

      // 处理相关视频信息
      try {
        for (const related of video_info_no_login.detail.Related) {
          const _get_tags = (other: ReturnType<typeof cast_tag>[]) => {
            return Streams.deduplicate<MediaContentTag>(
              [
                ...other,
                ...[
                  related.tname,
                  related.tnamev2,
                  related.pid_name_v2,
                ].filter((it) => DataClean.is_not_blank_and_valid(it)).map(
                  (it) => ({
                    text: it,
                  }),
                ),
              ],
              (a, b) => a.text === b.text,
            );
          };

          const {
            bvid,
            title,
            desc,
            owner,
            cid,
            stat,
            duration,
            ctime,
            pubdate,
            first_frame,
            pic,
            pub_location,
          } = related;
          const times: [
            (Temporal.Instant | null),
            ...(Temporal.Instant | null)[],
          ] = [
            Times.unix_to_time(pubdate),
            Times.unix_to_time(ctime),
          ];
          const related_video: MediaContent = {
            last_crawl_time: Times.parse_text_to_instant(g_create_time),
            title,
            content_text_summary: desc,
            content_text_detail: null,
            content_link_url: `https://www.bilibili.com/${bvid}`,
            authors: Streams.deduplicate(
              [
                {
                  nickname: owner.name,
                  avater_url: DataClean.url_use_https_emptyable(owner.face),
                  platform_user_id: owner.mid,
                  home_link_url: `https://space.bilibili.com/${owner.mid}`,
                },
              ],
              (a, b) => a.platform_user_id === b.platform_user_id,
            ),
            platform: PlatformEnum.哔哩哔哩,
            platform_duplicate_id: is_nullish(cid) || cid <= 0
              ? `bvid__${bvid}`
              : `bvid__${bvid}___cid__${cid}`,
            platform_rank_score: null,
            count_read: DataClean.cast_and_must_be_natural_number(stat.view),
            count_like: DataClean.cast_and_must_be_natural_number(stat.like),
            count_star: DataClean.cast_and_must_be_natural_number(
              stat.favorite ?? 0,
            ),
            count_share: null,
            count_comment: null,
            video_total_count_danmaku: DataClean
              .cast_and_must_be_natural_number(
                stat.danmaku,
              ),
            video_total_duration_sec: DataClean.nan_infinity_to_null(
              duration,
            ),
            tags: _get_tags([]),
            create_time: Nums.take_extreme_value<typeof times>("min", times),
            update_time: Nums.take_extreme_value<typeof times>("max", times),
            cover_url: Strs.is_not_blank(pic)
              ? DataClean.url_use_https_noempty(pic)
              : Strs.is_not_blank(first_frame)
              ? DataClean.url_use_https_noempty(first_frame)
              : null,
            videos: null,
            from_search_context: [],
            ip_location: DataClean.is_not_blank_and_valid(pub_location)
              ? pub_location
              : null,
            literatures: null,
            language: null,
          };
          yield related_video;
        }
      } finally {
        // 局部变量作用域结束
      }
    }
  },
};
