import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  DataClean,
  Mappings,
  Streams,
  Strs,
  Times,
  Typings,
} from "../../../util.ts";
import {
  MediaContent,
  MediaContentAuthor,
  MediaSearchContext,
  PlatformEnum,
} from "../../common/media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";

export function parse_metainfo<G extends LibianCrawlerGarbage>(garbage: G) {
  if (!("metainfo" in garbage.obj.template_parse_html_tree)) {
    return null;
  }
  const { metainfo } = garbage.obj.template_parse_html_tree;
  if (!Mappings.is_not_concrete_empty(metainfo)) {
    return null;
  }

  const read_metas_property_from_metainfo = <
    M extends Typings.ReduceUnionMapping<typeof metainfo>,
    K extends string & keyof M,
  >(
    m: M | Mappings.Empty,
    key: K,
  ) => {
    let res:
      | Extract<M, { [P in K]?: unknown }>[K]
      | null = null;
    if (
      Mappings.is_not_concrete_empty(m) &&
      key in m
    ) {
      const _res = m[key];
      if (
        typeof _res === "object" &&
        Mappings.is_not_concrete_empty(_res)
      ) {
        res = _res;
      } else {
        res = null;
      }
    } else {
      res = null;
    }
    return res;
  };

  const metas = read_metas_property_from_metainfo(metainfo, "metas");
  const read_metas = <
    M extends Typings.ReduceUnionMapping<typeof metas>,
    KS extends (string & keyof Typings.ReduceUnionMapping<M>)[],
  >(
    keys: KS | Array<string>,
  ):
    | (KS[number] extends keyof Typings.ReduceUnionMapping<M>
      ? Typings.ReduceUnionMapping<M>[KS[number]]
      : string)
    | null => {
    if (typeof metas !== "object" || metas === null) {
      return null;
    }
    let res: string | null = null;
    for (const key of keys) {
      if (key in metas) {
        // deno-lint-ignore no-explicit-any
        const _k: string & keyof typeof metas = key as any;
        res = DataClean.is_not_blank_and_valid(metas[_k]) ? metas[_k] : null;
      }
      if (res !== null) {
        // deno-lint-ignore no-explicit-any
        return res as any;
      }
    }
    // deno-lint-ignore no-explicit-any
    return res as any;
  };
  const metas2 = read_metas_property_from_metainfo(metainfo, "metas2");
  const read_metas2 = <
    M extends Typings.ReduceUnionMapping<typeof metas2> =
      Typings.ReduceUnionMapping<typeof metas2>,
    KS extends (
      & string
      & keyof Typings.ReduceUnionMapping<Mappings.IsNotConcreteEmpty<M>>
    )[] = (
      & string
      & keyof Typings.ReduceUnionMapping<Mappings.IsNotConcreteEmpty<M>>
    )[],
  >(
    keys: KS | Array<string>,
    // keys: KS,
  ): // | typeof keys[number] extends
  | NonNullable<
    KS[number] extends keyof Typings.ReduceUnionMapping<M>
      ? Typings.ReduceUnionMapping<M>[KS[number]]
      : string
  >
  | null => {
    if (
      typeof metas2 !== "object" || metas2 === null ||
      !Mappings.is_not_concrete_empty(metas2)
    ) {
      return null;
    }
    let res: string | null = null;
    for (const key of keys) {
      if (key in metas2) {
        // deno-lint-ignore no-explicit-any
        const _k: string & keyof typeof metas2 = key as any;
        res = DataClean.is_not_blank_and_valid(metas2[_k]) ? metas2[_k] : null;
      }
      if (res !== null) {
        // deno-lint-ignore no-explicit-any
        return res as any;
      }
    }
    // deno-lint-ignore no-explicit-any
    return res as any;
  };
  const og_site_name = read_metas(["og:site_name", "og_site_name"]);
  const og_type = read_metas(["og:type", "og_type"]);
  const og_title = read_metas(["og:title", "og_title"]) ??
    read_metas2(["title", "twitter:title"]);
  const og_url = read_metas(["og:url", "og_url"]);
  const og_image = read_metas([
    "og:image",
    "og_image",
    "og:image:url",
  ]) ?? read_metas2(["twitter:image"]);
  const _video = read_metas(["og:video:secure_url", "og:video"]) ??
    read_metas2(["twitter:player:stream"]);
  const og_description = read_metas([
    "og:description",
    "og_description",
  ]) ?? read_metas2(["description", "twitter:description"]);
  const article_published_time = read_metas([
    "article:published_time",
    "og:article:published_time",
    "article_published_time",
  ]) ?? read_metas2(["article:published_time"]);
  const article_modified_time = read_metas([
    "article:modified_time",
    "og:article:modified_time",
    "article:modified_time",
  ]) ?? read_metas2(["article:modified_time", "last_updated_date" as never]);
  const article_section = read_metas([
    "article:section",
    "article_section",
  ]) ?? read_metas2(["article:section"]);
  const article_authors = read_metas(["og:article:author"]) ??
    read_metas2(["og_author" as never]);
  const article_tag = read_metas(["og:article:tag"]) ??
    read_metas2(["article:tag"]);

  const xhs_note_like = read_metas2(["og:xhs:note_like"]);
  const xhs_note_comment = read_metas2(["og:xhs:note_comment"]);
  const xhs_note_collect = read_metas2(["og:xhs:note_collect"]);
  const og_profile_acct = read_metas2(["og-profile-acct"]); // "og-profile-acct"

  let html2markdown: string | null;
  if ("html2markdown" in metainfo) {
    html2markdown = Strs.is_not_blank(metainfo.html2markdown)
      ? metainfo.html2markdown
      : null;
  } else {
    html2markdown = null;
  }
  const content_text_detail = html2markdown !== null && og_description !== null
    ? `${og_description}\n\n${html2markdown}`
    : html2markdown;
  const content_link_url = og_url
    ? DataClean.url_use_https_noempty(og_url)
    : null;
  const create_time = article_published_time
    ? Times.parse_text_to_instant(article_published_time, {
      allow_null: true,
    })
    : null;
  const update_time = article_modified_time
    ? Times.parse_text_to_instant(article_modified_time, {
      allow_null: true,
    })
    : null;
  let authors: MediaContentAuthor[];
  if (DataClean.is_not_blank_and_valid(article_authors)) {
    if (
      Strs.startswith(article_authors, "http://") ||
      Strs.startswith(article_authors, "https://")
    ) {
      const author_url = DataClean.url_use_https_noempty(article_authors);
      const last_path = Arrays.last_or_null(
        new URL(author_url).pathname.split("/"),
      );
      if (Strs.is_not_blank(last_path)) {
        authors = [
          {
            nickname: last_path.replaceAll("-", " ").replaceAll("_", " "),
            platform_user_id: `html_head_meta_article_author_${last_path}`,
            avater_url: null,
            home_link_url: author_url,
          },
        ];
      } else {
        authors = [];
      }
    } else {
      authors = article_authors.split(",")
        .map((article_author) => article_author.trim())
        .filter((article_author) =>
          DataClean.is_not_blank_and_valid(article_author)
        )
        .map((article_author) => {
          return {
            nickname: article_author,
            platform_user_id: `html_head_meta_article_author_${article_author}`,
            avater_url: null,
            home_link_url: null,
          };
        });
    }
  } else {
    authors = [];
  }
  let video_url: DataClean.HttpUrl | null = null;
  if (
    Strs.is_not_blank(_video) &&
    (Strs.startswith(_video, "http://") ||
      Strs.startswith(_video, "https://"))
  ) {
    video_url = DataClean.url_use_https_noempty(_video);
  }
  return {
    og_site_name,
    og_type,
    og_title,
    og_url,
    og_image,
    _video,
    og_description,
    article_published_time,
    article_modified_time,
    article_section,
    article_authors,
    article_tag,
    xhs_note_like,
    xhs_note_comment,
    xhs_note_collect,
    html2markdown,
    content_text_detail,
    content_link_url,
    create_time,
    update_time,
    authors,
    video_url,
    og_profile_acct,
  };
}
