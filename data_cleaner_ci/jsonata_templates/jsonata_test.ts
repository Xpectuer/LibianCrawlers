import jsonata from "jsonata";
import path from "node:path";
import { Jsonatas, Jsons, name_function, write_file } from "../util.ts";

async function run_tests() {
  for (const func_name of [
    // "test_xhs",
    // "test_yangkeduo",
    // "test_baidu",
    // "test_xhs2",
    // "test_cnki",
    // "test_entrez_search",
    "test_qianniu_message_export",
  ]) {
    let target_file: string;
    const func_config_file = path.join(
      "user_code",
      "jsonata_test_config",
      `${func_name}.json`
    );
    try {
      const config = Jsons.load(
        new TextDecoder("utf-8").decode(await Deno.readFile(func_config_file))
      );
      if (
        typeof config === "object" &&
        config &&
        !Array.isArray(config) &&
        "target_file" in config &&
        typeof config.target_file === "string"
      ) {
        target_file = config["target_file"];
      } else {
        throw new Error(
          `not found target_file field in config , config is ${config}`
        );
      }
    } catch (_err) {
      // not exist
      if (_err instanceof Deno.errors.NotFound) {
        let _target_file: string | null = "";
        while (_target_file.trim() === "") {
          _target_file = prompt(`
            🍒 请输入用于测试 ${func_name} 的示例文件相对路径（将会保存在 ${func_config_file} 下）。
                (例如: data_cleaner_ci_generated/.cache_by_id/MyPGLibianCrawlerGarbage/1637.json )
                      `);
          if (_target_file === null) {
            throw new Error("stdin is not interactive");
          }
        }
        target_file = _target_file;
        await write_file({
          file_path: func_config_file,
          creator: {
            mode: "text",
            // deno-lint-ignore require-await
            content: async () => {
              return Jsons.dump({ target_file }, { indent: 4 });
            },
          },
          log_tag: {
            alia_name: `${func_name} target file`,
          },
        });
      } else {
        throw _err;
      }
    }

    Deno.test(
      name_function(func_name, async () => {
        console.debug(`${func_name} from ${target_file}`);
        const content = Jsons.load(await Deno.readTextFile(target_file));
        const exp1 = await Jsonatas.read_jsonata_template_exp(
          "parse_html_tree",
          { no_cache: true }
        );
        const result = await exp1.evaluate(content);
        const result_content = Jsons.dump(result, { indent: 2 });
        console.debug("result content is ", result_content);
        await write_file({
          file_path: path.join(
            "user_code",
            `jsonata_test.${func_name}.result.json`
          ),
          creator: {
            mode: "text",
            // deno-lint-ignore require-await
            content: async () => result_content,
            overwrite: true,
          },
          log_tag: { alia_name: `${func_name} result file` },
        });
      })
    );
  }
}

await run_tests();
