import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
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

export const match_cqvip: LibianCrawlerGarbageCleaner<
  | MediaContent
  | (Literature & {
    __mode__: "literature";
  })
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
      "cqvip" in template_parse_html_tree &&
      template_parse_html_tree.cqvip &&
      "title" in template_parse_html_tree.cqvip &&
      template_parse_html_tree.cqvip.title &&
      typeof template_parse_html_tree.cqvip.title === "string" &&
      "info_dict" in template_parse_html_tree.cqvip &&
      template_parse_html_tree.cqvip.info_dict &&
      typeof template_parse_html_tree.cqvip.info_dict === "object"
    ) {
      const { cqvip } = template_parse_html_tree;
      const g_id = smart_crawl.g_id;
      const { info_dict, title, journal } = cqvip;
      if (
        typeof title !== "string" || !Strs.is_not_blank(title) ||
        typeof info_dict !== "object" || !(
          typeof journal === "object" && "detail" in journal &&
          typeof journal.detail === "object"
        )
      ) {
        console.warn("Why cqvip invalid ?", {
          g_id,
          title,
          cqvip,
        });
      } else {
        const journal_detail = journal.detail;
        const issn = DataClean.find_issn(journal_detail.ISSN ?? "");
        if (issn !== null) {
          if (!DataClean.check_issn(issn)) {
            Errors.throw_and_format("Invalid issn", {
              issn,
              g_id,
              title,
              cqvip,
            });
          }
        }
        const cnsn = Strs.is_not_blank(journal_detail.CN?.trim())
          ? journal_detail.CN.trim()
          : null;
        const isbn = null;
        let impact_factor_latest_year = 1970;
        let impact_factor_latest: null | number = null;
        for (
          const [key, value] of Mappings.object_entries(journal_detail)
        ) {
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
        if (issn !== null && Strs.is_not_blank(journal.title)) {
          const res: Literature = {
            platform: PlatformEnum.文献,
            last_crawl_time: Times.parse_text_to_instant(
              smart_crawl.g_create_time,
            ),
            platform_duplicate_id: LibianCrawlerCleanAndMergeUtil
              .get_literature_duplicated_id({ issn }),
            crawl_from_platform: PlatformEnum.维普,
            title: journal.title,
            languages: [],
            create_year: null,
            international_standard_serial_number: issn,
            international_standard_book_number: isbn,
            china_standard_serial_number: cnsn,
            publication_organizer: null,
            publication_place: null,
            keywords: [],
            count_published_documents: null,
            count_download_total: null,
            count_citations_total: null,
            impact_factor_latest,
            eissn: null,
          };
          yield {
            __mode__: "literature" as const,
            ...res,
          };
        }
        const url = "dump_page_info" in smart_crawl.g_content
          ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait
            ?.url
            .url
          : null;
        if (!Strs.is_not_blank(url)) {
          Errors.throw_and_format("why url empty", url);
        }
        const content_link_url = DataClean.url_use_https_noempty(url);
        let search_keyword: string | null = null;
        if (
          "cmd_param_url" in smart_crawl.g_content &&
          smart_crawl.g_content.cmd_param_url &&
          "query_dict" in smart_crawl.g_content.cmd_param_url &&
          smart_crawl.g_content.cmd_param_url &&
          typeof smart_crawl.g_content.cmd_param_url.query_dict ===
            "object" &&
          smart_crawl.g_content.cmd_param_url.query_dict !== null &&
          "q" in smart_crawl.g_content.cmd_param_url.query_dict &&
          smart_crawl.g_content.cmd_param_url.query_dict &&
          Strs.is_not_blank(
            smart_crawl.g_content.cmd_param_url.query_dict.q,
          )
        ) {
          if (smart_crawl.g_content.cmd_param_url.query_dict) {
            search_keyword = smart_crawl.g_content.cmd_param_url.query_dict.q;
          }
        }
        let keywords: string[] = [];
        for (
          const kwds of [info_dict.关键词] as const
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
            if (Strs.is_not_blank(kw)) {
              keywords.push(kw.trim());
            }
          }
        }
        keywords = Streams.deduplicate(keywords);
        const authors = (
          Array.isArray(info_dict.作者)
            ? info_dict.作者.map(({ author_infos }) => {
              let info_href: string | null = null;
              let nickname: string = "";
              for (
                const info of (Array.isArray(author_infos)
                  ? author_infos
                  : [author_infos])
              ) {
                if ("href" in info && Strs.is_not_blank(info.href)) {
                  info_href = info.href;
                }
                if ("str" in info && Strs.is_not_blank(info.str)) {
                  if (Nums.is_int(info.str)) {
                    // ignore
                  } else {
                    nickname = info.str;
                  }
                }
              }
              return {
                platform_user_id: Strs.is_not_blank(info_href)
                  ? `cqvip_user___${info_href.replace("/", "_")}`
                  : `cqvip_username___${nickname}`,
                nickname,
                avater_url: null,
                home_link_url: Strs.is_not_blank(info_href)
                  ? `https://www.cqvip.com${info_href}` as const
                  : null,
              } as const;
            })
            : [
              {
                platform_user_id:
                  `cqvip_username___${info_dict.作者.author_infos.str}`,
                nickname: info_dict.作者.author_infos.str,
                avater_url: null,
                home_link_url: null,
              },
            ]
        ).filter((it) => Strs.is_not_blank(it.nickname));
        let create_time: Temporal.Instant | null = null;
        if (Strs.is_not_blank(info_dict.DOI)) {
          const _doi_split = info_dict.DOI.split(".");
          const l = _doi_split.length;
          if (l > 3) {
            const last1 = Strs.remove_prefix_recursion(
              _doi_split[l - 1],
              "0",
            );
            const last2 = Strs.remove_prefix_recursion(
              _doi_split[l - 2],
              "0",
            );
            const last3 = Strs.remove_prefix_recursion(
              _doi_split[l - 3],
              "0",
            );
            if (
              Nums.is_int(last1) && Nums.is_int(last2) &&
              Nums.is_int(last3)
            ) {
              const last_1 = parseInt(last1);
              const last_2 = parseInt(last2);
              const last_3 = parseInt(last3);
              if (
                last_1 >= 1 && last_1 <= 31 && last_2 >= 1 &&
                last_2 <= 12 && last_3 >= 1800 && last_3 <= 2200
              ) {
                create_time = Times.parse_text_to_instant(
                  `${last_3}-${last_2}-${last_1}`,
                );
              }
            }
          }
        }

        const res2: MediaContent = {
          last_crawl_time: Times.parse_text_to_instant(
            smart_crawl.g_create_time,
          ),
          title,
          content_text_summary: info_dict["摘要"],
          content_text_detail: null,
          content_link_url,
          authors,
          platform: PlatformEnum.维普,
          platform_duplicate_id: `TitleAuthors---${title}---${
            authors
              .map((it) => it.nickname)
              .join(";")
          }`,
          count_read: null,
          count_like: null,
          from_search_context: !search_keyword ? [] : [
            {
              question: search_keyword,
            },
          ],
          create_time,
          update_time: null,
          tags: keywords.map((it) => ({
            text: it,
          })),
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
              journal: "title" in journal
                ? Strs.is_not_blank(journal.title) ? journal.title : null
                : null,
              doi: info_dict.DOI ?? null,
              category: null,
              level_of_evidence: null,
              issn,
              isbn,
              publication_type: null,
              pui: null,
              book_publisher: null,
              cnsn,
              eissn: null,
            },
          ],
          language: null,
        };
        yield res2;
      }
    }
  },
};
