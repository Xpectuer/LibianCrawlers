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

      const wos_journal_slice_list: Array<Array<typeof wos_journal[number]>> =
        [];
      for (let i = 0; i < wos_journal.length; i++) {
        const item = wos_journal[i];
        if (item.title === "ID") {
          wos_journal_slice_list.push([]);
        }
        if (wos_journal_slice_list.length <= 0) {
          continue;
        }
        const wos_journal_slice =
          wos_journal_slice_list[wos_journal_slice_list.length - 1];
        wos_journal_slice.push(item);
      }

      for (
        let ii = 0;
        ii < wos_journal_slice_list.length;
        ii++
      ) {
        let issn: null | DataClean.ISSN = null;
        let eissn: null | string = null;
        let jif: null | number = null;
        let journal: null | string = null;
        for (let i = 0; i < wos_journal_slice_list[ii].length; i++) {
          const item = wos_journal[i];
          const find_content = (_i: number) => {
            if (_i + 1 >= wos_journal.length) {
              Errors.throw_and_format(
                "not found content for title , index out of range",
                {
                  wos_journal_slice_list,
                  ii,
                  wos_journal,
                  i,
                  item,
                  _i,
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
                  wos_journal_slice_list,
                  ii,
                  wos_journal,
                  i,
                  item,
                  _i,
                  content,
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
            const check_var = <T>(param: {
              err_msg: string;
              get_var: () => T;
              cast_var: (value: string | null) => T;
            }) => {
              const { err_msg, get_var, cast_var } = param;
              return ((): T => {
                const target_str = chain(() => find_content(i)).map((it) =>
                  !Strs.is_not_blank(it) ? null : it
                ).get_value();
                const target = cast_var(target_str);
                const value = get_var();
                return value === null
                  ? target
                  : target !== null && target === value
                  ? target
                  : Errors.throw_and_format(err_msg, {
                    wos_journal_slice_list,
                    ii,
                    wos_journal,
                    i,
                    item,
                    journal,
                    jif,
                    issn,
                    eissn,
                    target_str,
                    target,
                    value,
                  });
              })();
            };
            switch (item.title) {
              case "eISSN":
                eissn = check_var({
                  err_msg: "eissn already set",
                  get_var: () => eissn,
                  cast_var: (value) => value,
                });
                break;
              case "ID":
                break;
              case "ISSN":
                issn = check_var({
                  err_msg: "issn already set",
                  get_var: () => issn,
                  cast_var: (value) =>
                    !DataClean.is_not_blank_and_valid(value)
                      ? null
                      : DataClean.check_issn(value)
                      ? value
                      : Errors.throw_and_format("issn format error", {
                        wos_journal_slice_list,
                        ii,
                        wos_journal,
                        i,
                        item,
                        journal,
                        jif,
                        issn,
                        eissn,
                        value,
                      }),
                });
                break;
              case "Journal Impact Factor (JIF)":
                jif = check_var({
                  err_msg: "jif already set",
                  get_var: () => jif,
                  cast_var: (value) => {
                    const n = DataClean.is_not_blank_and_valid(value)
                      ? DataClean.parse_number(value, "allow_nan")
                      : null;
                    return n === null ? null : Nums.is_invalid(n) ? null : n;
                  },
                });
                break;
              case "Journal Title":
                journal = check_var({
                  err_msg: "journal already set",
                  get_var: () => journal,
                  cast_var: (value) => value,
                });
                break;
              case "WoS Core Citation Indexes":
                break;
              default:
                Errors.throw_and_format("unknown item title", {
                  wos_journal_slice_list,
                  ii,
                  wos_journal,
                  i,
                  item,
                  journal,
                  jif,
                  issn,
                  eissn,
                });
            }
          }
        }
        let platform_duplicate_id: string;
        if (!DataClean.is_not_blank_and_valid(journal)) {
          Errors.throw_and_format("journal name is blank", {
            wos_journal_slice_list,
            ii,
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
            wos_journal_slice_list,
            ii,
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
