import { is_deep_equal } from "../../util.ts";
import { Paragraphs } from "./paragraph_analysis.ts";
import { assert, assertEquals } from "@std/assert";

Deno.test(function find_and_clean_tags_in_text_test() {
  const r1 = Paragraphs.find_and_clean_tags_in_text("啊啊啊 #学习资料[话题]#");
  assertEquals(r1.text_cleaned, "啊啊啊 ");
  assert(is_deep_equal(r1.tags, ["学习资料"]));

  const r2 = Paragraphs.find_and_clean_tags_in_text(
    "啊啊啊#学习资料[话题]#   #学习资料2[话题]##学习资料3[话题]#"
  );
  assertEquals(r2.text_cleaned, "啊啊啊   ");
  console.debug("r2.tags", r2.tags);
  assert(is_deep_equal(r2.tags, ["学习资料", "学习资料2", "学习资料3"]));
});
