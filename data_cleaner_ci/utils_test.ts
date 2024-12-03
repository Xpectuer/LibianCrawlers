import { Strs } from "./util.ts";
import { assertEquals } from "@std/assert";

Deno.test(function strsTest() {
  const a = "helloworld1" as string;
  if (Strs.startswith(a, "hello")) {
    assertEquals("world1", Strs.remove_prefix(a, "hello"));
  }
  const b = "hello2world" as string;
  if (Strs.endswith(b, "world")) {
    assertEquals("hello2", Strs.remove_suffix(b, "world"));
  }
});

Deno.test(function parseNumberTest() {
  for (const [t, n] of [
    ["1000", 1000],
    [114514, 114514],
    ["114514.1919810", 114514.191981_0],
    ["1.5万", 15000],
    ["1.5亿", 150000000],
  ]) {
    assertEquals(
      n,
      Strs.parse_number(t, () => NaN)
    );
  }
});

Deno.test(function stripHtmlTest() {
  for (const [t, r] of [
    ["你好世界", "你好世界"],
    [`<div v-if="value>123" >hello <b>world</b></div>`, "hello world"],
    [`<div v-if="value>123" >hello<b>world</b></div>`, "helloworld"],
    [`<div v-if="value>123" >hello <b> world </b> </div>`, "hello  world  "],
  ]) {
    console.info("strip html result", Strs.strip_html(t));
    assertEquals(r, Strs.strip_html(t));
  }
});
