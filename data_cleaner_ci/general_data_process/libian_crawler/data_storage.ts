import { Kysely, Migrator } from "kysely";
import config from "../../config.ts";
import { MediaContent, PlatformEnum } from "../media.ts";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import { DataMerge, Jsons } from "../../util.ts";
import { PostgresColumnType } from "../../pg.ts";

export const _libian_crawler_cleaned = "libian_crawler_cleaned" as const;

export interface LibianCrawlerDatabase {
  "libian_crawler_cleaned.media_post": MediaPostTable;
  "libian_crawler_cleaned.shop_good": ShopGoodTable;
  // "libian_crawler_cleaned.file_storage": FileStorageTable;
  // "libian_crawler_cleaned.image_ocr": ImageOcrTable;
  // "libian_crawler_cleaned.audio_speech_recognition": AudioSpeechRecognitionTable;
}

export interface MediaPostTable {
  id: string;
  platform: PlatformEnum;
  platform_duplicate_id: string;
  create_time: Date | null;
  update_time: Date | null;
  count_read: PostgresColumnType.Numeric | null;
  count_like: PostgresColumnType.Numeric | null;
  count_share: PostgresColumnType.Numeric | null;
  count_star: PostgresColumnType.Numeric | null;
  count_comment: PostgresColumnType.Numeric | null;
  video_total_count_danmaku: PostgresColumnType.Numeric | null;
  video_total_duration_sec: PostgresColumnType.Numeric | null;
  title: string;
  titles: PostgresColumnType.JSON<string[]>;
  title_timeline: PostgresColumnType.JSON<
    ReturnType<typeof DataMerge.timeline_to_json<string>>
  >;
  content_link_url: string | null;
  content_link_urls: PostgresColumnType.JSON<string[]>;
  from_search_questions: PostgresColumnType.JSON<string[]>;
  ip_location: PostgresColumnType.JSON<string[]>;
  author_first_unique_user_id: string | null;
  author_first_platform_user_id: string | null;
  author_first_nickname: string | null;
  author_first_avater_url: string | null;
  author_first_home_link_url: string | null;
  authors: PostgresColumnType.JSON<
    {
      platform_user_id: string;
      timeline: ReturnType<
        typeof DataMerge.timeline_to_json<
          Omit<MediaContent["authors"][number], "platform_user_id">
        >
      >;
    }[]
  >;
  cover_first_url: string | null;
  cover_urls: PostgresColumnType.JSON<string[]>;
  platform_rank_score_timeline: PostgresColumnType.JSON<
    ReturnType<typeof DataMerge.timeline_to_json<number>>
  >;
  tag_texts: PostgresColumnType.JSON<string[]>;
  tag_text_joined: string;
  content_text_timeline_count: PostgresColumnType.Numeric;
  context_text_latest_str_length: PostgresColumnType.Numeric;
  context_text_latest: string | null;
  content_text_deleted_at_least_once: boolean;
  content_text_deleted_first_time: Date | null;
  content_text_resume_after_deleted: boolean;
  content_text_timeline: PostgresColumnType.JSON<
    ReturnType<
      typeof DataMerge.timeline_to_json<{
        text: string;
        is_summary: boolean;
      }>
    >
  >;
  content_text_summary_uncleaned_timeline: PostgresColumnType.JSON<
    ReturnType<typeof DataMerge.timeline_to_json<string>>
  >;
  content_text_detail_uncleaned_timeline: PostgresColumnType.JSON<
    ReturnType<typeof DataMerge.timeline_to_json<string>>
  >;
  context_text_latest_lines_count: PostgresColumnType.Numeric | null;
  last_crawl_time: Date;
}

export interface ShopGoodTable {
  id: string;
  platform: PlatformEnum;
  platform_duplicate_id: string;
  create_time: Date | null;
  update_time: Date | null;
  count_good_buy: PostgresColumnType.Numeric | null;
  count_good_want: PostgresColumnType.Numeric | null;
  count_good_comment: PostgresColumnType.Numeric | null;
  good_name: string;
  shop_name: string;
  good_image_file_ids: PostgresColumnType.JSON<string[]>;
}

// export interface FileStorageTable {
//   id: string;
//   create_time: Date;
//   recommended_filename: string;
//   ext_type: string;
//   source_urls: PostgresColumnType.JSON<string[]>;
//   meta_info: PostgresColumnType.JSON<Jsons.JSONObject>;
//   is_image: boolean;
//   is_video: boolean;
//   is_audio: boolean;
//   get_image_from_file_id: string | null;
//   get_audio_from_file_id: string | null;
//   hex_md5: string;
//   hex_sha128: string;
//   hex_sha256: string;
//   hex_sha512: string;
//   minio_public_address: string | null;
//   // TODO
// }

// export interface ImageOcrTable {
//   id: string;
//   create_time: Date;
//   file_id: string;
//   ocr_framework_tag: string;
//   ocr_result: PostgresColumnType.JSON<Jsons.JSONObject>;
//   ocr_plain_text: string;
//   // TODO
// }

// export interface AudioSpeechRecognitionTable {
//   id: string;
//   create_time: Date;
//   file_id: string;
//   // TODO
// }

export async function create_and_init_libian_srawler_database_scope<R>(
  scope: (db: Kysely<LibianCrawlerDatabase>) => Promise<R>
) {
  const { data_storage } = config.libian_crawler;
  const { connect_param, migration } = data_storage;
  const db = new Kysely<LibianCrawlerDatabase>({
    dialect: new PostgresJSDialect({
      postgres: postgres({
        database: connect_param.dbname,
        ...connect_param,
      }),
    }),
  });
  try {
    const migrator = new Migrator({
      db,
      migrationTableSchema: migration.schema,
      migrationTableName: migration.table,
      migrationLockTableName: migration.lock_table,
      provider: {
        async getMigrations() {
          const { migrations } = await import("./migrations/index.ts");
          return migrations;
        },
      },
    });
    const migrate_result_set = await migrator.migrateToLatest();
    console.info("migrate result set", migrate_result_set);
    const { error } = migrate_result_set;
    if (error) {
      throw error;
    }
    return await scope(db);
  } finally {
    await db.destroy();
  }
}
