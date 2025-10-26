import { LibianCrawlerGarbage } from "../../user_code/LibianCrawlerGarbage.ts";
import { is_nullish } from "../../util.ts";
import { MediaContent } from "../common/media.ts";
import { LibianCrawlerGarbageCleaner } from "../libian_crawler/clean_and_merge_platforms/index.ts";

export type MediaCrawlerYield = MediaCrawlerYieldMediaContent;

export type MediaCrawlerYieldMediaContent = MediaContent & {
  __is_media_crawler_yield_media_content__: true;
};

export function is_media_crawler_yield_media_content(
  o: unknown,
): o is MediaCrawlerYieldMediaContent {
  if (
    !is_nullish(o) && typeof o === "object" &&
    "__is_media_crawler_yield_media_content__" in o &&
    o.__is_media_crawler_yield_media_content__ === true
  ) {
    return true;
  } else {
    return false;
  }
}

export const match_media_crawler_sqlite: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    if (is_media_crawler_yield_media_content(garbage)) {
      yield garbage;
    }
  },
};
