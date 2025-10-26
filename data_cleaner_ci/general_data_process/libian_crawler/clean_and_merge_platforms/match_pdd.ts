import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import {
  Arrays,
  chain,
  DataClean,
  is_nullish,
  Nums,
  Strs,
  Times,
} from "../../../util.ts";
import { PlatformEnum } from "../../common/media.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";
import { ShopGood } from "../../common/shop_good.ts";

export const match_pdd_h5_yangkeduo: LibianCrawlerGarbageCleaner<
  ShopGood
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    if (!("obj" in garbage) || is_nullish(garbage.obj)) {
      return;
    }
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    const { template_parse_html_tree } = smart_crawl;
    if (
      template_parse_html_tree.yangkeduo &&
      template_parse_html_tree.yangkeduo.window_raw_data_eval &&
      template_parse_html_tree.yangkeduo.window_raw_data_eval.success &&
      template_parse_html_tree.yangkeduo.window_raw_data_eval.stdout_json
    ) {
      const { store } = template_parse_html_tree.yangkeduo.window_raw_data_eval
        .stdout_json;
      const { goods, mall } = store.initDataObj;
      const activity = "activity" in goods ? goods.activity ?? null : null;
      const create_time = Nums.take_extreme_value("min", [
        Times.parse_instant(activity?.startTime),
        Times.parse_instant(smart_crawl.g_create_time),
        Temporal.Now.instant(),
      ]);
      const update_time = Nums.take_extreme_value("max", [
        create_time,
        Times.parse_instant(activity?.startTime ?? null),
        Times.parse_instant(store.initDataObj.goods.nowTime),
      ]);
      const res: ShopGood = {
        platform: PlatformEnum.拼多多h5yangkeduo,
        platform_duplicate_id: `goodsid_${goods.goodsID}`,
        create_time,
        update_time,
        good_id: goods.goodsID,
        good_name: goods.goodsName,
        shop_id: goods.mallID,
        shop_name: mall.mallName,
        search_from: new Set([
          ...(store.initDataObj.queries._x_query
            ? [store.initDataObj.queries._x_query]
            : []),
        ]),
        good_images: goods.detailGallery.map((it) => {
          const gifUrl = "gifUrl" in it
            ? it.gifUrl
            : "gif_url" in it
            ? it.gif_url
            : undefined;
          return {
            url: DataClean.url_use_https_noempty(it.url),
            width: it.width,
            height: it.height,
            gifurl: DataClean.url_use_https_emptyable(gifUrl) ?? null,
            id: chain(() => ("id" in it ? it.id : null))
              .map((d) => (typeof d === "number" ? `${d}` : null))
              .get_value(),
          };
        }),
        sku_list: goods.skus.map((sku) => {
          return {
            sku_id: sku.skuId,
            pic_url: DataClean.url_use_https_noempty(sku.thumbUrl),
            desc: sku.specs
              .map((spec) => `${spec.spec_key}:${spec.spec_value}`)
              .join(";"),
            price_display_cny_unit001: Arrays.first_or_null(
              (
                [
                  ["skuPrice" in sku ? sku.skuPrice : null, 1],
                  [
                    "priceDisplay" in sku ? sku.priceDisplay?.price : null,
                    100,
                  ],
                  [sku.groupPrice, 100],
                  [sku.normalPrice, 100],
                  [sku.normalSavePrice, 100],
                  [sku.price, 100],
                  [sku.marketPrice, 100],
                ] as const
              )
                .map(([v, mul]) =>
                  v !== undefined && v !== null
                    ? ([
                      DataClean.parse_number(v, "allow_nan"),
                      mul,
                    ] as const)
                    : null
                )
                .filter((it) => it !== null)
                .filter((it) => !Nums.is_invalid(it[0]) && it[0] > 0)
                .map(([v, mul]) =>
                  DataClean.cast_and_must_be_natural_number(
                    DataClean.parse_number((v * mul).toFixed(3)),
                  )
                ),
            ),
            label: "sideCarLabels" in sku
              ? sku.sideCarLabels
                ?.map((it) => it.text)
                .filter((it) => DataClean.is_not_blank_and_valid(it))
                .join(";") ?? ""
              : "",
          };
        }),
        link_url:
          `https://mobile.yangkeduo.com/goods.html?goods_id=${goods.goodsID}`,
      };
      yield res;
    }
  },
};
