import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { _union_types_and_optimize, fastype } from "./index.ts";
import { Jsons } from "../util.ts";

Deno.test(async function generate_type_test() {
  const inputs = [
    1,
    1,
    1,
    1,
    true,
    true,
    Infinity,
    NaN,
    2,
    3,
    -1,
    -2,
    -3,
    0,
    -0,
    "114514",
    [4, 5, 6],
    { a: 1, b: { c: { d: 114514 } }, e: [0, 1, 1, 2, 3, 2, 3, 1, 4] },
    {
      result: 114514,
    },
    {
      result: 1919810,
    },
  ];
  let i = 0;
  const t1 = await fastype({
    inputs,
    typename: "Test1",
    // deno-lint-ignore require-await
    on_top_level_input: async () => {
      console.debug("on_top_level_input", { item: inputs[i], idx: i });
      i++;
    },
    logd: true,
  });
  console.debug(t1);
});
