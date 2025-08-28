import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  chain,
  DataClean,
  Errors,
  Strs,
  Times,
} from "../../../util.ts";
import { MediaContent, PlatformEnum } from "../../common/media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_pubmed_str: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (
      !("template_parse_html_tree" in smart_crawl) ||
      !("pubmed_str" in smart_crawl.template_parse_html_tree)
    ) {
      return;
    }
    const { pubmed_str } = smart_crawl.template_parse_html_tree;
    const { g_search_key, g_create_time } = smart_crawl;

    const pubmed_fmt = pubmed_str.v2 ? pubmed_str.v2 : pubmed_str.v1;

    if (!pubmed_fmt) {
      return;
    }
    const find_value = (
      label: (typeof pubmed_fmt)["entries"][number]["label"],
    ) =>
      pubmed_fmt.entries_multiple.find((it) => it.label === label)
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
      return DataClean.is_not_blank_and_valid(line) ? line : null;
    };
    const get_issn = () => {
      const values = pubmed_fmt.entries_multiple.find((it) => it.label === "IS")
        ?.values;
      if (typeof values === "undefined" || values.length <= 0) {
        return [null, null] as const;
      }
      const issn_list = values.map((value) => {
        return DataClean.find_issn(value);
      }).filter((it) => it !== null);
      if (issn_list.length <= 0) {
        return [null, null] as const;
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
            return [issn_list[0], issn_list] as const;
          }
        }
        return [issn_list[0], issn_list] as const;
      } else {
        return [issn_list[0], issn_list] as const;
      }
    };
    const pubmed_id = find_value("PMID");
    if (!pubmed_id) {
      Errors.throw_and_format("TODO: other platform", {
        pubmed_id,
        ncbi_fmt: pubmed_fmt,
      });
    }
    const dcom = find_value("DCOM");
    const lr = find_value("LR");
    let content_text_summary = find_value("AB");
    if (content_text_summary && content_text_summary.length > 700) {
      content_text_summary = content_text_summary.substring(0, 700) +
        "...";
    }
    const [issn, issn_list] = get_issn();
    const publication_type = find_value("PT");
    const res: MediaContent = {
      last_crawl_time: Times.parse_text_to_instant(g_create_time),
      title: find_value("TI") ?? "",
      content_text_summary,
      content_text_detail: null,
      content_link_url: `https://pubmed.ncbi.nlm.nih.gov/${pubmed_id}`,
      authors: pubmed_fmt.authors.map((it) => {
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
        pubmed_fmt.entries_multiple
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
          category: publication_type,
          level_of_evidence: null,
          issn,
          isbn: null,
          publication_type,
          pui: null,
          book_publisher: null,
          cnsn: null,
          eissn: null,
          issn_list,
        },
      ],
      language: DataClean.find_languages(find_value("LA")),
    };
    yield res;
  },
};
