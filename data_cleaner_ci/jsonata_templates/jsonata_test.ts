import jsonata from "jsonata";
import path from "node:path";
import { Jsons, write_file } from "../util.ts";

Deno.test(async function test_xhs() {
  const target_file = path.join(
    "data_cleaner_ci_generated",
    ".cache_by_id",
    "TJNocoPGLibianCrawlerGarbage",
    "1637.json"
  );
  try {
    await Deno.stat(target_file);
  } catch (err) {
    console.debug("Skipped test because :", err);
    return;
  }
  const content = Jsons.load(await Deno.readTextFile(target_file));
  const exp1 = jsonata(
    await Deno.readTextFile(
      path.join("jsonata_templates", "parse_html_tree.jsonata")
    )
  );
  const result = await exp1.evaluate(content);
  const result_content = Jsons.dump(result, { indent: 2 });
  console.debug("result content is ", result_content);
  const func_name = `test_xhs`;
  await write_file({
    file_path: path.join("user_code", `jsonata_test.${func_name}.result.json`),
    creator: {
      mode: "text",
      // deno-lint-ignore require-await
      content: async () => result_content,
      overwrite: true,
    },
    log_tag: { alia_name: `${func_name} result file` },
  });
});
