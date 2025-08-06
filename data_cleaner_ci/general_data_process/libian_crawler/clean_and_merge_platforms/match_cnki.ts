import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  chain,
  DataClean,
  Errors,
  Mappings,
  Nums,
  Streams,
  Strs,
  Times,
} from "../../../util.ts";
import { MediaContent, PlatformEnum } from "../../media.ts";
import { Literature } from "../../literature.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";
import { Paragraphs } from "../../paragraph_analysis.ts";

export const match_cnki: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    const { template_parse_html_tree } = smart_crawl;
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
        return;
      }
      const content_link_url = DataClean.url_use_https_noempty(url);
      const authors = typeof cnki.authors === "undefined"
        ? []
        : Array.isArray(cnki.authors)
        ? cnki.authors
        : [cnki.authors];
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
        cover_url: DataClean.url_use_https_emptyable(
          LibianCrawlerCleanAndMergeUtil.get_screenshot(smart_crawl),
        ),
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
            doi: "doi" in cnki && DataClean.has_information(cnki.doi)
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
            eissn: null,
            issn_list: null,
          },
        ],
        language: null,
      };
      yield res;
    }
  },
};

export const match_cnki_journal: LibianCrawlerGarbageCleaner<
  Literature & {
    __mode__: "literature";
  }
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    const { template_parse_html_tree } = smart_crawl;

    if (
      template_parse_html_tree.cnki_journal_detail &&
      "info_dict" in template_parse_html_tree.cnki_journal_detail &&
      template_parse_html_tree.cnki_journal_detail.info_dict &&
      typeof template_parse_html_tree.cnki_journal_detail.info_dict ===
        "object" &&
      "ISSN" in template_parse_html_tree.cnki_journal_detail.info_dict &&
      DataClean.has_information(
        template_parse_html_tree.cnki_journal_detail.info_dict.ISSN,
      )
    ) {
      const g_id = smart_crawl.g_id;
      const { info_dict, title } = template_parse_html_tree.cnki_journal_detail;
      const issn = DataClean.find_issn(info_dict.ISSN ?? "");
      if (
        typeof title !== "string" || !DataClean.has_information(title) ||
        !Strs.is_not_blank(issn)
      ) {
        console.warn("Why title or issn invalid ?", {
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
        const cnsn = DataClean.has_information(info_dict.CN?.trim())
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
          const kwds of [
            info_dict.专辑名称,
            ...("专题名称" in info_dict ? [info_dict.专题名称] : []),
          ] as const
        ) {
          if (typeof kwds !== "string") {
            continue;
          }
          for (
            const kw of Strs.remove_prefix_suffix_recursion(
              kwds.trim(),
              ";",
            ).split(";")
          ) {
            if (DataClean.has_information(kw)) {
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
          platform_duplicate_id: LibianCrawlerCleanAndMergeUtil
            .get_literature_duplicated_id({ issn }),
          crawl_from_platform: PlatformEnum.知网,
          title,
          languages: DataClean.find_languages(info_dict.语种),
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
          issn_list: null,
        };
        yield {
          __mode__: "literature" as const,
          ...res,
        };
      }
    }
  },
};
