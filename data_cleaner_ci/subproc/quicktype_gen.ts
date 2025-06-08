//
//
// 由于 quicktype 存在内存泄漏，不得不使用子进程。
//

import { InputData, quicktype } from "quicktype-core";
import { QuickTypeUtil } from "../quicktypeutil.ts";
import { Jsons, Processes, SizeOf } from "../util.ts";
import path from "node:path";

export type QuicktypeGenParam<T> = Parameters<typeof _quicktype_gen<T>>[0];
async function _quicktype_gen_main() {
  const now = () => new Date().getTime();
  const _json_parse_start_at = now();
  const _input_obj: unknown = await Jsons.load_stream({
    input_stream: Deno.stdin.readable,
  });
  const _json_parse_end_at = now();
  if (
    typeof _input_obj === "object" &&
    !Array.isArray(_input_obj) &&
    _input_obj &&
    "debugopt_logtime" in _input_obj &&
    "typename" in _input_obj &&
    "typedesc" in _input_obj &&
    "_TIP" in _input_obj &&
    "res_file_path" in _input_obj &&
    "samples" in _input_obj
  ) {
    const {
      debugopt_logtime,
      typename,
      typedesc,
      _TIP,
      res_file_path,
      samples,
    } = _input_obj;
    if (debugopt_logtime) {
      console.debug("quicktype gen subprocess parse json success", {
        res_file_path,
        cast_json_parse: `${
          (_json_parse_end_at - _json_parse_start_at) / 1000
        } s`,
      });
    }
    if (
      typeof debugopt_logtime === "boolean" &&
      typeof typename === "string" &&
      typeof typedesc === "string" &&
      typeof _TIP === "string" &&
      typeof res_file_path === "string" &&
      Array.isArray(samples)
    ) {
      const res = await _quicktype_gen({
        debugopt_logtime,
        typename,
        typedesc,
        _TIP,
        samples,
        res_file_path,
      });
      const _quicktype_gen_end_at = now();
      if (debugopt_logtime) {
        console.debug("quicktype gen subprocess exit", {
          res_file_path,
          cast_json_parse: `${
            (_json_parse_end_at - _json_parse_start_at) / 1000
          } s`,
          cast_quicktype_gen: `${
            (_quicktype_gen_end_at - _json_parse_end_at) / 1000
          } s`,
          mem_size: SizeOf.get_deno_mem_loginfo(),
        });
      }
      return res;
    }
  }
  console.error("Invalid stdin input", _input_obj);
  throw new Error("Invalid stdin input");
}

async function _quicktype_gen<T>(param: {
  debugopt_logtime: boolean;
  samples: string[];
  typename: string;
  typedesc: string;
  _TIP: string;
  res_file_path: string;
}) {
  try {
    await QuickTypeUtil.init_monkey_patch();
    const {
      debugopt_logtime,
      // samples_res,
      samples,
      typename,
      typedesc,
      _TIP,
      res_file_path,
    } = param;

    //   await cb("A string from a worker");
    // const now = () => (debugopt_logtime ? new Date().getTime() : -1);
    const { jsonInput } = await QuickTypeUtil.myJsonInputForTargetLanguage();
    // const _samples_stringify_start_at = now();
    // const samples = samples_res.map((it) => JSON.stringify(it));
    // const _addsource_start_at = now();
    await jsonInput.addSource({
      name: typename,
      samples,
      description: typedesc + `\n\n${_TIP}`,
    });
    // const _addinput_start_at = now();
    const inputData = new InputData();
    inputData.addInput(jsonInput);
    // const _quicktype_start_at = now();
    const res_quicktype = await quicktype({
      inputData,
      lang: new QuickTypeUtil.MyTypeScriptTargetLanguage(),
      checkProvenance: true,
      debugPrintTimes: debugopt_logtime,
      fixedTopLevels: true,
      rendererOptions: {
        declareUnions: true,
        preferUnions: true,
        preferConstValues: true,
        runtimeTypecheck: true,
        runtimeTypecheckIgnoreUnknownProperties: true,
      },
      combineClasses: true,
      inferMaps: false,
      inferEnums: true,
      inferUuids: false,
      inferDateTimes: false,
      inferIntegerStrings: false,
      inferBooleanStrings: false,
      ignoreJsonRefs: true,
    });
    const res_file_content = res_quicktype.lines.join("\n");
    await Deno.mkdir(path.dirname(res_file_path), {
      mode: 0o700,
      recursive: true,
    });
    await Deno.writeTextFile(res_file_path, res_file_content);
    // const _write_text_file_end_at = now();
  } catch (err) {
    console.error("Error on quicktype_gen worker !", err);
    throw err;
  }
}

if (import.meta.main) {
  await Processes.set_process_title("QuicktypeGen", true);
  await _quicktype_gen_main();
}
