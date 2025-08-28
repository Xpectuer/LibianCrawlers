import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { match_metainfo } from "./match_metainfo.ts";
import { match_dump_obj } from "./match_dump_obj.ts";
import { match_pubmed_str } from "./match_pubmed_str.ts";
import { match_wanfangdata } from "./match_wanfangdata.ts";
import { match_cqvip } from "./match_cqvip.ts";
import { match_wos_journal } from "./match_wos_journal.ts";
import { match_cnki, match_cnki_journal } from "./match_cnki.ts";
import { match_qianniu_message_export } from "./match_qianniu.ts";
import { match_baidu_search_result } from "./match_baidu.ts";
import { match_github__suqingdong__impact_factord } from "./match_github__suqingdong__impact_factor.ts";
import {
  match_xhs_apilib_note,
  match_xhs_apilib_search_list,
  match_xhs_html,
} from "./match_xhs.ts";
import { match_pdd_h5_yangkeduo } from "./match_pdd.ts";
// import { match_bilibili_api_search_result } from "./match_bilibili.ts";

import { match_bilibili_video } from "./match_bilibili.ts";
import { match_gemini_deep_research } from "./match_gemini_deep_research.ts";

export interface LibianCrawlerGarbageCleaner<R> {
  match(
    garbage: LibianCrawlerGarbage,
  ): AsyncGenerator<R, void, unknown>;
}

export const libian_crawler_garbage_matchers = [
  match_metainfo,
  match_dump_obj,
  match_pubmed_str,
  match_wanfangdata,
  match_cqvip,
  match_wos_journal,
  match_cnki,
  match_cnki_journal,
  match_qianniu_message_export,
  match_baidu_search_result,
  match_github__suqingdong__impact_factord,
  match_xhs_html,
  match_xhs_apilib_search_list,
  match_xhs_apilib_note,
  match_pdd_h5_yangkeduo,
  // match_bilibili_api_search_result,
  match_bilibili_video,
  match_gemini_deep_research,
] as const;
