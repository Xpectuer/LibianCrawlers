import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  chain,
  DataClean,
  Errors,
  Strs,
  Times,
} from "../../../util.ts";
import { MediaContent, PlatformEnum } from "../../media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_entrez_search_result: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    if (
      "group__entrez_search_result__lib_biopython" in garbage &&
      garbage["group__entrez_search_result__lib_biopython"]
    ) {
      const { template_parse_html_tree, g_create_time, g_search_key } =
        garbage.group__entrez_search_result__lib_biopython;
      // 我原以为这是 RefWorks 格式，然而不是。
      const { ref_works: ncbi_fmt } = template_parse_html_tree;
      if (!ncbi_fmt) {
        throw new Error("Why parse ref_works failed ?");
      }
      const find_value = (
        label: (typeof ncbi_fmt)["entries"][number]["label"],
      ) =>
        ncbi_fmt.entries_multiple.find((it) => it.label === label)
          ?.values_join ?? null;
      const get_doi = () => {
        let line = find_value("LID");
        if (!line) {
          return null;
        }
        line = line.trim();
        if (!line || line.indexOf("[doi]") < 0) {
          return null;
        }
        line = line.replace("[doi]", "").trim();
        return Strs.is_not_blank(line) ? line : null;
      };
      const get_issn = () => {
        const values = ncbi_fmt.entries_multiple.find((it) => it.label === "IS")
          ?.values;
        if (typeof values === "undefined" || values.length <= 0) {
          return null;
        }
        const issn_list = values.map((value) => {
          return DataClean.find_issn(value);
        }).filter((it) => it !== null);
        if (issn_list.length <= 0) {
          return null;
        } else if (issn_list.length > 1) {
          for (const issn of issn_list) {
            if (issn !== issn_list[0]) {
              // Errors.throw_and_format("Why not same issn ?", {
              //   issn_list,
              //   ncbi_fmt,
              // });
              //
              //
              // Just like:
              //  ISSN (online): 1399-3003 ; ISSN (print): 0903-1936
              // console.warn("Not same issn list", {
              //   issn_list,
              //   ncbi_fmt,
              // });
              return issn_list[0];
            }
          }
          return issn_list[0];
        } else {
          return issn_list[0];
        }
      };
      const pubmed_id = find_value("PMID");
      if (!pubmed_id) {
        Errors.throw_and_format("TODO: other platform", {
          pubmed_id,
          ncbi_fmt,
        });
      }
      const dcom = find_value("DCOM");
      const lr = find_value("LR");
      let content_text_summary = find_value("AB");
      if (content_text_summary && content_text_summary.length > 700) {
        content_text_summary = content_text_summary.substring(0, 700) +
          "...";
      }
      const res: MediaContent = {
        last_crawl_time: Times.parse_text_to_instant(g_create_time),
        title: find_value("TI") ?? "",
        content_text_summary,
        content_text_detail: null,
        content_link_url: `https://pubmed.ncbi.nlm.nih.gov/${pubmed_id}`,
        authors: ncbi_fmt.authors.map((it) => {
          return {
            platform_user_id: `PersonName---${it.AU}`,
            nickname: it.AU,
            avater_url: null,
            home_link_url: null,
          };
        }),
        platform: PlatformEnum.PubMed,
        platform_duplicate_id: `${pubmed_id}`,
        count_read: null,
        count_like: null,
        from_search_context: !g_search_key ? [] : [
          {
            question: g_search_key,
          },
        ],
        create_time: Arrays.first_or_null(
          [
            dcom ? Times.parse_text_to_instant(dcom) : null,
            lr ? Times.parse_text_to_instant(lr) : null,
          ].filter((it) => it !== null),
        ),
        update_time: null,
        tags: chain(() =>
          ncbi_fmt.entries_multiple
            .find((it) => it.label === "OT")
            ?.values.map((it) => ({ text: it }))
        )
          .map((it) => (it && it.length > 0 ? it : null))
          .get_value() ?? null,
        ip_location: null,
        cover_url: null,
        count_share: null,
        count_star: null,
        video_total_count_danmaku: null,
        video_total_duration_sec: null,
        count_comment: null,
        platform_rank_score: null,
        videos: null,
        literatures: [
          {
            journal: find_value("JT"),
            doi: get_doi(),
            category: null,
            level_of_evidence: null,
            issn: get_issn(),
            isbn: null,
            publication_type: null,
            pui: null,
            book_publisher: null,
            cnsn: null,
            eissn: null,
          },
        ],
        language: find_value("LA"),
      };
      yield res;
    }
  },
};
