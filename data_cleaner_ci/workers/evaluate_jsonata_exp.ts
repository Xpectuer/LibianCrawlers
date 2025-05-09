import * as Comlink from "comlink";
import jsonata from "jsonata";
import { Jsonatas } from "../util.ts";

export class EvaluateJsonataExp {
  async evaluate(
    script:
      | {
          template_name: string;
        }
      | {
          content: string;
        },
    // deno-lint-ignore no-explicit-any
    data: any
  ) {
    try {
      let exp: ReturnType<typeof jsonata>;
      if ("content" in script) {
        exp = jsonata(script.content);
        Jsonatas.register_common_function_on_exp(exp);
      } else {
        exp = await Jsonatas.read_jsonata_template_exp(script.template_name);
      }
      // console.debug("success evaluate jsonata script", script);
      return await exp.evaluate(data);
    } catch (err) {
      console.error("Error on evaluate_jsonata_exp_worker", err);
      throw err;
    }
  }
}
Comlink.expose(EvaluateJsonataExp);
