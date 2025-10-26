import { MediaContent, PlatformEnum } from "../common/media.ts";
import { Kysely } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { DB } from "./db.d.ts";
import { DataClean, Errors, is_nullish, Nums, Times } from "../../util.ts";
import { zhihu_platform_duplicate_id } from "../libian_crawler/clean_and_merge_platforms/util.ts";
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
        // deno-lint-ignore no-explicit-any
      }) as any,
    }),
  });

  console.debug("[read_media_crawler_from_sqlite] each zhihu");
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
        "Invalid media crawler row of zhihu , content_link_url invalid",
        { row },
      );
      continue;
    }
    const result_zhihu_platform_duplicate_id = zhihu_platform_duplicate_id({
      content_type: row.content_type,
      content_id: row.content_id,
      question_id: row.question_id,
    });
    if (
      !("platform_duplicate_id" in result_zhihu_platform_duplicate_id) ||
      typeof result_zhihu_platform_duplicate_id.platform_duplicate_id !==
        "string"
    ) {
      console.warn(
        "Invalid media crawler row of zhihu , platform_duplicate_id invalid",
        {
          result_zhihu_platform_duplicate_id,
          row,
        },
      );
      continue;
    }
    const { platform_duplicate_id } = result_zhihu_platform_duplicate_id;
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
      count_like: is_nullish(row.voteup_count)
        ? null
        : DataClean.cast_and_must_be_natural_number(row.voteup_count),
      count_star: null,
      count_share: null,
      count_comment: is_nullish(row.comment_count)
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
  console.debug("[read_media_crawler_from_sqlite] Finish", param);
}
