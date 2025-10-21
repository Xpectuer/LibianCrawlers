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
import { create_cache_in_memory } from "../common/caches.ts";
import {
  MediaContent,
  MediaContentAuthor,
  MediaRelatedSearches,
  MediaSearchContext,
  MediaVideo,
  PlatformEnum,
} from "../common/media.ts";
import { Paragraphs } from "../common/paragraph_analysis.ts";
import { ShopGood } from "../common/shop_good.ts";
import {
  ChatMessageTable,
  create_and_init_libian_crawler_database_scope,
  LiteratureTable,
  MediaPostTable,
  ShopGoodTable,
} from "./data_storage.ts";
import { pg_dto_equal } from "../../pg.ts";
import { ChatMessage } from "../common/chat_message.ts";
import { createHash } from "node:crypto";
import { Literature } from "../common/literature.ts";
import { libian_crawler_garbage_matchers } from "./clean_and_merge_platforms/index.ts";

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
    const res = new RegExp("'(.+?)'\\/exp").exec(search_query);
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

  export function get_screenshot<
    S,
  >(
    smart_crawl: S,
  ) {
    try {
      // deno-lint-ignore no-explicit-any
      const res = (smart_crawl as any)?.g_content?.dump_page_info
        ?.page_info_smart_wait?.files?.public_url ?? null;
      if (res === null || typeof res === "undefined") {
        return null;
      }
      if (typeof res === "string") {
        if (Strs.is_not_blank(res)) {
          return res;
        } else {
          return null;
        }
      } else {
        Errors.throw_and_format("Why res is not string or nullish ?", {
          res,
          typeof_res: typeof res,
          // deno-lint-ignore no-explicit-any
          files: (smart_crawl as any)?.g_content?.dump_page_info
            ?.page_info_smart_wait?.files,
        });
      }
    } catch (_ignore) {
      return null;
    }
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
      | "attach_docs"
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
      attach_docs: NonNullable<MediaContent["attach_docs"]> | null | undefined;
    };

  export type ShopGoodMerged = Omit<ShopGood, never>;

  export async function* read_garbage_for_libian_crawler(_param?: {
    // deno-lint-ignore no-explicit-any
    logw?: (text: string, obj: any) => void;
  }) {
    while (1) {
      const garbage: LibianCrawlerGarbage | undefined = yield;
      if (typeof garbage === "undefined") {
        yield undefined;
        continue;
      }
      try {
        for (const matcher of libian_crawler_garbage_matchers) {
          for await (const result of matcher.match(garbage)) {
            yield result;
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
            Errors.throw_and_format(
              `content.platform_duplicate_id maybe invalid`,
              {
                content_platform_duplicate_id: content.platform_duplicate_id,
                content,
              },
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
            Errors.throw_and_format(
              `Cache set should return "ok" , but not .`,
              { res, exists, cache_set_result },
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
          Errors.throw_and_format(
            `Failed on merge .`,
            { content_output },
            err,
          );
        }
      }
    };
    return {
      reducer: reducer(),
      serial_to_file: async function (basedir: string, tag_text: string) {
        console.debug("Start serial reducer cache to file :", {
          tag_text,
          basedir,
        });
        const t1 = new Date().getTime();
        const cached_data = await Promise.all(
          Mappings.object_entries(cache.get_batch(all_key)).map((it) =>
            Promise.resolve(it[1]).then((res) => [it[0], res] as const)
          ),
        );
        const t2 = new Date().getTime();
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
        const t3 = new Date().getTime();
        console.debug("Finish serial reducer cache to file :", {
          tag_text,
          basedir,
          cast_time_of_read_cache: `${t2 - t1}ms`,
          cast_time_of_ser_to_file: `${t3 - t2}ms`,
        });
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
            Errors.throw_and_format("Failed stat reducer_cache_file", {
              reducer_cache_file_path,
            }, err);
          }
        }
        if (!reducer_cache_file.isFile) {
          Errors.throw_and_format(
            `reducer_cache_file is not a file .`,
            { reducer_cache_file_path, reducer_cache_file },
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
              Errors.throw_and_format("key not string", { key });
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
          Errors.throw_and_format(
            `Invalid format of deser_obj from reducer_cache_file`,
            { reducer_cache_file_path },
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
        if (DataClean.is_not_blank_and_valid(cur.ip_location)) {
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
        literatures = DataClean.filter_or_merge_items(literatures, {
          on_check_filter(item) {
            if (
              [item.issn, item.isbn, item.eissn, item.cnsn, item.journal].find(
                (it) => DataClean.is_not_blank_and_valid(it),
              )
            ) {
              return "ok";
            } else {
              return "filter";
            }
          },
          on_check_same({ item, result_item }) {
            const take_valid = <K extends keyof typeof item>(k: K) => {
              let v = item[k];
              if (
                is_nullish(v) ||
                typeof v === "string" && !DataClean.is_not_blank_and_valid(v)
              ) {
                v = result_item[k];
              }
              return v;
            };
            for (
              const k of ["issn", "journal", "eissn", "isbn", "cnsn"] as const
            ) {
              if (
                DataClean.is_not_blank_and_valid(item[k]) &&
                DataClean.is_not_blank_and_valid(result_item[k]) &&
                item[k] === result_item[k]
              ) {
                const { issn, issn_list } = DataClean.find_issn_list_and_issn(
                  item["issn"],
                  item["issn_list"],
                  result_item["issn"],
                  result_item["issn_list"],
                );
                return {
                  is_same: true,
                  merge_result: {
                    issn,
                    journal: take_valid("journal"),
                    isbn: take_valid("isbn"),
                    publication_type: take_valid("publication_type"),
                    doi: take_valid("doi"),
                    pui: take_valid("pui"),
                    category: take_valid("category"),
                    level_of_evidence: take_valid("level_of_evidence"),
                    book_publisher: take_valid("book_publisher"),
                    cnsn: take_valid("cnsn"),
                    eissn: take_valid("eissn"),
                    issn_list,
                  },
                };
              }
            }
            return {
              is_same: false,
            };
          },
        }).results;
        if (literatures.length <= 0) {
          literatures = null;
        }
        const language = DataClean.find_languages(prev?.language, cur.language);
        let attach_docs: MediaContentMerged["attach_docs"] = Streams
          .deduplicate(
            [
              ...(prev?.attach_docs ?? []),
              ...(cur.attach_docs ?? []),
            ],
            (a, b) => a.id === b.id,
          );
        if (attach_docs.length <= 0) {
          attach_docs = null;
        }

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
          attach_docs,
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
        ].filter((it) => DataClean.is_not_blank_and_valid(it)));
        const international_standard_book_number = Arrays.first_or_null([
          prev?.international_standard_book_number ?? null,
          cur.international_standard_book_number,
        ].filter((it) => DataClean.is_not_blank_and_valid(it)));
        const china_standard_serial_number = Arrays.first_or_null([
          prev?.china_standard_serial_number ?? null,
          cur.china_standard_serial_number,
        ].filter((it) => DataClean.is_not_blank_and_valid(it)));
        const publication_organizer = Arrays.first_or_null([
          prev?.publication_organizer ?? null,
          cur.publication_organizer,
        ].filter((it) => DataClean.is_not_blank_and_valid(it)));
        const publication_place = Arrays.first_or_null([
          prev?.publication_place ?? null,
          cur.publication_place,
        ].filter((it) => DataClean.is_not_blank_and_valid(it)));
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

  let _global_dto_same_count: bigint = BigInt(0);
  let _global_update_count: bigint = BigInt(0);
  let _global_update_change_count: bigint = BigInt(0);
  let _global_update_arr_len_count: bigint = BigInt(0);
  let _global_insert_count: bigint = BigInt(0);
  let _global_insert_arr_len_count: bigint = BigInt(0);

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
      // const samed_count = {
      //   value: 0,
      // };
      const update_bar = async () =>
        await on_bar_text(
          // batch(DTO相同=${samed_count.value},gid在表中=${existed_list.length},all=${values.length}),
          `DTOSame=${_global_dto_same_count},Update=(change=${_global_update_change_count}/query=${_global_update_count}/arr_len=${_global_update_arr_len_count}),Insert=(query=${_global_insert_count},arr_len=${_global_insert_arr_len_count})`,
        );

      for (const existed of existed_list) {
        const value = values.find((value) => get_id(value) === existed.id);
        if (value === undefined) {
          Errors.throw_and_format(
            `BUG, value_new not found in values , but values id should in existed list .`,
            { existed, existed_list, values },
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
          // samed_count.value += 1;
          _global_dto_same_count += BigInt(1);
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
          _global_update_count += update_result.numUpdatedRows;
          _global_update_change_count += update_result.numChangedRows ??
            BigInt(0);
          _global_update_arr_len_count += BigInt(1);
          update_results.push(update_result);
        } catch (err2) {
          Errors.throw_and_format("update failed", { value, existed }, err2);
        }
        continue;
      }
      await update_bar();

      const not_existed = [...values].filter((value) => {
        return (
          undefined === existed_list.find((exist) => exist.id === get_id(value))
        );
      }).filter((value) => {
        if (
          value !== null && typeof value === "object" &&
          "platform_duplicate_id" in value
        ) {
          if (typeof value.platform_duplicate_id !== "string") {
            Errors.throw_and_format(
              "value.platform_duplicate_id should be string",
              { value },
            );
          }
          if (
            new TextEncoder().encode(value.platform_duplicate_id).length >= 499
          ) {
            console.warn(
              "\n\nSkip wait insert item because value.platform_duplicate_id too long",
              {
                value,
              },
            );
            return false;
          }
          return true;
        }
      });

      const insert_result_list: (InsertResult[] | null)[] = [];
      for (
        const not_existed_slice of Streams.split_array_use_batch_size(
          50,
          not_existed,
        )
      ) {
        try {
          const insert_result = not_existed_slice.sliced.length > 0
            ? await exec_insert_result({
              not_existed: not_existed_slice.sliced,
            })
            : null;
          insert_result_list.push(insert_result);

          _global_insert_arr_len_count += BigInt((insert_result ?? []).length);
          _global_insert_count += (insert_result ?? []).reduce(
            (prev, cur) => prev + (cur.numInsertedOrUpdatedRows ?? BigInt(0)),
            BigInt(0),
          );
          await update_bar();
        } catch (err) {
          Errors.throw_and_format("insert failed", {
            update_results,
            not_existed_length: not_existed.length,
            not_existed_slice,
          }, err);
        }
      }
      return {
        update_results,
        insert_result_list,
      };
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
    insert_result_list: (InsertResult[] | null)[];
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
        .map((it) => (
          is_nullish(it) ||
            typeof it === "string" && !Strs.is_not_blank(it) ||
            typeof it === "number" && Nums.is_invalid(it)
            ? null
            : `${it}`
        ))
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
        Streams.deduplicate(
          value.authors
            .values()
            .map((it) => Arrays.last_or_null(it)?.value?.nickname)
            .toArray()
            .filter((it) => typeof it === "string")
            .filter((it) => DataClean.is_not_blank_and_valid(it)),
        ).join(",")
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

      const languages = DataClean.find_languages(value.language).filter((it) =>
        DataClean.is_not_blank_and_valid(it)
      );
      const languages_joined = languages.length <= 0
        ? null
        : languages.join(",");
      const literature_issn_list = DataClean.find_issn_list_and_issn(
        value.literatures?.flatMap((literature) => {
          return [
            ...(Strs.is_not_blank(literature.issn) ? [literature.issn] : []),
            ...(literature.issn_list?.filter((it) =>
              it && Strs.is_not_blank(it)
            ) ??
              []),
          ];
        }) ?? [],
      ).issn_list;
      const literature_issn_list_joined = literature_issn_list.length <= 0
        ? null
        : literature_issn_list.join(",");
      let attach_docs = value.attach_docs;
      if (is_nullish(attach_docs)) {
        attach_docs = [];
      }
      let attach_docs_markdown: string | null = attach_docs.map((it) => {
        return `# ${it.id}\n\n${it.content_md}`;
      }).join("\n\n\n---------------------------------------\n\n\n");
      if (!DataClean.is_not_blank_and_valid(attach_docs_markdown)) {
        attach_docs_markdown = null;
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
        languages,
        languages_joined,
        literature_issn_list,
        literature_issn_list_joined,
        attach_docs,
        attach_docs_markdown,
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
            .filter((url) => DataClean.is_not_blank_and_valid(url)),
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
      const { issn, issn_list } = DataClean.find_issn_list_and_issn(
        value.international_standard_serial_number,
        value.issn_list,
      );
      const res = {
        ...Mappings.filter_keys(value, "pick", [
          "platform",
          "platform_duplicate_id",
          "crawl_from_platform",
          "title",
          "languages",
          "create_year",
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
        international_standard_serial_number: issn,
        last_crawl_time,
        languages_joined: (value.languages ?? []).join(","),
        keywords_joined: (value.keywords ?? []).join(","),
        issn_list,
        issn_list_joined: issn_list.length <= 0 ? null : issn_list.join(","),
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
