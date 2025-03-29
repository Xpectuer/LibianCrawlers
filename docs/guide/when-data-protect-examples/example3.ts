// 示例: 定义类型名称以隐藏原始数据的数据结构和读取方式

// 这是代码生成后在 data_cleaner_ci/data_cleaner_ci_generated 下的私人代码
// @ts-ignore
import { MyPrivateNocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivateNocoPGLibianCrawlerGarbage.ts";
// @ts-ignore
import { MyPrivate2NocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivate2NocoPGLibianCrawlerGarbage.ts";
// @ts-ignore
import { read_MyPrivateNocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivateNocoPGLibianCrawlerGarbage_api.ts";
// @ts-ignore
import { read_MyPrivate2NocoPGLibianCrawlerGarbage } from "../data_cleaner_ci_generated/MyPrivate2NocoPGLibianCrawlerGarbage_api.ts";

// 在公共代码中使用类型别名，隐藏和封装原本的类型名。
export type LibianCrawlerGarbage =
  | MyPrivateNocoPGLibianCrawlerGarbage
  | MyPrivate2NocoPGLibianCrawlerGarbage;
export const read_LibianCrawlerGarbage = async function* (...args: any[]) {
  yield* read_MyPrivateNocoPGLibianCrawlerGarbage(...args);
  yield* read_MyPrivate2NocoPGLibianCrawlerGarbage(...args);
};
