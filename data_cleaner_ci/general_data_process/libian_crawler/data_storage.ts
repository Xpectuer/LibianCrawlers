import { JSONColumnType, Kysely, Migrator } from "kysely";
import config from "../../config.ts";
import { MediaContent, PlatformEnum } from "../media.ts";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import { DataMerge, Typings } from "../../util.ts";
import { MediaContentMerged } from "./clean_and_merge.ts";
import { PostgresColumnType } from "../../pg.ts";

export const _libian_crawler_cleaned = "libian_crawler_cleaned" as const;

export interface LibianCrawlerDatabase {
  "libian_crawler_cleaned.media_post": MediaPostTable;
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
    // Typings.MapToRecord<MediaContentMerged["authors"]>
  >;
  cover_first_url: string | null;
  cover_urls: PostgresColumnType.JSON<string[]>;
  platform_rank_score_timeline: PostgresColumnType.JSON<
    ReturnType<typeof DataMerge.timeline_to_json<number>>
  >;
  tag_texts: PostgresColumnType.JSON<string[]>;
  tag_text_joined: string;
}

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
          const { migrations } = await import("./data_storage_migration.ts");
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
