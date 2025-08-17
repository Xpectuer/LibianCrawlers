import { assertEquals } from "@std/assert/equals";
import { LibianCrawlerCleanAndMergeUtil } from "./clean_and_merge_util.ts";
import {
  aid2bvid,
  bvid2aid,
} from "./clean_and_merge_platforms/match_bilibili.ts";

Deno.test(function xhs_regexp_test() {
  console.debug(
    "get xiaohongshu note id",
    /xiaohongshu\.com\/explore\/([a-zA-Z0-9]+)/.exec(
      "https://www.xiaohongshu.com/explore/673dfc49000000000201b6f9?xsec_token=AB0bZUpoclWPCupj6GqcXQ-kG_kFQZ8UrT5lBQtRvBKJU=&xsec_source=pc_feed&source=web_explore_feed#comment-674a65a7000000001b025b27",
    ),
  );
});

Deno.test(function find_embase_search_query_exp_test() {
  assertEquals(
    LibianCrawlerCleanAndMergeUtil.find_embase_search_query_exp(
      "('pulmonary hypertension'/exp OR 'pulmonary hypertension') AND [01-04-2025]/sd NOT [01-01-2026]/sd",
    ),
    "pulmonary hypertension",
  );
});

Deno.test(function aid2bvid_test() {
  for (
    const { aid, bvid } of [
      {
        aid: 7,
        bvid: "BV1xx411c7m9",
      },
      {
        aid: 114986760281431,
        bvid: "BV1rdtizZEDE",
      },
    ] as const
  ) {
    assertEquals(
      aid2bvid(aid),
      bvid,
    );
    assertEquals(
      bvid2aid(bvid),
      aid,
    );
    console.debug("matched", { aid, bvid });
  }
});
