import {
  EnumType,
  getOptionValues,
  jsonInputForTargetLanguage,
  Name,
  RenderContext,
  tsFlowOptions,
  TypeScriptRenderer,
  TypeScriptTargetLanguage,
} from "quicktype-core";

import { utf16StringEscape } from "quicktype-core/dist/support/Strings.js";
import { MonkeyPatch } from "./util.ts";

// async function _unwrap_idbreq<T>(req: IDBRequest<T>) {
//   try {
//     if (req.result !== undefined) {
//       return req.result;
//     }
//     // deno-lint-ignore no-unused-vars
//   } catch (err) {
//     // maybe InvalidStateError , ignore it
//   }
//   return await new Promise<T>((rs, rj) => {
//     req.onsuccess = () => {
//       rs(req.result);
//     };
//     req.onerror = (ev) => {
//       rj(ev);
//     };
//   });
// }

// deno-lint-ignore no-namespace
export namespace QuickTypeUtil {
  // const compressed_json_arrays = "compressed_json_arrays" as const;
  // const compressed_json_objects = "compressed_json_objects" as const;

  export class MyTypeScriptRenderer extends TypeScriptRenderer {
    protected override emitEnum(e: EnumType, enumName: Name): void {
      this.emitDescription(this.descriptionForType(e));
      this.emitLine(["export type ", enumName, " = "]);
      this.forEachEnumCase(e, "none", (_name, jsonName, position) => {
        const suffix = position === "last" || position === "only" ? ";" : " | ";
        this.indent(() =>
          this.emitLine(`"${utf16StringEscape(jsonName)}"`, suffix)
        );
      });
    }
  }

  // // https://github.com/glideapps/quicktype/issues/1234
  export class MyTypeScriptTargetLanguage extends TypeScriptTargetLanguage {
    protected override makeRenderer(
      renderContext: RenderContext,
      // deno-lint-ignore no-explicit-any
      untypedOptionValues: { [name: string]: any },
    ): MyTypeScriptRenderer {
      console.debug("untypedOptionValues : ", untypedOptionValues);
      return new MyTypeScriptRenderer(
        this,
        renderContext,
        getOptionValues(tsFlowOptions, untypedOptionValues),
      );
    }
  }

  // deno-lint-ignore require-await
  export async function myJsonInputForTargetLanguage() {
    const jsonInput = jsonInputForTargetLanguage("typescript");
    return {
      jsonInput,
    } as const;
  }

  let monkey_patch_flag = false;

  export async function init_monkey_patch() {
    if (monkey_patch_flag) {
      throw new Error("Quicktype monkey patch already called");
    }

    const { UnionAccumulator } = await import(
      "quicktype-core/dist/UnionBuilder.js"
    );

    MonkeyPatch.monkey_patch(
      UnionAccumulator.prototype,
      "getMemberKinds",
      // deno-lint-ignore no-explicit-any
      function (this: any, original) {
        if (this.have("enum") && this.have("string")) {
          // deno-lint-ignore no-explicit-any
          const _nonStringTypeAttributes: Map<any, any> =
            this._nonStringTypeAttributes;
          _nonStringTypeAttributes.delete("enum");
        }

        if (this.have("enum") && this.have("string")) {
          console.debug("FUCK in monkey patch !!!!", this);
        }

        return original();
      },
    );

    monkey_patch_flag = true;
  }
}
