import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  chain,
  DataClean,
  Errors,
  is_nullish,
  Streams,
  Strs,
  Times,
} from "../../../util.ts";
import { Literature } from "../../common/literature.ts";
import { MediaContent, PlatformEnum } from "../../common/media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const get_wanfangdata_platform_duplicate_id = (param: {
  title: string;
  authors: {
    nickname: string;
  }[];
}) => {
  let { title, authors } = param;
  title = title.trim();
  return `TitleAuthors---${title}---${
    authors
      .map((it) => it.nickname)
      .join(";")
  }`;
};

export const match_wanfangdata: LibianCrawlerGarbageCleaner<
  | MediaContent
  | (Literature & {
    __mode__: "literature";
  })
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    if (!("obj" in garbage) || is_nullish(garbage.obj)) {
      return;
    }
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
        DataClean.is_not_blank_and_valid(wanfangdata.periodical.title) &&
        "details" in wanfangdata.periodical &&
        typeof wanfangdata.periodical.details === "object"
      ) {
        const { title, details, journal, issn_text } = wanfangdata.periodical;
        const author = "author" in wanfangdata.periodical
          ? wanfangdata.periodical.author
          : null;
        const url = "dump_page_info" in smart_crawl.g_content
          ? smart_crawl.g_content.dump_page_info?.page_info_smart_wait
            ?.url
            .url
          : null;
        if (!DataClean.is_not_blank_and_valid(url)) {
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
        const authors = chain(() => {
          return (!author
            ? []
            : Array.isArray(author)
            ? author
            : [author])
            .filter((it) => DataClean.is_not_blank_and_valid(it.name)).map(
              (it) => {
                let nickname = it.name;
                let break_loop = false;
                while (!break_loop) {
                  break_loop = true;
                  nickname = nickname.trim();
                  for (
                    const num of [
                      "0",
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                    ]
                  ) {
                    if (Strs.endswith(nickname, num)) {
                      nickname = Strs.remove_suffix_recursion(nickname, num);
                      break_loop = false;
                    }
                  }
                }
                return {
                  platform_user_id: `wanfangdata_username___${nickname}`,
                  nickname,
                  avater_url: null,
                  home_link_url: null,
                };
              },
            ).filter((it) => DataClean.is_not_blank_and_valid(it.nickname));
        })
          .map((arr) =>
            Streams.deduplicate(arr, (a, b) => a.nickname === b.nickname)
          )
          .get_value();
        const create_time: Temporal.Instant | null =
          "论文发表日期" in details && details["论文发表日期"]
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
          platform_duplicate_id: get_wanfangdata_platform_duplicate_id({
            title,
            authors,
          }),
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
              journal: DataClean.is_not_blank_and_valid(journal)
                ? journal
                : null,
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
              issn_list: null,
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
        DataClean.is_not_blank_and_valid(wanfangdata.perio.title) &&
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
            languages: DataClean.find_languages(details["语种"]),
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
            issn_list: null,
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
