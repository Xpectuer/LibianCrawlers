import {
  DataClean,
  Errors,
  is_deep_equal,
  Jsons,
  Mappings,
  Nums,
  Paths,
  ProcessBar,
  Processes,
  SerAny,
  Streams,
  Strs,
  Times,
} from "./util.ts";
import {
  assert,
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { MultiProgressBar } from "jsr:@deno-library/progress";
import { delay } from "jsr:@std/async";
import { Buffer } from "node:buffer";
import path from "node:path";
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
      empty_char,
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

  for (
    const [t, n] of [
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
      ["two hundred", 200],
      ["three thousand five hundred", 3500],
      ["1 hundred", NaN],
    ]
  ) {
    assertEquals(
      DataClean.parse_number(t, "allow_nan", null, (it) => console.debug(it)),
      n,
    );
    console.debug("-----------------------");
    assertEquals(DataClean.parse_number(t, "allow_nan"), n);
  }
});

Deno.test(function stripHtmlTest() {
  for (
    const [t, r] of [
      ["你好世界", "你好世界"],
      [`<div v-if="value>123" >hello <b>world</b></div>`, "hello world"],
      [`<div v-if="value>123" >hello<b>world</b></div>`, "helloworld"],
      [`<div v-if="value>123" >hello <b> world </b> </div>`, "hello  world  "],
    ]
  ) {
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

      await delay(20);
    }
  }

  await download();
});

// Deno.test(async function bar_out_of_range_test(){

// })

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
      })(),
    ),
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
      })(),
    ),
  );
});

Deno.test(function is_deep_equal_test_2() {
  for (
    const [should_eq, a, b] of [
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
    ] as const
  ) {
    console.debug("Test is_deep_equal", { a, b });
    assert(
      should_eq === is_deep_equal(a, b),
      `${a}(jsonfiy: ${JSON.stringify(a)}) should ${
        should_eq ? "" : "not "
      }eq ${b}(jsonfiy: ${JSON.stringify(b)})`,
    );
    assert(
      should_eq === is_deep_equal(b, a),
      `${b}(jsonfiy: ${JSON.stringify(b)}) should ${
        should_eq ? "" : "not "
      }eq ${a}(jsonfiy: ${JSON.stringify(a)})`,
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
    DataClean.cast_and_must_be_natural_number(114514),
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
  assertEquals(
    d1.epochMilliseconds,
    new Date("2024-11-19T09:13:37.293Z").getTime(),
  );
  assertEquals(
    d2.epochMilliseconds,
    new Date("2024-07-09 06:22:39+00").getTime(),
  );
  const d3 = Times.parse_text_to_instant("20240709");
  console.debug("parse yyyymmdd", d3);
  assertEquals(
    d3.epochMilliseconds,
    new Date("2024-07-09 00:00:00+00").getTime(),
  );
  const d4 = Times.parse_text_to_instant("2025-03-24");
  console.debug("d4", d4);
  assertEquals(
    d4.epochMilliseconds,
    new Date("2025-03-24 00:00:00+00").getTime(),
  );
  const d5 = Times.parse_text_to_instant("1 Dec 2025");
  console.debug("d5", d5);
  console.debug(
    'new Date("2025-12-01 00:00:00+00")',
    new Date("2025-12-01 00:00:00+00"),
  );
  console.debug(
    'new Date("2025-12-01 00:00:00+08")',
    new Date("2025-12-01 00:00:00+08"),
  );
  console.debug(
    'new Date("2025-12-01 00:00:00")',
    new Date("2025-12-01 00:00:00"),
  );
  assertEquals(
    d5.epochMilliseconds,
    new Date("2025-12-01 00:00:00").getTime(),
  );
  const d6 = Times.parse_text_to_instant("1 Jun 2025");
  console.debug("d6", d6);
  assertEquals(
    d6.epochMilliseconds,
    new Date("2025-6-1 00:00:00").getTime(),
  );
  const opt1 = {
    attach_year: [2025, {
      on_exist: "raise_on_not_match",
    }],
    attach_day: [15, {
      on_exist: "use_exist",
    }],
    on_found_month_range: "use_min_month",
  } as const;
  const d7 = Times.parse_text_to_instant("APR", opt1);
  console.debug("d7", d7);
  assertEquals(
    d7.epochMilliseconds,
    new Date("2025-4-15 00:00:00").getTime(),
  );
  const d8 = Times.parse_text_to_instant("APR-Oct", opt1);
  console.debug("d8", d8);
  console.debug(
    'new Date("2025-4-15 00:00:00")',
    new Date("2025-4-15 00:00:00"),
  );
  assertEquals(
    d8.epochMilliseconds,
    new Date("2025-4-15 00:00:00").getTime(),
  );
  // const d9 = Times.parse_text_to_instant("2024    APR", opt1);
  // console.debug("d9", d9);
  // assertEquals(
  //   d9.epochMilliseconds,
  //   new Date("2024-4-15 00:00:00").getTime(),
  // );
  const d10 = Times.parse_text_to_instant("APR-Oct", {
    ...opt1,
    on_found_month_range: "use_max_month",
  });
  console.debug("d10", d10);
  console.debug(
    'new Date("2025-10-15 00:00:00")',
    new Date("2025-10-15 00:00:00"),
  );
  // TODO: 时区问题
  //

  // assertEquals(
  //   d10.epochMilliseconds,
  //   new Date("2025-10-15 00:00:00").getTime(),
  // );

  const d11 = Times.parse_text_to_instant("8月28日", {
    ...opt1,
  });
  console.debug("d11", d11);
  assertEquals(
    d11.epochMilliseconds,
    new Date("2025-8-28 00:00:00").getTime(),
  );

  const d12 = Times.parse_text_to_instant("8月28日 15:30", {
    ...opt1,
  });
  console.debug("d12", d12);
  assertEquals(
    d12.epochMilliseconds,
    new Date("2025-8-28 15:30:00").getTime(),
  );

  const d13 = Times.parse_text_to_instant("8月28日 15:30:45", {
    ...opt1,
  });
  console.debug("d13", d13);
  assertEquals(
    d13.epochMilliseconds,
    new Date("2025-8-28 15:30:45").getTime(),
  );
});

Deno.test(async function parse_process_bar_bind_each_test() {
  const _test_func = async (
    step_delay: number,
    totals: number[] = [30, 60, 100],
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
        bars.render,
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

Deno.test(async function queue_cached_test() {
  const reader = async function* () {
    for (let i = 0; i < 100; i++) {
      await delay(50);
      console.debug("read", i);
      yield i;
    }
  };
  const writer = Streams.queue_cached({
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

Deno.test(function parseRefWorks() {
  const res1 = DataClean.parse_pubmed_str(
    "\nPMID- 40026147\nOWN - NLM\nSTAT- MEDLINE\nDCOM- 20250511\nLR  - 20250511\nIS  - 1941-3297 (Electronic)\nIS  - 1941-3289 (Linking)\nVI  - 18\nIP  - 3\nDP  - 2025 Mar\nTI  - Impact of Multimorbidity on Mortality in Heart Failure With Mildly Reduced and \n      Preserved Ejection Fraction.\nPG  - e011598\nLID - 10.1161/CIRCHEARTFAILURE.124.011598 [doi]\nAB  - BACKGROUND: How different combinations of comorbidities influence risk at the \n      patient level and population level in patients with heart failure with mildly \n      reduced ejection fraction/heart failure with preserved ejection fraction is \n      unknown. We aimed to investigate the prevalence of different combinations of \n      cardiovascular and noncardiovascular comorbidities (ie, multimorbidity) and \n      associated risk of death at the patient level and population level. METHODS: \n      Using patient-level data from the TOPCAT trial (Treatment of Preserved Cardiac \n      Function Heart Failure With an Aldosterone Antagonist) and PARAGON-HF trial \n      (Prospective Comparison of ARNI With ARB Global Outcomes in HF With Preserved \n      Ejection Fraction), we investigated the 5 most common cardiovascular and \n      noncardiovascular comorbidities and the resultant 45 comorbidity pairs. Cox \n      proportional hazard models were used to calculate the population-attributable \n      fractions for all-cause mortality and the relative excess risk due to interaction \n      for each comorbidity pair. RESULTS: Among 6504 participants, 95.2% had at least 2 \n      of the 10 most prevalent comorbidities. The comorbidity pair with the greatest \n      patient-level risk was stroke and peripheral artery disease (adjusted hazard \n      ratio, 1.88 [95% CI, 1.27-2.79]), followed by peripheral artery disease and \n      chronic obstructive pulmonary disease (1.81 [95% CI, 1.31-2.51]), and coronary \n      artery disease and stroke (1.67 [95% CI, 1.33-2.11]). The pair with the highest \n      population-level risk was hypertension and chronic kidney disease (CKD; adjusted \n      population-attributable fraction, 14.8% [95% CI, 9.2%-19.9%]), followed by \n      diabetes and CKD (13.3% [95% CI, 10.6%-16.0%]), and hypertension and diabetes \n      (11.9% [95% CI, 7.1%-16.5%). A synergistic interaction (more than additive risk) \n      was found for the comorbidity pairs of stroke and coronary artery disease \n      (relative excess risk due to interaction, 0.61 [95% CI, 0.13-1.09]), diabetes and \n      CKD (relative excess risk due to interaction, 0.46 [95% CI, -0.15 to 0.77]), and \n      obesity and CKD (relative excess risk due to interaction, 0.24 [95% CI, \n      0.01-0.46]). CONCLUSIONS: The risk associated with comorbidity pairs differs at \n      the patient and population levels in heart failure with mildly reduced ejection \n      fraction/heart failure with preserved ejection fraction. At the population level, \n      hypertension, CKD, and diabetes account for the greatest risk, whereas at the \n      patient level, polyvascular disease and chronic obstructive pulmonary disease are \n      the most important.\nFAU - Yang, Mingming\nAU  - Yang M\nAD  - School of Cardiovascular and Metabolic Health, British Heart Foundation \n      Cardiovascular Research Centre, University of Glasgow, United Kingdom (M.Y., \n      T.K., P.D., P.S.J., J.J.V.M.).\nAD  - Department of Cardiology, Zhongda Hospital, School of Medicine, Southeast \n      University, Nanjing, China (M.Y.).\nFAU - Kondo, Toru\nAU  - Kondo T\nAUID- ORCID: 0000-0001-6853-7574\nAD  - School of Cardiovascular and Metabolic Health, British Heart Foundation \n      Cardiovascular Research Centre, University of Glasgow, United Kingdom (M.Y., \n      T.K., P.D., P.S.J., J.J.V.M.).\nAD  - Department of Cardiology, Nagoya University Graduate School of Medicine, Japan \n      (T.K.).\nFAU - Dewan, Pooja\nAU  - Dewan P\nAD  - School of Cardiovascular and Metabolic Health, British Heart Foundation \n      Cardiovascular Research Centre, University of Glasgow, United Kingdom (M.Y., \n      T.K., P.D., P.S.J., J.J.V.M.).\nFAU - Desai, Akshay S\nAU  - Desai AS\nAUID- ORCID: 0000-0002-1443-0701\nAD  - Cardiovascular Division, Brigham and Women's Hospital and Harvard Medical School, \n      Boston, MA (A.S.D., M.V., S.D.S.).\nFAU - Lam, Carolyn S P\nAU  - Lam CSP\nAUID- ORCID: 0000-0003-1903-0018\nAD  - National Heart Centre, Singapore and Duke-National University of Singapore \n      (C.S.P.L.).\nFAU - Lefkowitz, Martin P\nAU  - Lefkowitz MP\nAUID- ORCID: 0000-0002-8830-6316\nAD  - Novartis Pharmaceuticals Corporation, East Hanover, NJ (M.P.L.).\nFAU - Packer, Milton\nAU  - Packer M\nAUID- ORCID: 0000-0003-1828-2387\nAD  - Baylor Heart and Vascular Institute, Baylor University Medical Center, Dallas, TX \n      (M.P.).\nFAU - Rouleau, Jean L\nAU  - Rouleau JL\nAUID- ORCID: 0000-0002-5353-3877\nAD  - Institut de Cardiologie de Montreal, Universite de Montreal, QC, Canada (J.L.R.).\nFAU - Vaduganathan, Muthiah\nAU  - Vaduganathan M\nAUID- ORCID: 0000-0003-0885-1953\nAD  - Cardiovascular Division, Brigham and Women's Hospital and Harvard Medical School, \n      Boston, MA (A.S.D., M.V., S.D.S.).\nFAU - Zile, Michael R\nAU  - Zile MR\nAUID- ORCID: 0000-0001-7076-221X\nAD  - RHJ Department of Veterans Affairs Medical Center, Medical University of South \n      Carolina, Charleston (M.R.Z.).\nFAU - Jhund, Pardeep S\nAU  - Jhund PS\nAUID- ORCID: 0000-0003-4306-5317\nAD  - School of Cardiovascular and Metabolic Health, British Heart Foundation \n      Cardiovascular Research Centre, University of Glasgow, United Kingdom (M.Y., \n      T.K., P.D., P.S.J., J.J.V.M.).\nFAU - Kober, Lars\nAU  - Kober L\nAUID- ORCID: 0000-0002-6635-1466\nAD  - Department of Cardiology, Copenhagen University Hospital Rigshospitalet, Denmark \n      (L.K.).\nFAU - Solomon, Scott D\nAU  - Solomon SD\nAUID- ORCID: 0000-0003-3698-9597\nAD  - Cardiovascular Division, Brigham and Women's Hospital and Harvard Medical School, \n      Boston, MA (A.S.D., M.V., S.D.S.).\nFAU - McMurray, John J V\nAU  - McMurray JJV\nAUID- ORCID: 0000-0002-6317-3975\nAD  - School of Cardiovascular and Metabolic Health, British Heart Foundation \n      Cardiovascular Research Centre, University of Glasgow, United Kingdom (M.Y., \n      T.K., P.D., P.S.J., J.J.V.M.).\nLA  - eng\nPT  - Journal Article\nDEP - 20250303\nPL  - United States\nTA  - Circ Heart Fail\nJT  - Circulation. Heart failure\nJID - 101479941\nSB  - IM\nCIN - Circ Heart Fail. 2025 Mar;18(3):e012432. doi: \n      10.1161/CIRCHEARTFAILURE.124.012432. PMID: 40026148\nMH  - Humans\nMH  - *Heart Failure/mortality/physiopathology/drug therapy/epidemiology/diagnosis\nMH  - Female\nMH  - Male\nMH  - Aged\nMH  - *Stroke Volume/physiology\nMH  - Multimorbidity\nMH  - Middle Aged\nMH  - Risk Factors\nMH  - Comorbidity\nMH  - Prevalence\nMH  - Risk Assessment\nMH  - Aged, 80 and over\nOTO - NOTNLM\nOT  - heart failure\nOT  - humans\nOT  - multimorbidity\nOT  - prevalence\nOT  - proportional hazards models\nCOIS- Dr Yang has received Global CardioVascular Clinical Trialists Young Trialist \n      Grant and travel grants from AstraZeneca. Dr Kondo reports speaker fees from \n      Abbott, Ono Pharma, Otsuka Pharma, Novartis, AstraZeneca, Bristol Myers Squibb, \n      and Abiomed. Dr Desai reports consulting fees from Abbott, Biofourmis, Boston \n      Scientific, Boehringer Ingelheim, DalCor Pharmaceuticals, and Regeneron; grant \n      support (paid to Brigham and Women's Hospital) and consulting fees from Alnylam \n      Pharmaceuticals and Novartis; and advisory board fees from Corvidia and Relypsa. \n      Dr Lam is supported by a Clinician Scientist Award from the National Medical \n      Research Council of Singapore; has received research support from AstraZeneca, \n      Bayer, Boston Scientific, and Roche Diagnostics; has served as a consultant or on \n      the advisory board/steering committee/executive committee for Actelion, Amgen, \n      Applied Therapeutics, AstraZeneca, Bayer, Boehringer Ingelheim, Boston \n      Scientific, Cytokinetics, Darma Inc, Us2.ai, Janssen Research & Development LLC, \n      Medscape, Merck, Novartis, Novo Nordisk, Radcliffe Group Ltd, Roche Diagnostics, \n      Sanofi, and WebMD Global LLC; and serves as the cofounder and nonexecutive \n      director of Us2.ai. Dr Lefkowitz is an employee of Novartis. Dr Packer reports \n      consulting fees from AbbVie, Akcea, Actavis, Amgen, AstraZeneca, Bayer, \n      Boehringer Ingelheim, Cardiorentis, Daiichi Sankyo, Gilead, Johnson & Johnson, \n      Novo Nordisk, Pfizer, Relypsa, Sanofi, Synthetic Biologics, and Theravance. Dr \n      Rouleau has received grants and consulting fees from DMC membership, Bayer, \n      AstraZeneca, BMS, and Novartis. Dr Vaduganathan has received research grant \n      support, advisory board, or speaker engagement with American Regent, Amgen, \n      AstraZeneca, Bayer AG, Baxter Healthcare, Boehringer Ingelheim, Chiesi, \n      Cytokinetics, Lexicon Pharmaceuticals, Merck, Novartis, Novo Nordisk, \n      Pharmacosmos, Relypsa, Roche Diagnostics, Sanofi, and Tricog Health and \n      participated on the clinical trial committees for studies sponsored by \n      AstraZeneca, Galmed, Novartis, Bayer AG, Occlutech, and Impulse Dynamics. Dr Zile \n      has received research funding from Novartis and has been a consultant for \n      Novartis, Abbott, Boston Scientific, CVRx, EBR, Endotronics, Ironwood, Merck, \n      Medtronic, and Myokardia V Wave. Dr Jhund has received speaker fees from \n      AstraZeneca, Novartis, Alkem Metabolics, ProAdWise Communications, Sun \n      Pharmaceuticals, and Intas Pharmaceuticals; has received advisory board fees from \n      AstraZeneca, Boehringer Ingelheim, and Novartis; has received research funding \n      from AstraZeneca, Boehringer Ingelheim, and Analog Devices Inc; his employer, the \n      University of Glasgow, has been remunerated for clinical trial work from \n      AstraZeneca, Bayer AG, Novartis, and Novo Nordisk; and is the director of Global \n      Clinical Trial Partners (GCTP). Dr Kober reports other support from AstraZeneca \n      and personal fees from Novartis and Boehringer as a speaker. Dr Solomon has \n      received research grants from Actelion, Alnylam, Amgen, AstraZeneca, Bellerophon, \n      Bayer, Bristol Myers Squibb, Celladon, Cytokinetics, Eidos, Gilead, \n      GlaxoSmithKline, Ionis, Lilly, Mesoblast, MyoKardia, National Institutes of \n      Health/National Heart, Lung, and Blood Institute, Neurotronik, Novartis, Novo \n      Nordisk, Respicardia, Sanofi Pasteur, Theracos, and S2.AI and has consulted for \n      Abbott, Action, Akros, Alnylam, Amgen, Arena, AstraZeneca, Bayer, Boehringer \n      Ingelheim, Bristol Myers Squibb, Cardior, Cardurion, Corvia, Cytokinetics, \n      Daiichi Sankyo, GlaxoSmithKline, Lilly, Merck, Myokardia, Novartis, Roche, \n      Theracos, Quantum Genomics, Cardurion, Janssen, Cardiac Dimensions, Tenaya, \n      Sanofi Pasteur, Dinaqor, Tremeau, CellPro-Thera, Moderna, American Regent, and \n      Sarepta. Dr McMurray has received payments through Glasgow University from work \n      on clinical trials, consulting, and other activities from Amgen, AstraZeneca, \n      Bayer, Cardurion, Cytokinetics, GlaxoSmithKline, KBP Biosciences, and Novartis; \n      has received personal consultancy fees from Alnylam Pharma, Bayer, Bristol Myers \n      Squibb, George Clinical PTY Ltd, Ionis Pharma, Novartis, Regeneron Pharma, and \n      River 2 Renal Corporation; has received personal lecture fees from Abbott, Alkem \n      Metabolics, AstraZeneca, Blue Ocean Scientific Solutions Ltd, Boehringer \n      Ingelheim, Canadian Medical and Surgical Knowledge, Emcure Pharma Ltd, Eris \n      Lifesciences, European Academy of CME, Hikma Pharmaceuticals, Imagica Health, \n      Intas Pharma, J.B. Chemicals & Pharma Ltd, Lupin Pharma, Medscape/Heart, \n      ProAdWise Communications, Radcliffe Cardiology, Sun Pharma, The Corpus, \n      Translation Research Group, and Translational Medicine Academy; and is a director \n      of GCTP. The other authors report no conflicts.\nEDAT- 2025/03/03 06:21\nMHDA- 2025/03/18 06:22\nCRDT- 2025/03/03 05:02\nPHST- 2025/03/18 06:22 [medline]\nPHST- 2025/03/03 06:21 [pubmed]\nPHST- 2025/03/03 05:02 [entrez]\nAID - 10.1161/CIRCHEARTFAILURE.124.011598 [doi]\nPST - ppublish\nSO  - Circ Heart Fail. 2025 Mar;18(3):e011598. doi: \n      10.1161/CIRCHEARTFAILURE.124.011598. Epub 2025 Mar 3.\n",
  );
  console.debug(res1);
  assertNotEquals(res1, null);
  const res2 = DataClean.parse_pubmed_str("asjiaodjoiasd");
  console.debug(res2);
  assertEquals(res2, null);
});

Deno.test(function parseRefWorks2() {
  const res1 = DataClean.parse_pubmed_str("TI - X-assa  ");
  console.debug(res1);
  assertEquals(res1?.entries, [{ label: "TI", value: "X-assa" }]);
});

Deno.test(async function generator_should_return_test() {
  async function* create_g() {
    const arr: number[] = [];
    while (1) {
      const r: number | "stop" = yield;
      console.debug("r=", r);
      if (r === "stop") {
        return arr;
      } else {
        arr.push(r);
      }
    }
  }

  const g1 = create_g();
  console.debug("await g1.next()", await g1.next());
  console.debug("await g1.next(1)", await g1.next(1));
  console.debug("await g1.next(2)", await g1.next(2));
  console.debug(`await g1.next("stop")`, await g1.next("stop"));
  console.debug(`await g1.next("stop")`, await g1.next("stop"));
  console.debug("--------------------------");
  const g2 = create_g();
  console.debug("await g2.next()", await g2.next());
  console.debug("await g2.next(1)", await g2.next(1));
  console.debug(`await g2.next("stop")`, await g2.next("stop"));
  console.debug(`await g2.next("stop")`, await g2.next("stop"));
  console.debug("--------------------------");
  const g3 = create_g();
  console.debug("await g3.next()", await g3.next());
  console.debug(`await g3.next("stop")`, await g3.next("stop"));
  console.debug(`await g3.next("stop")`, await g3.next("stop"));
});

Deno.test(async function serany_test() {
  await SerAny.init();

  const buf_2 = Uint8Array.from([1, 2, 3, 4, 5]);
  console.debug("buf_2", buf_2);

  const source = {
    undef: undefined,
    regexp: /abc/gi,
    bignum: 4000000000000000000n,
    map: new Map([[1, "one"], [2, "two"]]),
    buffer: Buffer.from("hello world"),
    buf_2,
  };

  const ser = SerAny.serialize(source);
  console.debug("ser", ser);
  const deser = SerAny.deserialize(ser);

  console.debug("deser", {
    source,
    deser,
  });

  assertEquals(source, deser);
  assert(source.buf_2.length === 5);
});

Deno.test(function get_instant_epmill() {
  const inst = Times.parse_text_to_instant("2025-6-7 15:00");
  console.debug(inst.epochMilliseconds);
  console.debug(Times.instant_to_date(inst).getTime());
});

Deno.test(async function serany_instant_test() {
  await SerAny.init();
  const inst_source = Times.parse_text_to_instant("2025-6-7 12:00:00");
  const assigned = {};
  Object.assign(assigned, inst_source);
  console.debug("inst_source", {
    inst_source,
    epochMilliseconds: inst_source.epochMilliseconds,
    assigned,
  });

  for (const pretty of [true, false]) {
    const inst_ser = SerAny.serialize(inst_source, { pretty });
    console.debug("inst_ser", inst_ser);
    const inst_deser = SerAny.deserialize(inst_ser);

    console.debug("inst_deser", {
      inst_source,
      inst_deser,
    });

    assertEquals(inst_source, inst_deser);
  }
});

Deno.test(async function serany_to_file_test() {
  await SerAny.init();
  const users = [
    {
      "time": "unknown",
      "value": {
        "nickname": "H。",
        "platform_user_id": "627cbbd3000000002102371d",
        "avater_url":
          "https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo30t2d7gn93s605ojsnf9ocdots9iario?imageView2/2/w/80/format/jpg",
        "home_link_url":
          "https://www.xiaohongshu.com/user/profile/627cbbd3000000002102371d?channel_type=web_note_detail_r10&parent_page_channel_type=web_profile_board&xsec_token=&xsec_source=pc_note",
      },
    },
    {
      "time": Times.parse_text_to_instant("2025-6-7"),
      "value": {
        "nickname": "H。",
        "platform_user_id": "627cbbd3000000002102371d",
        "avater_url":
          "https://sns-avatar-qc.xhscdn.com/avatar/1040g2jo30t2d7gn93s605ojsnf9ocdots9iario",
        "home_link_url":
          "https://www.xiaohongshu.com/user/profile/627cbbd3000000002102371d?channel_type=web_note_detail_r10&parent_page_channel_type=web_profile_board&xsec_token=&xsec_source=pc_note",
      },
    },
  ];
  for (
    const { source, tag } of [
      {
        source: {
          undef: undefined,
          regexp: /abc/gi,
          bignum: 4000000000000000000n,
          map: new Map([[1, "one"], [2, "two"]]),

          buffer: Buffer.from("hello world"),
          // inst: Temporal.Instant.fromEpochMilliseconds(new Date().getTime()),
        },
        tag: "1",
      },
      {
        source: {
          a: " 114514 ",
          buffer: Buffer.from("hello world"),
          inst: Temporal.Instant.fromEpochMilliseconds(new Date().getTime()),
        },
        tag: "with_instant",
      },
      {
        source: {
          buffer: Buffer.from("hello world"),
          inst: Times.parse_text_to_instant("2025-6-7 19:20"),
        },
        tag: "with_instant_2",
      },
      {
        source: {
          ids: new Set(["a", "b", "c"]),
          ids2: new Set(["a"]),
          ids3: new Set([]),
          map1: new Map([[1, "one"], [2, "two"]]),
          users,
          users_set: new Set(users),
          users_map: new Map([["627cbbd3000000002102371d", users]]),
        },
        tag: "collections",
      },
    ] as const
  ) {
    const test_dir = path.join("user_code", ".tmp", ".util_test");
    const f = Paths.join2(test_dir, `${tag}.serany.json`);
    await SerAny.ser_to_file(f, source, { pretty: true });
    const res = await SerAny.deser_from_file(f);
    console.debug("diff", {
      source,
      res,
    });
    assertEquals(source, res);
  }
});

Deno.test(function iter_test() {
  function* a_iter() {
    while (1) {
      const x: string = yield;
      yield `hello ${x}`;
      yield `hi ${x}`;
      yield `bye ${x}`;
    }
  }
  const iter = a_iter();
  const next = (param?: string) => {
    if (typeof param === "string") {
      console.debug(`iter.next(${JSON.stringify(param)})`, iter.next(param));
    } else {
      console.debug(`iter.next()`, iter.next());
    }
  };
  next();
  next();
  next();
  next();
  next();
  next();
  next();
  next("ignore");
  next("ignore2");
  next("ignore3");
});

Deno.test(function jsons_dump_protect_test() {
  Jsons.dump({
    a: 1,
    b: 2,
    c: null,
  });
  for (
    const err of [
      assertThrows(() =>
        Jsons.dump({
          a: 1,
          b: new Date(),
        })
      ),
      assertThrows(() =>
        Jsons.dump({
          a: 1,
          b: BigInt(100),
        })
      ),
      assertThrows(() =>
        Jsons.dump({
          a: 1,
          b: undefined,
        })
      ),
      assertThrows(() =>
        Jsons.dump({
          a: 1,
          b: NaN,
        })
      ),
      assertThrows(() =>
        Jsons.dump({
          a: 1,
          b: Infinity,
        })
      ),
      assertThrows(() =>
        Jsons.dump({
          a: 1,
          b: Temporal.Instant.fromEpochMilliseconds(1234567890000),
        })
      ),
    ]
  ) {
    console.debug("-------------------------------");
    console.debug("err is", err);
  }
});

Deno.test(function error_format_test() {
  const src = "hahahahahhahaha";
  const err3 = new Error("error 3");
  const err4 = new Error("error 4", { cause: err3 });
  const err = assertThrows(() => Jsons.load(src));
  const err2 = assertThrows(() =>
    Jsons.dump({
      a: 1,
      b: new Date(),
    })
  );
  try {
    Errors.throw_and_format(
      "Failed parse json",
      src,
      err,
      err2,
      new Error("anothor error"),
      {
        anothor_ctx: 114514,
      },
      err3,
      err4,
    );
  } catch (err_res) {
    // console.debug(err_res);
    const err_msg = Deno.inspect(err_res);
    console.debug(err_msg);
    const assertStringIncludes2 = (a: string, b: string) => {
      if (a.indexOf(b) < 0) {
        throw new Error(
          `======================================= assertStringIncludes ========================================
a is:



${a}



======================================= assertStringIncludes ========================================
b is:


${b}



========================================= assertStringIncludes ========================================
`,
        );
      }
    };
    assertStringIncludes2(err_msg, "Failed parse json");
    assertStringIncludes2(err_msg, src);
    assertStringIncludes2(err_msg, `${err}`);
    assertStringIncludes2(err_msg, `${err2}`.split("\n")[0]);
    assertStringIncludes2(err_msg, src);
    assertStringIncludes2(err_msg, `Date`);
    assertStringIncludes2(err_msg, "anothor error");
    assertStringIncludes2(err_msg, "114514");
    assertStringIncludes2(err_msg, "error 3");
    assertStringIncludes2(err_msg, "error 4");
  }
});
