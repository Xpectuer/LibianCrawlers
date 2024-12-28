import { Strs } from "../util.ts";

export const to_tag = (tag: string) => {
  tag = Strs.strip_html(tag.trim()).trim();
  while (Strs.startswith(tag, "#")) {
    tag = Strs.remove_prefix(tag, "#").trim();
  }
  if (Strs.is_not_empty(tag)) {
    return tag;
  } else {
    return false;
  }
};

export function find_email() {}

export function find_phone() {}

export function find_qq_number() {}

export function find_web_url() {}

export function find_intent_url() {}
