import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { DataClean, Errors, Streams, Strs, Times } from "../../../util.ts";
import { Literature } from "../../literature.ts";
import { MediaContent, PlatformEnum } from "../../media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_wanfangdata: LibianCrawlerGarbageCleaner<
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
      "wanfangdata" in template_parse_html_tree &&
      typeof template_parse_html_tree.wanfangdata === "object" &&
      template_parse_html_tree.wanfangdata !== null &&
      Object.keys(template_parse_html_tree.wanfangdata).length > 0
    ) {
      const { wanfangdata } = template_parse_html_tree;
      const g_id = smart_crawl.g_id;
      if (
        "periodical" in wanfangdata &&
        typeof wanfangdata.periodical === "object" &&
        wanfangdata.periodical &&
        "title" in wanfangdata.periodical &&
        typeof wanfangdata.periodical.title === "string" &&
        Strs.is_not_blank(wanfangdata.periodical.title) &&
        "details" in wanfangdata.periodical &&
        typeof wanfangdata.periodical.details === "object"
      ) {
        const { title, details, author, journal, issn_text } =
          wanfangdata.periodical;
        const url = "dump_page_info" in smart_crawl.g_content
          ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait
            ?.url
            .url
          : null;
        if (!Strs.is_not_blank(url)) {
          Errors.throw_and_format("why url empty", { g_id, url });
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
        let keywords: string[] = details.关键词 ?? [];
        keywords = Streams.deduplicate(keywords);
        const authors =
          (!author ? [] : Array.isArray(author) ? author : [author])
            .filter((it) => Strs.is_not_blank(it.name)).map((it) => {
              return {
                platform_user_id: `wanfangdata_username___${it.name}`,
                nickname: it.name,
                avater_url: null,
                home_link_url: null,
              };
            });
        const create_time: Temporal.Instant | null = details["论文发表日期"]
          ? Times.parse_text_to_instant(details["论文发表日期"])
          : null;

        const res2: MediaContent = {
          last_crawl_time: Times.parse_text_to_instant(
            smart_crawl.g_create_time,
          ),
          title,
          content_text_summary: details["摘要"] ?? null,
          content_text_detail: null,
          content_link_url,
          authors,
          platform: PlatformEnum.万方,
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
              journal: Strs.is_not_blank(journal) ? journal : null,
              doi: null,
              category: null,
              level_of_evidence: null,
              issn: Strs.is_not_blank(issn_text)
                ? DataClean.find_issn(issn_text)
                : null,
              isbn: null,
              publication_type: null,
              pui: null,
              book_publisher: null,
              cnsn: null,
              eissn: null,
            },
          ],
          language: null,
        };
        yield res2;
      }

      if (
        "perio" in wanfangdata &&
        typeof wanfangdata.perio === "object" &&
        wanfangdata.perio &&
        "title" in wanfangdata.perio &&
        typeof wanfangdata.perio.title === "string" &&
        Strs.is_not_blank(wanfangdata.perio.title) &&
        "details" in wanfangdata.perio &&
        typeof wanfangdata.perio.details === "object"
      ) {
        const { title, details } = wanfangdata.perio;
        const issn = DataClean.find_issn(details["国际刊号"]);
        if (issn) {
          const cnsn = details["国内刊号"];
          const impact_factor_latest = details["影响因子"]
            ? DataClean.parse_number(details["影响因子"])
            : null;
          const res: Literature = {
            platform: PlatformEnum.文献,
            last_crawl_time: Times.parse_text_to_instant(
              smart_crawl.g_create_time,
            ),
            platform_duplicate_id: LibianCrawlerCleanAndMergeUtil
              .get_literature_duplicated_id({ issn }),
            crawl_from_platform: PlatformEnum.万方,
            title,
            languages: details["语种"] ? [details["语种"]] : [],
            create_year: null,
            international_standard_serial_number: issn,
            international_standard_book_number: null,
            china_standard_serial_number: cnsn,
            publication_organizer: details["主办单位"],
            publication_place: details["地址"],
            keywords: [],
            count_published_documents: details["文献量"]
              ? DataClean.parse_number(details["文献量"])
              : null,
            count_download_total: details["下载量"]
              ? DataClean.parse_number(details["下载量"])
              : null,
            count_citations_total: details["被引量"]
              ? DataClean.parse_number(details["被引量"])
              : null,
            impact_factor_latest,
            eissn: null,
          };
          yield {
            __mode__: "literature" as const,
            ...res,
          };
        }
      }
    }
  },
};
