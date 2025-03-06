import { DataClean } from "../util.ts";
import { PlatformEnum } from "./media.ts";

export interface ShopGood {
  platform: PlatformEnum;
  platform_duplicate_id: string;
  //   create_time: Date | null;
  //   update_time: Date | null;
  //   count_good_buy: DataClean.NaturalNumber | null;
  //   count_good_want: DataClean.NaturalNumber | null;
  //   count_good_comment: DataClean.NaturalNumber | null;
  good_id: string | number;
  good_name: string;
  shop_id: string | number;
  shop_name: string;
  search_from: Set<string>;
  good_images: {
    url: DataClean.HttpUrl;
    width: number;
    height: number;
    id: string | number | null;
    gifurl: DataClean.HttpUrl | null;
  }[];
  sku_list: {
    sku_id: string | number;
    pic_url: DataClean.HttpUrl;
    desc: string;
    price_display_cny_unit001: DataClean.NaturalNumber | null;
    label: string;
  }[];
  //   good_image_file_ids: PostgresColumnType.JSON<string[]>;
}
