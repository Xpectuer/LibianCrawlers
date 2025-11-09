import { MediaContent, MediaVideo, PlatformEnum } from "../common/media.ts";
import { Kysely } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { DB } from "./db.d.ts";
import {
  DataClean,
  Errors,
  is_nullish,
  Nums,
  Strs,
  Times,
} from "../../util.ts";
import {
  baidu_tieba_platform_duplicate_id,
  douyin_comment_platform_duplicate_id,
  douyin_platform_duplicate_id,
  kuaishou_comment_platform_duplicate_id,
  kuaishou_platform_duplicate_id,
  zhihu_comment_platform_duplicate_id,
  zhihu_platform_duplicate_id,
} from "../libian_crawler/clean_and_merge_platforms/util.ts";
import { MediaCrawlerYield, MediaCrawlerYieldMediaContent } from "./util.ts";
import { createClient } from "@libsql/client";

export async function* read_media_crawler_from_sqlite(param: {
  libsql_url: string;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  console.debug("[read_media_crawler_from_sqlite] Start", param);
  const { libsql_url } = param;
  const db = new Kysely<DB>({
    dialect: new LibsqlDialect({
      client: createClient({
        url: libsql_url,
        intMode: "string",
        // deno-lint-ignore no-explicit-any
      }) as any,
    }),
  });

  for (
    const gen of [
      read_zhihu_content,
      read_zhihu_comment,
      read_douyin_aweme,
      read_douyin_aweme_comment,
      read_kuaishou_video,
      read_kuaishou_video_comment,
      read_baidu_tieba_note,
      read_baidu_tieba_comment,
    ] as const
  ) {
    console.debug(`[read_media_crawler_from_sqlite] start generator`, { gen });
    yield* gen({ db });
    console.debug(`[read_media_crawler_from_sqlite] finish generator`, { gen });
  }

  console.debug("[read_media_crawler_from_sqlite] Finish", param);
}

async function* read_zhihu_content(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;
  for await (
    const row of await db.selectFrom("zhihu_content")
      .selectAll()
      .execute()
  ) {
    // const k: keyof typeof row = null as any;
    if (!DataClean.is_not_blank_and_valid(row.title)) {
      continue;
    }
    const content_link_url = DataClean.url_use_https_emptyable(row.content_url);
    if (
      is_nullish(content_link_url) ||
      !DataClean.is_not_blank_and_valid(row.content_url)
    ) {
      console.warn(
        "Invalid media crawler row, content_link_url invalid",
        { row },
      );
      continue;
    }
    const result_pdid = zhihu_platform_duplicate_id({
      content_type: row.content_type,
      content_id: row.content_id,
      question_id: row.question_id,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_zhihu_platform_duplicate_id: result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text_summary = DataClean.is_not_blank_and_valid(row.desc)
      ? row.desc
      : null;

    let content_text_detail = DataClean.is_not_blank_and_valid(row.content_text)
      ? row.content_text
      : null;
    if (
      typeof content_text_summary === "string" &&
      typeof content_text_detail === "string" &&
      !content_text_detail.startsWith(content_text_summary)
    ) {
      content_text_detail = content_text_summary + "\n\n" + content_text_detail;
    }
    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const created_time: string | null = to_str(row.created_time);
    const updated_time: string | null = to_str(row.updated_time);
    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: row.title,
      content_text_summary,
      content_text_detail,
      content_link_url,
      authors: DataClean.is_not_blank_and_valid(row.user_id) &&
          DataClean.is_not_blank_and_valid(row.user_nickname)
        ? [
          {
            nickname: row.user_nickname,
            avater_url: DataClean.url_use_https_emptyable(row.user_avatar),
            platform_user_id: row.user_id,
            home_link_url: DataClean.url_use_https_emptyable(row.user_link),
          },
        ]
        : [],
      platform: PlatformEnum.知乎,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like:
        is_nullish(row.voteup_count) || Nums.is_invalid(row.voteup_count)
          ? null
          : DataClean.cast_and_must_be_natural_number(row.voteup_count),
      count_star: null,
      count_share: null,
      count_comment:
        is_nullish(row.comment_count) || Nums.is_invalid(row.comment_count)
          ? null
          : DataClean.cast_and_must_be_natural_number(row.comment_count),
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [],
      create_time: DataClean.is_not_blank_and_valid(created_time)
        ? Times.parse_text_to_instant(created_time)
        : null,
      update_time: DataClean.is_not_blank_and_valid(updated_time)
        ? Times.parse_text_to_instant(updated_time)
        : null,
      cover_url: null,
      videos: null,
      from_search_context: [
        ...(DataClean.is_not_blank_and_valid(row.source_keyword)
          ? [
            {
              question: row.source_keyword,
            },
          ]
          : []),
      ],
      ip_location: null,
      literatures: null,
      language: null,
    };
    yield [_res];
  }
}

async function* read_zhihu_comment(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;
  for await (
    const row of await db.selectFrom("zhihu_comment")
      .selectAll()
      .execute()
  ) {
    if (
      !DataClean.is_not_blank_and_valid(row.comment_id) ||
      !DataClean.is_not_blank_and_valid(row.content)
    ) {
      continue;
    }

    const result_pdid = zhihu_comment_platform_duplicate_id({
      content_id: row.content_id,
      comment_id: row.comment_id,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text = row.content;

    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const create_time: string | null = to_str(row.publish_time);
    // const updated_time: string | null = to_str(row.updated_time);

    const parent_comment_id =
      DataClean.is_not_blank_and_valid(row.parent_comment_id)
        ? row.parent_comment_id
        : null;
    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: content_text,
      content_text_summary: content_text,
      content_text_detail: null,
      content_link_url: "",
      authors: DataClean.is_not_blank_and_valid(row.user_id) &&
          DataClean.is_not_blank_and_valid(row.user_nickname)
        ? [
          {
            nickname: row.user_nickname,
            avater_url: DataClean.url_use_https_emptyable(row.user_avatar),
            platform_user_id: row.user_id,
            home_link_url: DataClean.url_use_https_emptyable(row.user_link),
          },
        ]
        : [],
      platform: PlatformEnum.知乎,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like: is_nullish(row.like_count)
        ? null
        : Nums.to_bigint(DataClean.parse_number(row.like_count)),
      count_star: null,
      count_share: null,
      count_comment: null,
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [],
      create_time: DataClean.is_not_blank_and_valid(create_time)
        ? Times.parse_text_to_instant(create_time)
        : null,
      update_time: null,
      cover_url: null,
      videos: null,
      from_search_context: [],
      ip_location: DataClean.is_not_blank_and_valid(row.ip_location)
        ? row.ip_location
        : null,
      literatures: null,
      language: null,
      comment: {
        level: parent_comment_id ? 1 : 2,
        count_sub: is_nullish(row.sub_comment_count)
          ? null
          : Nums.is_int(row.sub_comment_count)
          ? DataClean.parse_number(row.sub_comment_count)
          : null,
        parent_id: parent_comment_id,
      },
    };
    yield [_res];
  }
}

async function* read_douyin_aweme(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;
  for await (
    const row of await db.selectFrom("douyin_aweme")
      .selectAll()
      .execute()
  ) {
    // const k: keyof typeof row = null as any;
    if (!DataClean.is_not_blank_and_valid(row.title)) {
      continue;
    }
    const content_link_url = DataClean.url_use_https_emptyable(row.aweme_url);
    if (
      is_nullish(content_link_url) ||
      !DataClean.is_not_blank_and_valid(row.aweme_url)
    ) {
      console.warn(
        "Invalid media crawler row , content_link_url invalid",
        { row },
      );
      continue;
    }
    const result_pdid = douyin_platform_duplicate_id({
      aweme_id: row.aweme_id,
      aweme_type: row.aweme_type,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text_summary = DataClean.is_not_blank_and_valid(row.desc)
      ? row.desc
      : null;

    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const created_time: string | null = to_str(row.create_time);
    // const updated_time: string | null = to_str(row.updated_time);
    const download_urls: MediaVideo["download_urls"] = [
      ...(DataClean.is_not_blank_and_valid(row.video_download_url)
        ? [
          {
            is_master: false,
            url: DataClean.url_use_https_noempty(
              row.video_download_url,
            ),
            key: "master",
            is_music: false,
          },
        ]
        : []),
      ...(DataClean.is_not_blank_and_valid(row.music_download_url)
        ? [
          {
            is_master: false,
            url: DataClean.url_use_https_noempty(
              row.music_download_url,
            ),
            key: "music",
            is_music: true,
          },
        ]
        : []),
      ...(DataClean.is_not_blank_and_valid(row.note_download_url)
        ? [
          {
            is_master: false,
            url: DataClean.url_use_https_noempty(
              row.note_download_url,
            ),
            key: "note",
            is_music: false,
          },
        ]
        : []),
    ];
    if (download_urls.length > 0) {
      download_urls[0].is_master = true;
    }

    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: row.title,
      content_text_summary,
      content_text_detail: null,
      content_link_url,
      authors: DataClean.is_not_blank_and_valid(row.user_id) &&
          DataClean.is_not_blank_and_valid(row.nickname)
        ? [
          {
            nickname: row.nickname,
            avater_url: DataClean.url_use_https_emptyable(row.avatar),
            platform_user_id: row.user_id,
            home_link_url: `https://www.douyin.com/user/${row.sec_uid}`,
          },
        ]
        : [],
      platform: PlatformEnum.抖音,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like: is_nullish(row.liked_count)
        ? null
        : Nums.to_bigint(DataClean.parse_number(row.liked_count)),
      count_star: is_nullish(row.collected_count)
        ? null
        : Nums.to_bigint(DataClean.parse_number(row.collected_count)),
      count_share: is_nullish(row.share_count)
        ? null
        : Nums.to_bigint(DataClean.parse_number(row.share_count)),
      count_comment: is_nullish(row.comment_count)
        ? null
        : Nums.to_bigint(DataClean.parse_number(row.comment_count)),
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [],
      create_time: DataClean.is_not_blank_and_valid(created_time)
        ? Times.parse_text_to_instant(created_time)
        : null,
      update_time: null,
      cover_url: DataClean.url_use_https_emptyable(row.cover_url),
      videos: [
        {
          count_play: null,
          count_review: null,
          count_danmaku: null,
          download_urls,
          duration_sec: null,
        },
      ],
      from_search_context: [
        ...(DataClean.is_not_blank_and_valid(row.source_keyword)
          ? [
            {
              question: row.source_keyword,
            },
          ]
          : []),
      ],
      ip_location: DataClean.is_not_blank_and_valid(row.ip_location)
        ? row.ip_location
        : null,
      literatures: null,
      language: null,
    };
    yield [_res];
  }
}

async function* read_douyin_aweme_comment(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;
  for await (
    const row of await db.selectFrom("douyin_aweme_comment")
      .selectAll()
      .execute()
  ) {
    // const k: keyof typeof row = null as any;
    if (
      !DataClean.is_not_blank_and_valid(row.content) ||
      !DataClean.is_not_blank_and_valid(row.aweme_id)
    ) {
      continue;
    }
    const content_link_url =
      `https://www.douyin.com/video/${row.aweme_id}` as const;

    const result_pdid = douyin_comment_platform_duplicate_id({
      aweme_id: row.aweme_id,
      comment_id: row.comment_id,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text = [
      row.content,
      row.pictures,
    ].filter((it) => DataClean.is_not_blank_and_valid(it)).join("\n\n");

    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const create_time: string | null = to_str(row.create_time);
    // const updated_time: string | null = to_str(row.updated_time);

    const parent_comment_id =
      DataClean.is_not_blank_and_valid(row.parent_comment_id)
        ? row.parent_comment_id
        : null;
    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: content_text,
      content_text_summary: content_text,
      content_text_detail: null,
      content_link_url,
      authors: DataClean.is_not_blank_and_valid(row.user_id) &&
          DataClean.is_not_blank_and_valid(row.nickname)
        ? [
          {
            nickname: row.nickname,
            avater_url: DataClean.url_use_https_emptyable(row.avatar),
            platform_user_id: row.user_id,
            home_link_url: `https://www.douyin.com/user/${row.sec_uid}`,
            other_ids: [
              row.short_user_id,
              row.user_unique_id,
            ].filter(DataClean.is_not_blank_and_valid),
          },
        ]
        : [],
      platform: PlatformEnum.抖音,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like: is_nullish(row.like_count)
        ? null
        : Nums.to_bigint(DataClean.parse_number(row.like_count)),
      count_star: null,
      count_share: null,
      count_comment: null,
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [],
      create_time: DataClean.is_not_blank_and_valid(create_time)
        ? Times.parse_text_to_instant(create_time)
        : null,
      update_time: null,
      cover_url: DataClean.url_use_https_emptyable(row.pictures),
      videos: null,
      from_search_context: [],
      ip_location: DataClean.is_not_blank_and_valid(row.ip_location)
        ? row.ip_location
        : null,
      literatures: null,
      language: null,
      comment: {
        level: parent_comment_id ? 1 : 2,
        count_sub: is_nullish(row.sub_comment_count)
          ? null
          : Nums.is_int(row.sub_comment_count)
          ? DataClean.parse_number(row.sub_comment_count)
          : null,
        parent_id: parent_comment_id,
      },
    };
    yield [_res];
  }
}

async function* read_kuaishou_video(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;
  for await (
    const row of await db.selectFrom("kuaishou_video")
      .selectAll()
      .execute()
  ) {
    // const k: keyof typeof row = null as any;
    if (!DataClean.is_not_blank_and_valid(row.title)) {
      continue;
    }
    const content_link_url = DataClean.url_use_https_emptyable(row.video_url);
    if (!DataClean.is_not_blank_and_valid(content_link_url)) {
      continue;
    }
    const result_pdid = kuaishou_platform_duplicate_id({
      video_id: row.video_id,
      video_type: row.video_type,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text_summary = DataClean.is_not_blank_and_valid(row.desc)
      ? row.desc
      : null;

    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const created_time: string | null = to_str(row.create_time);
    const download_urls: MediaVideo["download_urls"] = [
      ...(DataClean.is_not_blank_and_valid(row.video_play_url)
        ? [
          {
            is_master: true,
            url: DataClean.url_use_https_noempty(
              row.video_play_url,
            ),
            key: "master",
            is_music: false,
          },
        ]
        : []),
    ];
    const count_read = is_nullish(row.viewd_count)
      ? null
      : Nums.to_bigint(DataClean.parse_number(row.viewd_count));
    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: row.title,
      content_text_summary,
      content_text_detail: null,
      content_link_url,
      authors: DataClean.is_not_blank_and_valid(row.user_id) &&
          DataClean.is_not_blank_and_valid(row.nickname)
        ? [
          {
            nickname: row.nickname,
            avater_url: DataClean.url_use_https_emptyable(row.avatar),
            platform_user_id: row.user_id,
            home_link_url:
              `https://www.kuaishou.com/profile/${row.user_id}` as const,
          },
        ]
        : [],
      platform: PlatformEnum.快手,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read,
      count_like: is_nullish(row.liked_count)
        ? null
        : Nums.to_bigint(DataClean.parse_number(row.liked_count)),
      count_star: null,
      count_share: null,
      count_comment: null,
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [],
      create_time: DataClean.is_not_blank_and_valid(created_time)
        ? Times.parse_text_to_instant(created_time)
        : null,
      update_time: null,
      cover_url: DataClean.url_use_https_emptyable(row.video_cover_url),
      videos: [
        {
          count_play: count_read,
          count_review: null,
          count_danmaku: null,
          download_urls,
          duration_sec: null,
        },
      ],
      from_search_context: [
        ...(DataClean.is_not_blank_and_valid(row.source_keyword)
          ? [
            {
              question: row.source_keyword,
            },
          ]
          : []),
      ],
      ip_location: null,
      literatures: null,
      language: null,
    };
    yield [_res];
  }
}

async function* read_kuaishou_video_comment(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;

  for await (
    const row of await db.selectFrom("kuaishou_video_comment")
      .selectAll()
      .execute()
  ) {
    if (
      !DataClean.is_not_blank_and_valid(row.content) ||
      !DataClean.is_not_blank_and_valid(row.video_id)
    ) {
      continue;
    }
    const content_link_url =
      `https://www.kuaishou.com/short-video/${row.video_id}` as const;
    const result_pdid = kuaishou_comment_platform_duplicate_id({
      video_id: row.video_id,
      comment_id: row.comment_id,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text = row.content;

    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const create_time: string | null = to_str(row.create_time);
    // const updated_time: string | null = to_str(row.updated_time);

    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: content_text,
      content_text_summary: content_text,
      content_text_detail: null,
      content_link_url,
      authors: DataClean.is_not_blank_and_valid(row.user_id) &&
          DataClean.is_not_blank_and_valid(row.nickname)
        ? [
          {
            nickname: row.nickname,
            avater_url: DataClean.url_use_https_emptyable(row.avatar),
            platform_user_id: row.user_id,
            home_link_url:
              `https://www.kuaishou.com/profile/${row.user_id}` as const,
          },
        ]
        : [],
      platform: PlatformEnum.快手,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like: null,
      count_star: null,
      count_share: null,
      count_comment: null,
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [],
      create_time: DataClean.is_not_blank_and_valid(create_time)
        ? Times.parse_text_to_instant(create_time)
        : null,
      update_time: null,
      cover_url: null,
      videos: null,
      from_search_context: [],
      ip_location: null,
      literatures: null,
      language: null,
      comment: {
        level: is_nullish(row.sub_comment_count) ||
            typeof row.sub_comment_count === "string" &&
              !DataClean.is_not_blank_and_valid(row.sub_comment_count)
          ? 2
          : 1,
        count_sub: is_nullish(row.sub_comment_count)
          ? null
          : Nums.is_int(row.sub_comment_count)
          ? DataClean.parse_number(row.sub_comment_count)
          : null,
        parent_id: null,
      },
    };
    yield [_res];
  }
}

function _limit_title_length(s: string) {
  if (s.length > 500) {
    return s.slice(0, 500) + "...";
  } else {
    return s;
  }
}

async function* read_baidu_tieba_note(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;
  for await (
    const row of await db.selectFrom("tieba_note")
      .selectAll()
      .execute()
  ) {
    // const k: keyof typeof row = null as any;
    if (!DataClean.is_not_blank_and_valid(row.title)) {
      continue;
    }
    const content_link_url = DataClean.url_use_https_emptyable(row.note_url);
    if (
      is_nullish(content_link_url) ||
      !DataClean.is_not_blank_and_valid(row.note_url)
    ) {
      console.warn(
        "Invalid media crawler row, content_link_url invalid",
        { row },
      );
      continue;
    }
    const result_pdid = baidu_tieba_platform_duplicate_id({
      note_id: row.note_id,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_zhihu_platform_duplicate_id: result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text_summary = DataClean.is_not_blank_and_valid(row.desc)
      ? row.desc
      : null;

    const content_text_detail = null;
    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const created_time: string | null = to_str(row.publish_time);
    const updated_time: string | null = null;
    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: _limit_title_length(row.title),
      content_text_summary,
      content_text_detail,
      content_link_url,
      authors: DataClean.is_not_blank_and_valid(row.user_nickname) &&
          DataClean.is_not_blank_and_valid(row.user_nickname)
        ? [
          {
            nickname: row.user_nickname,
            avater_url: DataClean.url_use_https_emptyable(row.user_avatar),
            platform_user_id: `Name---${row.user_nickname}`,
            home_link_url: DataClean.url_use_https_emptyable(row.user_link),
          },
        ]
        : [],
      platform: PlatformEnum.百度贴吧,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like: null,
      count_star: null,
      count_share: null,
      count_comment: is_nullish(row.total_replay_num) ||
          Nums.is_invalid(row.total_replay_num)
        ? null
        : DataClean.cast_and_must_be_natural_number(row.total_replay_num),
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [
        ...(DataClean.is_not_blank_and_valid(row.tieba_name)
          ? [
            {
              text: row.tieba_name,
              url: DataClean.is_not_blank_and_valid(row.tieba_link) &&
                  Strs.startswith(row.tieba_link, "https://")
                ? row.tieba_link
                : null,
            },
          ]
          : []),
      ],
      create_time: DataClean.is_not_blank_and_valid(created_time)
        ? Times.parse_text_to_instant(created_time)
        : null,
      update_time: DataClean.is_not_blank_and_valid(updated_time)
        ? Times.parse_text_to_instant(updated_time)
        : null,
      cover_url: null,
      videos: null,
      from_search_context: [
        ...(DataClean.is_not_blank_and_valid(row.source_keyword)
          ? [
            {
              question: row.source_keyword,
            },
          ]
          : []),
      ],
      ip_location: row.ip_location,
      literatures: null,
      language: null,
    };
    yield [_res];
  }
}

async function* read_baidu_tieba_comment(param: {
  db: Kysely<DB>;
}): AsyncGenerator<
  MediaCrawlerYield[]
> {
  const { db } = param;
  for await (
    const row of await db.selectFrom("tieba_comment")
      .selectAll()
      .execute()
  ) {
    // const k: keyof typeof row = null as any;
    if (!DataClean.is_not_blank_and_valid(row.content)) {
      continue;
    }
    const content_link_url = DataClean.url_use_https_emptyable(row.note_url);
    if (
      is_nullish(content_link_url) ||
      !DataClean.is_not_blank_and_valid(row.note_url)
    ) {
      console.warn(
        "Invalid media crawler row, content_link_url invalid",
        { row },
      );
      continue;
    }
    const result_pdid = baidu_tieba_platform_duplicate_id({
      comment_id: row.comment_id,
      note_id: row.note_id,
    });
    if (
      !("platform_duplicate_id" in result_pdid) ||
      typeof result_pdid.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row , platform_duplicate_id invalid",
        {
          result_zhihu_platform_duplicate_id: result_pdid,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_pdid;
    const content_text_summary = DataClean.is_not_blank_and_valid(row.content)
      ? row.content
      : null;

    const content_text_detail = null;
    const to_str = (x: string | number | null) => {
      if (typeof x === "number") {
        if (Nums.is_invalid(x)) {
          return null;
        }
        return `${x}`;
      }
      return x;
    };
    const last_modify_ts: string | null = to_str(row.last_modify_ts);
    const created_time: string | null = to_str(row.publish_time);
    const updated_time: string | null = null;
    const _res: MediaCrawlerYieldMediaContent = {
      __is_media_crawler_yield_media_content__: true as const,
      last_crawl_time: DataClean.is_not_blank_and_valid(last_modify_ts)
        ? Times.parse_text_to_instant(last_modify_ts)
        : Errors.throw_and_format("row.last_modify_ts invalid", { row }),
      title: _limit_title_length(row.content),
      content_text_summary,
      content_text_detail,
      content_link_url,
      authors: DataClean.is_not_blank_and_valid(row.user_nickname) &&
          DataClean.is_not_blank_and_valid(row.user_nickname)
        ? [
          {
            nickname: row.user_nickname,
            avater_url: DataClean.url_use_https_emptyable(row.user_avatar),
            platform_user_id: `Name---${row.user_nickname}`,
            home_link_url: DataClean.url_use_https_emptyable(row.user_link),
          },
        ]
        : [],
      platform: PlatformEnum.百度贴吧,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like: null,
      count_star: null,
      count_share: null,
      count_comment: null,
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: [
        ...(DataClean.is_not_blank_and_valid(row.tieba_name)
          ? [
            {
              text: row.tieba_name,
              url: DataClean.is_not_blank_and_valid(row.tieba_link) &&
                  Strs.startswith(row.tieba_link, "https://")
                ? row.tieba_link
                : null,
            },
          ]
          : []),
      ],
      create_time: DataClean.is_not_blank_and_valid(created_time)
        ? Times.parse_text_to_instant(created_time)
        : null,
      update_time: DataClean.is_not_blank_and_valid(updated_time)
        ? Times.parse_text_to_instant(updated_time)
        : null,
      cover_url: null,
      videos: null,
      from_search_context: [],
      ip_location: row.ip_location,
      literatures: null,
      language: null,
      comment: {
        level: is_nullish(row.sub_comment_count) ||
            typeof row.sub_comment_count === "string" &&
              !DataClean.is_not_blank_and_valid(row.sub_comment_count)
          ? 2
          : 1,
        count_sub: is_nullish(row.sub_comment_count)
          ? null
          : Nums.is_int(row.sub_comment_count)
          ? DataClean.parse_number(row.sub_comment_count)
          : null,
        parent_id: row.note_id,
      },
    };
    yield [_res];
  }
}
