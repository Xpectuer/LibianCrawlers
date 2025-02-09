import {
  DataClean,
  is_deep_equal,
  Mappings,
  Nums,
  ProcessBar,
  Streams,
  Strs,
  Times,
} from "./util.ts";
import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
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
    assertEquals(DataClean.parse_number(t, "allow_nan"), n);
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

Deno.test(function is_deep_equal_test() {
  assert(!is_deep_equal(new Date(10000), new Date(200000)));
  assert(is_deep_equal(new Map(), new Map()));
  assert(
    !is_deep_equal(
      (() => {
        const m = new Map();
        m.set("result", 1);
        return m;
      })(),
      (() => {
        const m = new Map();
        return m;
      })()
    )
  );
  assert(
    is_deep_equal(
      (() => {
        const m = new Map();
        m.set("result", 1);
        return m;
      })(),
      (() => {
        const m = new Map();
        m.set("result", 1);
        return m;
      })()
    )
  );
});

Deno.test(function is_deep_equal_test_2() {
  for (const [should_eq, a, b] of [
    [true, 3, 3],
    [false, 3, 4],
    [true, null, null],
    [true, undefined, undefined],
    [true, NaN, NaN],
    [true, Infinity, Infinity],
    [true, new Date(0), new Date("Thu Jan 01 1970 08:00:00 GMT+0800")],
    [false, new Date(100), new Date("Thu Jan 01 1970 08:00:00 GMT+0800")],
    [false, new Date(10000), new Date("Thu Jan 01 1970 08:00:00 GMT+0800")],
    [false, NaN, null],
    [false, NaN, undefined],
    [false, NaN, 0],
    [false, NaN, ""],
    [false, NaN, Infinity],
    [false, Infinity, null],
    [false, Infinity, undefined],
    [false, Infinity, 0],
    [false, Infinity, ""],
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

Deno.test(function is_deep_equal_test_3() {
  const maps = [
    BigInt(1),
    BigInt(0),
    BigInt(-1),
    1,
    {
      group: [0, -0],
    },
    -1,
    {
      group: [NaN, -NaN],
    },
    2,
    3,
    4,
    Infinity,
    -Infinity,
    "1",
    "0",
    "-1",
    "true",
    true,
    "false",
    false,
    "",
    "\n",
    "\t",
    null,
    "null",
    undefined,
    [],
    {},
    new Date(0),
    new Date(1000),
    new Date(),
    new RegExp(""),
    new RegExp("\t"),
    new Map(),
    {
      group: [
        (() => {
          const m = new Map();
          m.set("result", 1);
          return m;
        })(),
        (() => {
          const m = new Map();
          m.set("result", 1);
          return m;
        })(),
      ],
    },
    (() => {
      const m = new Map();
      m.set("result", 2);
      return m;
    })(),
    new Set(),
    new Set([1, 2, 3]),
  ] as const;
  const get_items = (idx: number) => {
    const item = maps[idx];
    if (typeof item === "object" && item && "group" in item) {
      for (let i2 = 0; i2 < item.group.length; i2++) {
        for (let j2 = 0; j2 < item.group.length; j2++) {
          if (i2 === j2) {
            continue;
          }
          assertEquals(item.group[i2], item.group[j2]);
          assert(is_deep_equal(item.group[i2], item.group[j2]));
        }
      }
      return item.group;
    }
    return [item];
  };
  for (let i = 0; i < maps.length; i++) {
    for (let j = 0; j < maps.length; j++) {
      if (i === j) {
        continue;
      }
      for (const item_i of get_items(i)) {
        for (const item_j of get_items(j)) {
          assertNotEquals(item_i, item_j);
          assert(!is_deep_equal(item_i, item_j));
        }
      }
    }
  }
});

Deno.test(function require_natural_number_test() {
  assertEquals(
    BigInt(114514),
    DataClean.cast_and_must_be_natural_number(114514)
  );

  assertThrows(() => {
    DataClean.cast_and_must_be_natural_number(NaN);
  });
  assertThrows(() => {
    DataClean.cast_and_must_be_natural_number(Infinity);
  });
  assertThrows(() => {
    DataClean.cast_and_must_be_natural_number(1 / 0);
  });

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

Deno.test(async function parse_process_bar_bind_each_test() {
  const _test_func = async (
    step_delay: number,
    totals: number[] = [30, 60, 100]
  ) => {
    // await delay(100);
    await ProcessBar.create_scope({}, async (bars) => {
      console.debug("start bind each tasks", { step_delay });
      const create_task =
        (total: number) =>
        async (arg: number, ctx: ProcessBar.SingleBarSetter) => {
          // console.debug(`start task`, arg);
          await ctx.set_total(total);
          for (let i = 0; i < total; i++) {
            if (step_delay > 0) {
              await delay(step_delay);
            }
            await ctx.set_completed(i + 1);
          }
          // console.debug("finish task", arg);
          return arg;
        };
      const tasks = ProcessBar.bind_each<number, number>(
        totals.map((total) => create_task(total)),
        bars.render
      );
      console.debug("start wait promise all");
      const res = await Promise.all([...tasks.map((task, idx) => task(idx))]);
      console.debug("result is", res);
    });
  };

  await _test_func(0);
  await _test_func(1);
  await _test_func(2);
  await _test_func(3);
  await _test_func(4);
  await _test_func(8);
  await _test_func(14);
  await _test_func(20);
  await _test_func(1, [1000]);
});

Deno.test(async function backpressure_test() {
  const reader = async function* () {
    for (let i = 0; i < 100; i++) {
      await delay(50);
      console.debug("read", i);
      yield i;
    }
  };
  const writer = Streams.backpressure({
    gen: reader(),
    queue_size: 20,
    writer_delay_ms: () => Math.floor(300 * Math.random()),
    before_event(ev) {
      console.debug("before", ev);
    },
  });
  for await (const item of writer()) {
    console.debug("write", item);
  }
});

Deno.test(function streams_deduplicate_test() {
  const res = Streams.deduplicate([
    1,
    2,
    3,
    3,
    1,
    4,
    5,
    5,
    { v: 3 },
    { v: 3 },
    { v: 4 },
  ]);
  console.debug("deduplicate res", res);
  assertEquals(res, [1, 2, 3, 4, 5, { v: 3 }, { v: 4 }]);
});
