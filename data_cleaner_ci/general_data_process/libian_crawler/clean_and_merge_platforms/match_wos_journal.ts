import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { chain, DataClean, Errors, Nums, Strs, Times } from "../../../util.ts";
import { Literature } from "../../literature.ts";
import { PlatformEnum } from "../../media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_wos_journal: LibianCrawlerGarbageCleaner<
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
      "wos_journal" in template_parse_html_tree &&
      Array.isArray(template_parse_html_tree.wos_journal) &&
      template_parse_html_tree.wos_journal.length > 0
    ) {
      const wos_journal = template_parse_html_tree.wos_journal;
      let issn: null | DataClean.ISSN = null;
      let eissn: null | string = null;
      let jif: null | number = null;
      let journal: null | string = null;
      for (
        let i = 0;
        i < wos_journal.length;
        i++
      ) {
        const item = wos_journal[i];
        const find_content = (_i: number) => {
          if (_i + 1 >= wos_journal.length) {
            Errors.throw_and_format(
              "not found content for title , index out of range",
              {
                item,
                _i,
                wos_journal,
                journal,
                jif,
                issn,
                eissn,
              },
            );
          }
          const content = wos_journal[_i + 1];
          if (!content.is_content || content.content === null) {
            if (content.is_title) {
              // The content str is blank
              i = _i;
              return null;
            }
            Errors.throw_and_format(
              "not found content for title , i+1 item not a content element",
              {
                item,
                content,
                _i,
                wos_journal,
                journal,
                jif,
                issn,
                eissn,
              },
            );
          }
          i = _i + 1;
          return content.content;
        };
        if (item.title) {
          switch (item.title) {
            case "eISSN":
              eissn = eissn !== null
                ? Errors.throw_and_format("eissn already set", {
                  item,
                  wos_journal,
                  journal,
                  jif,
                  issn,
                  eissn,
                })
                : chain(() => find_content(i)).map((it) =>
                  !Strs.is_not_blank(it) ? null : it
                ).get_value();
              break;
            case "ID":
              break;
            case "ISSN":
              issn = issn !== null
                ? Errors.throw_and_format("issn already set", {
                  item,
                  wos_journal,
                  journal,
                  jif,
                  issn,
                  eissn,
                })
                : chain(() => find_content(i)).map((it) =>
                  !Strs.is_not_blank(it)
                    ? null
                    : DataClean.check_issn(it)
                    ? it
                    : null
                ).get_value();
              break;
            case "Journal Impact Factor (JIF)":
              jif = jif !== null
                ? Errors.throw_and_format("jif already set", {
                  item,
                  wos_journal,
                  journal,
                  jif,
                  issn,
                  eissn,
                })
                : chain(() => find_content(i)).map((it) =>
                  !Strs.is_not_blank(it)
                    ? null
                    : DataClean.parse_number(it, "allow_nan")
                )
                  .map((it) =>
                    it === null ? null : Nums.is_invalid(it) ? null : it
                  )
                  .get_value();
              break;
            case "Journal Title":
              journal = journal !== null
                ? Errors.throw_and_format("journal already set", {
                  item,
                  wos_journal,
                  journal,
                  jif,
                  issn,
                  eissn,
                })
                : chain(() => find_content(i)).map((it) =>
                  !Strs.is_not_blank(it) ? null : it
                ).get_value();
              break;
            case "WoS Core Citation Indexes":
              break;
            default:
              Errors.throw_and_format("unknown item title", {
                item,
                wos_journal,
                journal,
                jif,
                issn,
                eissn,
              });
          }
        }
      }
      let platform_duplicate_id: string;
      if (!Strs.is_not_blank(journal)) {
        Errors.throw_and_format("journal name is blank", {
          wos_journal,
          journal,
          jif,
          issn,
          eissn,
        });
      }
      if (issn !== null) {
        platform_duplicate_id = LibianCrawlerCleanAndMergeUtil
          .get_literature_duplicated_id({ issn });
      } else if (eissn !== null) {
        platform_duplicate_id = LibianCrawlerCleanAndMergeUtil
          .get_literature_duplicated_id({ eissn });
      } else {
        Errors.throw_and_format("issn and eissn both null", {
          wos_journal,
          journal,
          jif,
          issn,
          eissn,
        });
      }
      const res: Literature = {
        platform: PlatformEnum.文献,
        last_crawl_time: Times.parse_text_to_instant(
          smart_crawl.g_create_time,
        ),
        platform_duplicate_id,
        crawl_from_platform: PlatformEnum.wos_journal,
        title: journal,
        languages: [],
        create_year: null,
        international_standard_serial_number: issn,
        international_standard_book_number: null,
        china_standard_serial_number: null,
        publication_organizer: null,
        publication_place: null,
        keywords: [],
        count_published_documents: null,
        count_download_total: null,
        count_citations_total: null,
        impact_factor_latest: jif === null
          ? null
          : Nums.is_invalid(jif) || jif < 0
          ? null
          : jif,
        eissn,
      };
      yield {
        __mode__: "literature" as const,
        ...res,
      };
    }
  },
};
