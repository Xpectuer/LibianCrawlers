import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { DataClean, Nums, Times } from "../../../util.ts";
import { Literature } from "../../literature.ts";
import { PlatformEnum } from "../../media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export const match_github__suqingdong__impact_factord:
  LibianCrawlerGarbageCleaner<
    Literature & {
      __mode__: "literature";
    }
  > = {
    match: async function* (
      garbage: LibianCrawlerGarbage,
    ) {
      if (
        "group__github__suqingdong__impact_factor_search_result__github__suqingdong__impact_factor" in
          garbage &&
        garbage[
          "group__github__suqingdong__impact_factor_search_result__github__suqingdong__impact_factor"
        ]
      ) {
        const { g_content, g_create_time } = garbage[
          "group__github__suqingdong__impact_factor_search_result__github__suqingdong__impact_factor"
        ];
        for (const item of g_content.result.obj) {
          const issn = DataClean.find_issn(item.issn);
          if (issn === null) {
            console.warn("Missing issn", { item });
            continue;
          }
          const res: Literature = {
            platform: PlatformEnum.文献,
            last_crawl_time: Times.parse_text_to_instant(g_create_time),
            platform_duplicate_id: LibianCrawlerCleanAndMergeUtil
              .get_literature_duplicated_id({ issn }),
            crawl_from_platform: PlatformEnum.lib_impact_factor,
            title: item.journal,
            languages: [],
            create_year: null,
            international_standard_serial_number: issn,
            international_standard_book_number: null,
            china_standard_serial_number: null,
            publication_organizer: item.journal_abbr,
            publication_place: null,
            keywords: [],
            count_published_documents: null,
            count_download_total: null,
            count_citations_total: null,
            impact_factor_latest:
              Nums.is_invalid(item.factor) || item.factor < 0
                ? null
                : item.factor,
            eissn: item.eissn,
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
