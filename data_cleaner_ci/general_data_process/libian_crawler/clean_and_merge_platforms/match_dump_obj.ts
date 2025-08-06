import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  DataClean,
  Errors,
  Mappings,
  Nums,
  Streams,
  Strs,
  Times,
  Typings,
} from "../../../util.ts";
import {
  MediaContent,
  MediaContentAuthor,
  MediaSearchContext,
  PlatformEnum,
} from "../../media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
export const match_dump_obj: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (
      !("dump_page_info" in smart_crawl.g_content)
    ) {
      return;
    }
    const { dump_page_info } = smart_crawl.g_content;
    if (
      typeof dump_page_info !== "object" ||
      dump_page_info === null
    ) {
      return;
    }
    if (!("dump_obj" in dump_page_info)) {
      return;
    }
    const { dump_obj } = dump_page_info;
    if (
      typeof dump_obj !== "object" ||
      dump_obj === null
    ) {
      return;
    }
    if (typeof dump_obj.data === "object" && Array.isArray(dump_obj.data)) {
      // 旧版解析 csv 文件，已弃用。
    } else if (typeof dump_obj.data === "object") {
      const { data } = dump_obj;
      if ("rows" in data && Array.isArray(data.rows) && data.rows.length >= 1) {
        // -------------------------------------------------------
        // 解析 csv 文件

        // -------------------------------------------------------
        // Embase 下载的 csv
        const { rows, prefix } = data;

        const prefix_first_line = !Strs.is_not_blank(prefix)
          ? null
          : Arrays.first_or_null(
            prefix.split("\n"),
          );

        const last_crawl_time = Times.parse_text_to_instant(
          smart_crawl.g_create_time,
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
                const embase_search_exp = LibianCrawlerCleanAndMergeUtil
                  .find_embase_search_query_exp(
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
                  `Cannot detect search query`,
                  { prefix_first_line, g_id: smart_crawl.g_id },
                );
                from_search_context = [
                  // {
                  //   question: prefix_first_line,
                  // },
                ];
              }
            } else {
              // Errors.throw_and_format(
              //   `Why not found embase csv header`,
              //   { prefix_first_line, g_id: smart_crawl.g_id },
              // );
              from_search_context = [];
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
              } catch (_err) {
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
            const publication_type =
              DataClean.has_information(row["Publication Type"])
                ? row["Publication Type"]
                : null;
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
                  } catch (_err) {
                    continue;
                  }
                }
                Errors.throw_and_format("row links all invalid", {
                  row,
                });
              })(),
              authors: [
                ...(
                  row["Author Names"].split(",").filter((it) =>
                    DataClean.has_information(it)
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
              platform_duplicate_id: LibianCrawlerCleanAndMergeUtil
                .compute_platform_duplicate_id_for_embase(
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
              cover_url: DataClean.url_use_https_emptyable(
                LibianCrawlerCleanAndMergeUtil.get_screenshot(smart_crawl),
              ),
              videos: null,
              from_search_context,
              ip_location: null,
              count_share: null,
              count_comment: null,
              literatures: [
                {
                  journal: null,
                  issn: DataClean.find_issn(row.ISSN),
                  isbn: DataClean.has_information(row.ISBN) ? row.ISBN : null,
                  publication_type,
                  doi: DataClean.has_information(row.DOI) ? row.DOI : null,
                  pui: DataClean.has_information(row.PUI) ? row.PUI : null,
                  category: publication_type,
                  level_of_evidence: null,
                  book_publisher: null,
                  cnsn: null,
                  eissn: null,
                  issn_list: null,
                },
              ],
              language: DataClean.find_languages(
                row["Article Language"],
                row["Summary Language"],
              ),
            };
            yield res;
          } else {
            console.warn(
              "Unknown type for dump_obj , smart_crawl.g_id is",
              smart_crawl.g_id,
            );
          }
        }
      } else if ("sheets" in data && "sheet_names" in data) {
        // -------------------------------------------------------
        // 解析 excel 文件
        const _split = (text: string | null | undefined) => {
          return Strs.is_not_blank(text)
            ? text.split(";")
              .map((it) => it.trim())
              .filter((it) => DataClean.has_information(it))
            : [];
        };
        // -------------------------------------------------------
        // PubMed 下载的 excel
        for (const record of data.sheets?.savedrecs.records ?? []) {
          const title = Streams.find_first(
            (it) => DataClean.has_information(it),
            [
              record["Article Title"],
            ],
          )?.item;
          const issn_str = record["ISSN"];
          const issn = Strs.is_not_blank(issn_str)
            ? DataClean.find_issn(issn_str)
            : null;
          const journal = record["Source Title"];
          const doi = record["DOI"];
          const platform_duplicate_id = record["UT (Unique WOS ID)"];
          const parse_publication_date = (_param: {
            on_found_month_range: "use_min_month" | "use_max_month";
          }) => {
            const publication_year = record["Publication Year"];
            const publication_date = record["Publication Date"];
            if (publication_date === "WIN") {
              // 有些文献按季节发布。这里丢了得了。
              return "SKIP";
            }
            return DataClean.has_information(publication_date)
              ? Times.parse_text_to_instant(publication_date, {
                attach_year: [publication_year, {
                  on_exist: "raise_on_not_match",
                }],
                attach_day: [2, {
                  on_exist: "use_exist",
                }],
                on_found_month_range: _param.on_found_month_range,
              })
              : null;
          };
          const create_time = parse_publication_date({
            on_found_month_range: "use_min_month",
          });
          if (create_time === "SKIP") {
            continue;
          }
          const update_time = parse_publication_date({
            on_found_month_range: "use_max_month",
          });
          if (update_time === "SKIP") {
            continue;
          }
          const _author_name_list = _split(
            DataClean.has_information(record["Author Full Names"])
              ? record["Author Full Names"]
              : record["Authors"],
          );
          if (!title || !create_time) {
            continue;
          }
          const res: MediaContent = {
            last_crawl_time: Times.parse_text_to_instant(
              garbage.obj.g_create_time,
            ),
            title,
            content_text_summary: record["Abstract"],
            content_text_detail: null,
            content_link_url: doi
              ? `https://doi.org/${doi}`
              : `https://www.webofscience.com/wos/woscc/full-record/${platform_duplicate_id}`,
            ip_location: null,
            cover_url: DataClean.url_use_https_emptyable(
              LibianCrawlerCleanAndMergeUtil.get_screenshot(smart_crawl),
            ),
            tags: Streams.deduplicate([
              record["Document Type"],
              ..._split(record["Author Keywords"]),
              ..._split(record["Keywords Plus"]),
            ]).map((it) => ({ text: it })),
            authors: _author_name_list.map((it) => {
              return {
                platform_user_id: `AuthorName___${it}`,
                nickname: it,
                avater_url: null,
                home_link_url: null,
              };
            }),
            platform: PlatformEnum.WebOfScience,
            platform_duplicate_id,
            create_time,
            update_time: create_time === null || update_time === null
              ? update_time
              : Times.instant_to_date(create_time).getTime() ===
                  Times.instant_to_date(update_time).getTime()
              ? null
              : update_time,
            count_like: null,
            count_share: null,
            count_star: null,
            count_comment: null,
            count_read: null,
            video_total_count_danmaku: null,
            video_total_duration_sec: null,
            platform_rank_score: null,
            from_search_context: [
              //   ...(search_key
              //     ? [{ question: search_key } satisfies MediaSearchContext]
              //     : []),
            ],
            videos: null,
            literatures: [
              {
                journal,
                issn,
                isbn: record["ISBN"],
                cnsn: null,
                eissn: record["eISSN"],
                publication_type: record["Publication Type"],
                doi,
                pui: null,
                category: record["WoS Categories"],
                level_of_evidence: null,
                book_publisher: record["Publisher"],
                issn_list: null,
              },
            ],
            language: record["Language"],
          };
          yield res;
        }
      } else {
        // TODO
      }
    }
  },
};
