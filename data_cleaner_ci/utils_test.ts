import {
  DataClean,
  is_deep_equal,
  Mappings,
  Nums,
  Strs,
  Times,
} from "./util.ts";
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { MultiProgressBar } from "jsr:@deno-library/progress";
import { delay } from "jsr:@std/async";
import { parseChineseNumber } from "parse-chinese-number";

Deno.test(function strsTest() {
  const a = "helloworld1" as string;
  if (Strs.startswith(a, "hello")) {
    assertEquals("world1", Strs.remove_prefix(a, "hello"));
  }
  const b = "hello2world" as string;
  if (Strs.endswith(b, "world")) {
    assertEquals("hello2", Strs.remove_suffix(b, "world"));
  }
  for (const idx in Strs.empty_chars) {
    const empty_char = Strs.empty_chars[idx];
    console.log(
      `empty_strings[${idx}] (u${Strs.to_unicode(empty_char)}) is`,
      empty_char
    );
    assertEquals(Strs.is_not_blank(empty_char), false);
  }
});

Deno.test(function parseNumberTest() {
  assertEquals(parseChineseNumber("一百五十"), 150);
  assertEquals(parseChineseNumber("一百五"), 150);
  assertEquals(parseChineseNumber("一百零五"), 105);
  assertEquals(parseChineseNumber("无效"), undefined);
  assertEquals(parseChineseNumber("1.5亿"), undefined);
  assertEquals(!!/^[a-zA-Z\s]+$/.exec("one hundred"), true);
  assertEquals(!!/^[a-zA-Z\s]+$/.exec("100 hundred"), false);

  for (const [t, n] of [
    ["1000", 1000],
    [114514, 114514],
    ["114514.1919810", 114514.191981_0],
    ["-114514.1919810", -114514.191981_0],
    ["--114514.1919810", NaN],
    ["1.5万", 15000],
    ["-1.5万", -15000],
    ["负1.5万", -15000],
    ["1.5亿", 150000000],
    ["一点五亿", 150000000],
    ["一个亿", 100000000],
    ["十万亿", 100000_00000000],
    ["一点五", 1.5],
    ["负一点五", -1.5],
    ["1919.8.10", NaN],
    ["1919-8-10", NaN],
    ["one", 1],
    ["one hundred", 100],
    ["1 hundred", NaN],
  ]) {
    assertEquals(
      DataClean.parse_number(t, "allow_nan", null, (it) => console.debug(it)),
      n
    );
    console.debug("-----------------------");
    // assertEquals(DataClean.parse_number(t, "allow_nan"), n);
  }
});

Deno.test(function stripHtmlTest() {
  for (const [t, r] of [
    ["你好世界", "你好世界"],
    [`<div v-if="value>123" >hello <b>world</b></div>`, "hello world"],
    [`<div v-if="value>123" >hello<b>world</b></div>`, "helloworld"],
    [`<div v-if="value>123" >hello <b> world </b> </div>`, "hello  world  "],
  ]) {
    console.info("strip html result", DataClean.strip_html(t));
    assertEquals(r, DataClean.strip_html(t));
  }
});

Deno.test(function omitTest() {
  const r1 = Mappings.filter_keys({ a: 1, b: 2, c: 3, d: 4 } as const, "omit", [
    "a",
    "c",
  ]);
  assertEquals(r1["b"].valueOf(), 2);
  assertEquals(r1, {
    b: 2,
    d: 4,
  });
  const r2 = Mappings.filter_keys({ a: 1, b: 2, c: 3, d: 4 } as const, "pick", [
    "c",
    "d",
  ]);
  assertEquals(r2, { c: 3, d: 4 });
});

Deno.test(async function progress_bar_template_case() {
  // or JSR (with version)
  // import { MultiProgressBar } from "jsr:@deno-library/progress@1.5.1";
  // import { delay } from "jsr:@std/async@0.221.0";

  // or JSR (no prefix, run `deno add @deno-library/progress` and `deno add @std/async`)
  // import { MultiProgressBar } from "@deno-library/progress";
  // import { delay } from "@std/async";

  // or
  // import { MultiProgressBar } from "https://deno.land/x/progress@v1.5.1/mod.ts";
  // import { delay } from "https://deno.land/std@0.220.1/async/delay.ts";

  const title = "download files";
  const total = 100;

  const bars = new MultiProgressBar({
    title,
    // clear: true,
    complete: "=",
    incomplete: "-",
    display: "[:bar] :text :percent :time :completed/:total",
  });

  let completed1 = 0;
  let completed2 = 0;

  async function download() {
    while (completed1 <= total || completed2 <= total) {
      completed1 += 1;
      completed2 += 2;
      await bars.render([
        {
          completed: completed1,
          total,
          text: "file1",
          complete: "*",
          incomplete: ".",
        },
        { completed: completed2, total, text: "file2" },
      ]);

      await delay(50);
    }
  }

  await download();
});

Deno.test(function get_proto_chain_test() {
  function getPrototypeChain(obj: any) {
    let prototypeChain = [];
    (function innerRecursiveFunction(obj) {
      let currentPrototype = obj != null ? Object.getPrototypeOf(obj) : null;
      prototypeChain.push(currentPrototype);
      if (currentPrototype != null) {
        innerRecursiveFunction(currentPrototype);
      }
    })(obj);
    return prototypeChain;
  }

  console.debug("a", getPrototypeChain(new Date()));
});

Deno.test(function is_deep_equal_test() {
  assert(!is_deep_equal(new Date(10000), new Date(200000)));
});

Deno.test(function is_deep_equal_test_2() {
  for (const [should_eq, a, b] of [
    [true, 3, 3],
    [false, 3, 4],
    [true, null, null],
    [true, undefined, undefined],
    [true, NaN, NaN],
    [true, new Date(0), new Date("Thu Jan 01 1970 08:00:00 GMT+0800")],
    [false, new Date(100), new Date("Thu Jan 01 1970 08:00:00 GMT+0800")],
    [false, new Date(10000), new Date("Thu Jan 01 1970 08:00:00 GMT+0800")],
    [false, NaN, null],
    [false, NaN, undefined],
    [false, NaN, 0],
    [false, NaN, ""],
    [false, null, undefined],
    [false, null, 0],
    [false, null, ""],
    [false, undefined, 0],
    [false, undefined, ""],
    [false, 0, ""],
    [
      true,
      [1, 2, 3, { 4: "four", 5: "five" }, [6]],
      [1, 2, 3, { 5: "five", 4: "four" }, [6]],
    ],
    [
      true,
      {
        create_time: new Date("2024-07-11 00:55:25+00"),
        update_time: new Date("2024-07-09 06:22:39+00"),
      },
      {
        create_time: new Date("2024-07-11 00:55:25+00"),
        update_time: new Date("2024-07-09 06:22:39+00"),
      },
    ],
    [
      false,
      {
        create_time: new Date("2024-07-11 00:55:25+00"),
        update_time: new Date("2024-07-09 06:22:39+00"),
      },
      {
        create_time: new Date("2024-07-09 06:22:39+00"),
        update_time: new Date("2024-07-11 00:55:25+00"),
      },
    ],
    // [
    //   true,
    //   {
    //     create_time: Times.parse_text_to_instant("2024-07-11 00:55:25+00"),
    //     update_time: Times.parse_text_to_instant("2024-07-09 06:22:39+00"),
    //   },
    //   {
    //     create_time: Times.parse_text_to_instant("2024-07-11 00:55:25+00"),
    //     update_time: Times.parse_text_to_instant("2024-07-09 06:22:39+00"),
    //   },
    // ],
    // [
    //   false,
    //   {
    //     create_time: Times.parse_text_to_instant("2024-07-11 00:55:25+00"),
    //     update_time: Times.parse_text_to_instant("2024-07-09 06:22:39+00"),
    //   },
    //   {
    //     create_time: Times.parse_text_to_instant("2024-07-09 06:22:39+00"),
    //     update_time: Times.parse_text_to_instant("2024-07-11 00:55:25+00"),
    //   },
    // ],
  ] as const) {
    console.debug("Test is_deep_equal", { a, b });
    assert(
      should_eq === is_deep_equal(a, b),
      `${a}(jsonfiy: ${JSON.stringify(a)}) should ${
        should_eq ? "" : "not "
      }eq ${b}(jsonfiy: ${JSON.stringify(b)})`
    );
    assert(
      should_eq === is_deep_equal(b, a),
      `${b}(jsonfiy: ${JSON.stringify(b)}) should ${
        should_eq ? "" : "not "
      }eq ${a}(jsonfiy: ${JSON.stringify(a)})`
    );
  }
});

Deno.test(function require_natural_number_test() {
  assertEquals(
    BigInt(114514),
    DataClean.cast_and_must_be_natural_number(114514)
  );

  // DataClean.cast_and_must_be_natural_number(-114514);
});

Deno.test(function parse_datetime_test() {
  const d1 = Times.parse_text_to_instant("2024-11-19T09:13:37.293Z");
  const d2 = Times.parse_text_to_instant("2024-07-09 06:22:39+00");
  console.debug("parse result :", {
    d1,
    d2,
    max: Nums.take_extreme_value("max", [d1, null, d2]),
    min: Nums.take_extreme_value("min", [d1, d2]),
  });
});
