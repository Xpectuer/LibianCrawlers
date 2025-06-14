/**
 * 此文件存放一些处理文字段落内容的工具。
 */
import { DataClean, Strs } from "../util.ts";

// deno-lint-ignore no-namespace
export namespace Paragraphs {
  export function to_tag(tag: string) {
    tag = DataClean.strip_html(tag.trim()).trim();
    while (Strs.startswith(tag, "#")) {
      tag = Strs.remove_prefix(tag, "#").trim();
    }
    if (Strs.is_not_blank(tag)) {
      return tag;
    } else {
      return false;
    }
  }

  export function find_email() {}

  export function find_phone() {}

  export function find_qq_number() {}

  export function find_wechat() {}

  export function find_web_url() {}

  export function find_intent_url() {}

  export function find_and_clean_tags_in_text(text: string) {
    const tags: string[] = [];
    const text_cleaned = text.replaceAll(/#([^\s]*?)\[话题\]#/g, (_i, tag) => {
      tags.push(tag);
      return "";
    });
    return {
      tags,
      text_cleaned,
    };
  }

  export function* find_languages_in_text(text: string) {
    if (text.indexOf("中文") >= 0) {
      yield "Chinese" as const;
    }
    if (text.indexOf("英文") >= 0) {
      yield "English" as const;
    }
  }
}
