import { ICache } from "../caches.ts";
import { LibianCrawlerCleanAndMergeUtil } from "./clean_and_merge_util.ts";

export async function create_reducers_and_init() {
  const media_content = LibianCrawlerCleanAndMergeUtil
    .create_reducer_for_media_content();
  const shop_good = LibianCrawlerCleanAndMergeUtil
    .create_reducer_for_shop_good();
  const chat_message = LibianCrawlerCleanAndMergeUtil
    .create_reducer_for_chat_message();
  const literature = LibianCrawlerCleanAndMergeUtil
    .create_reducer_for_literature();

  function create_context_of_insert_or_update_reduced_data<
    Prev,
    Cur,
  >(params: {
    tag_text: string;
    reducer: AsyncGenerator<
      undefined,
      readonly [Set<string>, ICache<string, Prev>] | undefined,
      Cur | "stop"
    >;
    insert_or_update: LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<
      Prev
    >;
  }) {
    const { tag_text, reducer, insert_or_update } = params;
    return {
      tag_text,
      stop: async () => {
        const reduced_result = await reducer.next("stop");
        // const res = reducer.return
        if (!reduced_result.done || !reduced_result.value) {
          throw new Error(
            `Generator should return after pass "stop" to it , but reduced_result.done=${reduced_result.done}, params.tag_text=${params.tag_text}, reduced_result.value=${reduced_result.value}`,
          );
        }
        const [all_key, cache] = reduced_result.value;
        return {
          all_key,
          cache,
        };
      },
      insert_or_update: async (
        db: Parameters<
          LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
        >[0],
        values: Parameters<
          LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
        >[1],
        options: Parameters<
          LibianCrawlerCleanAndMergeUtil.InsertOrUpdateProvider<Prev>
        >[2],
      ) => {
        try {
          return await insert_or_update(db, values, options);
        } catch (err) {
          throw new Error(`Insert or update failed`, {
            cause: err,
          });
        }
      },
    };
  }

  //  create_context_of_insert_or_update_reduced_data
  const reducers = [
    (() => {
      const r = {
        tag_text: "media_content",
        ...media_content,
        insert_or_update: LibianCrawlerCleanAndMergeUtil
          .insert_or_update_media_content,
      };
      return {
        ...r,
        db_ctx: create_context_of_insert_or_update_reduced_data(r),
      };
    })(),
    (() => {
      const r = {
        tag_text: "shop_good",
        ...shop_good,
        insert_or_update: LibianCrawlerCleanAndMergeUtil
          .insert_or_update_shop_good,
      };
      return {
        ...r,
        db_ctx: create_context_of_insert_or_update_reduced_data(r),
      };
    })(),
    (() => {
      const r = {
        tag_text: "chat_message",
        ...chat_message,
        insert_or_update: LibianCrawlerCleanAndMergeUtil
          .insert_or_update_chat_message,
      };
      return {
        ...r,
        db_ctx: create_context_of_insert_or_update_reduced_data(r),
      };
    })(),
    (() => {
      const r = {
        tag_text: "literature",
        ...literature,
        insert_or_update: LibianCrawlerCleanAndMergeUtil
          .insert_or_update_literature,
      };
      return {
        ...r,
        db_ctx: create_context_of_insert_or_update_reduced_data(r),
      };
    })(),
  ] as const;

  await Promise.all(
    reducers.map((it) => it.reducer.next()),
  );

  return {
    reducers,
    media_content,
    shop_good,
    chat_message,
    literature,
  } as const;
}
