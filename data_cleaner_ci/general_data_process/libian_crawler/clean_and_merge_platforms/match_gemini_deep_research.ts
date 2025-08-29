import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  chain,
  DataClean,
  Errors,
  is_nullish,
  Mappings,
  Nums,
  Streams,
  Strs,
  Times,
} from "../../../util.ts";
import { MediaContent, PlatformEnum } from "../../common/media.ts";
import { Literature } from "../../common/literature.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";
import { Paragraphs } from "../../common/paragraph_analysis.ts";

export const match_gemini_deep_research: LibianCrawlerGarbageCleaner<
  MediaContent
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    const { template_parse_html_tree, g_content } = smart_crawl;
    const crawl_time = Times.parse_text_to_instant(
      smart_crawl.g_create_time,
    );
    if (
      !("gemini_deep_research" in template_parse_html_tree &&
        template_parse_html_tree.gemini_deep_research)
    ) {
      return;
    }

    const { docs, messages, title_checked } =
      template_parse_html_tree.gemini_deep_research;

    if (!Strs.is_not_blank(title_checked)) {
      return;
    }

    if (
      !(
        Strs.is_not_blank(docs.md) ||
        Strs.is_not_blank(docs.web_preview_html) ||
        messages && messages.length > 0
      )
    ) {
      return;
    }
    const url = "dump_page_info" in g_content
      ? g_content.dump_page_info?.page_info_smart_wait
        ?.url.url
      : null;
    let content_link_url_str = "";
    let platform_duplicate_id = "";
    if (Strs.is_not_blank(url)) {
      const match_res = url.match(
        /https:\/\/gemini\.google\.com\/app\/([a-zA-Z0-9]+)/,
      );
      if (match_res) {
        content_link_url_str = match_res[0];
        platform_duplicate_id = match_res[1];
      }
    }
    const content_link_url =
      DataClean.is_not_blank_and_valid(content_link_url_str)
        ? DataClean.url_use_https_emptyable(content_link_url_str)
        : null;
    if (!Strs.is_not_blank(platform_duplicate_id)) {
      return;
    }
    if (!Strs.is_not_blank(content_link_url)) {
      Errors.throw_and_format("missing url", {
        platform_duplicate_id,
        content_link_url_str,
      });
    }

    let create_time: Temporal.Instant | null = null;
    let create_time_text: string | string[] | null | undefined = null;
    let first_user_query = "";
    let content_text_detail = "";
    if (messages) {
      for (const msg of Arrays.is_array(messages) ? messages : [messages]) {
        if (msg.user_query) {
          if (!DataClean.is_not_blank_and_valid(first_user_query)) {
            first_user_query = msg.user_query;
          }
          content_text_detail += `\n\n**User** :\n\n${msg.user_query}`;
        }
        if (
          msg.model_responses && msg.model_responses.elements &&
          msg.model_responses.elements.length > 0
        ) {
          const model_resp_str_elements = msg.model_responses.elements.map(
            (it) => {
              if (is_nullish(it.str)) {
                return false;
              }
              const str2 = Arrays.is_array(it.str)
                ? it.str.join("\n\n")
                : it.str;
              if (!DataClean.is_not_blank_and_valid(str2)) {
                return false;
              }
              const id = Strs.is_not_blank(it.id) ? it.id : null;
              const datatestid = Strs.is_not_blank(it.datatestid)
                ? it.datatestid
                : null;
              let creation_timestamp: string | null = null;
              let id_prefix: string | null = null;
              if (id) {
                if (id.startsWith("model-response-message-contentr")) {
                  return false;
                }
                if (id === "creation-timestamp") {
                  creation_timestamp = str2;
                }
                id_prefix = id;
              }
              if (datatestid) {
                if (
                  datatestid.indexOf("-button") >= 0 ||
                  datatestid === "container"
                ) {
                  return false;
                }
                id_prefix = datatestid;
              }
              return {
                id,
                datatestid,
                str2,
                creation_timestamp,
                id_prefix,
              } as const;
            },
          ).filter((it) => it !== false);
          if (model_resp_str_elements.length > 0) {
            content_text_detail += `\n\n**LLM** :`;
            for (const el of model_resp_str_elements) {
              if (el.creation_timestamp) {
                create_time_text = el.creation_timestamp;
              }
              if (el.str2) {
                if (el.id_prefix) {
                  content_text_detail += `\n\n> ${el.id_prefix}`;
                }
                content_text_detail += `\n\n${el.str2}`;
              }
            }
          }
        }
      }
    }
    if (Arrays.is_array(create_time_text)) {
      create_time_text = create_time_text[0];
    }
    create_time_text = create_time_text?.trim();
    if (Strs.is_not_blank(create_time_text)) {
      create_time = Times.parse_text_to_instant(create_time_text, {
        attach_year: [
          Times.instant_to_date(crawl_time).getFullYear(),
          {
            on_exist: "use_exist",
          },
        ],
      });
    }

    let attach_doc_id = "";
    let attach_doc_content_md = "";
    if (
      DataClean.is_not_blank_and_valid(docs.title_text) &&
      (DataClean.is_not_blank_and_valid(docs.md) ||
        DataClean.is_not_blank_and_valid(docs.web_preview_html))
    ) {
      attach_doc_id = docs.title_text;
      if (DataClean.is_not_blank_and_valid(docs.md)) {
        attach_doc_content_md += `# ${docs.title_text}\n\n${docs.md}\n`;
      } else if (DataClean.is_not_blank_and_valid(docs.web_preview_html)) {
        attach_doc_content_md +=
          `# ${docs.title_text}\n\n\`\`\`html\n${docs.web_preview_html}\n\`\`\`\n`;
      }
    }
    const attach_docs: MediaContent["attach_docs"] = [];
    if (
      DataClean.is_not_blank_and_valid(attach_doc_id) &&
      DataClean.is_not_blank_and_valid(attach_doc_content_md)
    ) {
      attach_docs.push({
        id: attach_doc_id,
        content_md: attach_doc_content_md,
      });
    }

    // Times.parse_text_to_instant()

    const res: MediaContent = {
      last_crawl_time: crawl_time,
      title: title_checked,
      content_text_summary: null,
      content_text_detail,
      content_link_url,
      authors: [],
      platform: PlatformEnum.GoogleGemini,
      platform_duplicate_id,
      platform_rank_score: null,
      count_read: null,
      count_like: null,
      count_star: null,
      video_total_count_danmaku: null,
      video_total_duration_sec: null,
      tags: null,
      create_time,
      update_time: null,
      cover_url: null,
      videos: null,
      from_search_context: [
        ...(
          DataClean.is_not_blank_and_valid(first_user_query)
            ? [
              {
                question: first_user_query,
              },
            ]
            : []
        ),
      ],
      ip_location: null,
      count_share: null,
      count_comment: null,
      literatures: null,
      language: null,
      attach_docs,
    };
    yield res;
  },
};
