// deno-lint-ignore-file no-explicit-any
import path from "node:path";
import { DOMParser } from "jsr:@b-fuze/deno-dom";

export async function write_file(param: {
  file_path: string;
  creator:
    | {
        mode: "text";
        content: () => Promise<string>;
      }
    | {
        mode: "symlink";
        old: string;
        allow_old_not_found: boolean;
      };
  log_tag: {
    alia_name: string;
  };
}) {
  const { file_path, creator, log_tag } = param;
  const { alia_name } = log_tag;
  let file_info: Deno.FileInfo;
  try {
    file_info = await Deno.lstat(file_path);
    console.log(`exists ${alia_name} at ${file_path}`);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
    console.log(`not exists ${alia_name} and creating it on ${file_path}`);
    await Deno.mkdir(path.dirname(file_path), {
      recursive: true,
      mode: 0o700,
    });
    if (creator.mode === "text") {
      const fsfile = await Deno.create(file_path);
      try {
        await fsfile.write(new TextEncoder().encode(await creator.content()));
        console.log(`success write text for ${alia_name} at ${file_path}`);
      } finally {
        fsfile.close();
      }
    } else if (creator.mode === "symlink") {
      try {
        const old_info = await Deno.lstat(creator.old);
        console.log(
          `exists old target at ${creator.old} , create symlink at ${file_path} , old info is`,
          old_info
        );
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
        if (creator.allow_old_not_found) {
          console.warn("not found old target at", creator.old);
        } else {
          console.error("not found old target at", creator.old);
          throw err;
        }
      }
      await Deno.symlink(creator.old, file_path);
      console.log(
        `success symlink for ${alia_name} from ${creator.old} to ${file_path}`
      );
    } else {
      throw Error("Invalid param `creator.mode` , creator is", creator);
    }
    file_info = await Deno.lstat(file_path);
  }
  return file_info;
}

export function sleep(ms: number) {
  return new Promise<void>((rs, rj) => {
    if (ms <= 0) {
      rs();
    } else {
      setTimeout(() => {
        try {
          rs();
        } catch (err) {
          rj(err);
        }
      }, ms);
    }
  });
}

type TuplesOfLengthsUpToAndBeyond<
  N extends number,
  T extends 0[] = [0]
> = T[N] extends undefined
  ?
      | TuplesOfLengthsUpToAndBeyond<N, [...T, ...T]>
      | [...T, ...TuplesOfLengthsUpToAndBeyond<N, [...T, ...T]>]
  : [];

type LessThanOrEqual<N extends number> =
  TuplesOfLengthsUpToAndBeyond<N> extends infer O
    ? O extends any[]
      ? O[N] extends undefined
        ? O["length"]
        : never
      : never
    : never;

/**
 * Copy from:
 * https://stackoverflow.com/a/65054841/21185704
 */
export type LessThan<N extends number> = Exclude<LessThanOrEqual<N>, N>;

/**
 * Copy from:
 * https://stackoverflow.com/a/73369825/21185704
 */
export type LengthOfString<
  S extends string,
  Acc extends 0[] = []
> = string extends S
  ? S extends string
    ? number
    : never
  : S extends `${string}${infer $Rest}`
  ? LengthOfString<$Rest, [...Acc, 0]>
  : Acc["length"];

// deno-lint-ignore no-namespace
export namespace Strs {
  export function endswith<E extends string>(
    text: string,
    end: E
  ): text is `${string}${E}` {
    return text.endsWith(end);
  }

  export function startswith<S extends string>(
    text: string,
    head: S
  ): text is `${S}${string}` {
    return text.startsWith(head);
  }

  export function concat_string<A extends string, B extends string>(
    a: A,
    b: B
  ): `${A}${B}` {
    return (a + b) as `${A}${B}`;
  }

  export function remove_suffix<
    E extends string,
    T extends `${R}${E}`,
    R extends string = T extends `${infer P}${E}` ? P : never
  >(text: T, end: E): R {
    if (endswith(text, end)) {
      return text.slice(0, text.length - end.length) as R;
    } else {
      throw new Error(`Text ${text} not endswith ${end}`);
    }
  }

  export function remove_prefix<
    P extends string,
    T extends `${P}${R}`,
    R extends string = T extends `${P}${infer S}` ? S : never
  >(text: T, start: P): R {
    if (startswith(text, start)) {
      return text.slice(start.length) as R;
    } else {
      throw new Error(`Text ${text} not startswith ${start}`);
    }
  }

  export function parse_number<R extends number>(
    value: string | number,
    nan_if: (
      source_value: string | number | null,
      cause_value: string | number
    ) => R = (source_value, cause_value) => {
      throw new Error(
        `Why NaN on parse_number : source_value=${source_value}, cause_value=${cause_value}`
      );
    },
    source_value: string | number | null = null
  ): R | number {
    if (typeof value === "number") {
      return value;
    }
    const source_value_v2 = source_value === null ? value : source_value;
    value = value.trim();
    if (startswith(value, ".")) {
      return parse_number(concat_string("0", value), nan_if, source_value_v2);
    }
    const chinese_quantifier_endings = [
      ["十", 10],
      ["百", 100],
      ["千", 1000],
      ["万", 10000],
      ["亿", 10000_0000],
    ] as const;
    for (const [
      chinese_quantifier,
      chinese_quantifier_multi,
    ] of chinese_quantifier_endings) {
      if (endswith(value, chinese_quantifier)) {
        const x = remove_suffix(value, chinese_quantifier);
        return (
          parse_number(x, nan_if, source_value_v2) * chinese_quantifier_multi
        );
      }
    }
    const parse_float_res = parseFloat(value);
    if (!isNaN(parse_float_res)) {
      return parse_float_res;
    } else {
      return nan_if(source_value, value);
    }
  }

  export function strip_html(html_text: string) {
    const doc = new DOMParser().parseFromString(
      `<p>${html_text}</p>`,
      "text/html"
    );
    return doc.textContent;
  }

  export function type_guard_length<S extends string>(
    _text: S
  ): _text is S & Record<"length", LengthOfString<S>> {
    return true;
  }

  export function to_string<X extends number | string>(x: X) {
    const r = x.toString() as `${X}`;
    if (!type_guard_length(r)) {
      throw new Error();
    }
    return r;
  }
}

// deno-lint-ignore no-namespace
export namespace Times {
  export function unix_to_time(unix_ms_or_s: number): Date {
    let unit: "s" | "ms";
    if (unix_ms_or_s < 12345678900) {
      unit = "ms";
    } else {
      unit = "s";
    }
    return new Date(unix_ms_or_s / (unit === "ms" ? 1000 : 1));
  }

  export function parse_duration_sec(text: string) {
    let sum: number = 0;
    const arr = text.split(":");
    for (let i = 0; i < arr.length; i++) {
      const time_col = arr.length - 1 - i;
      let sec_unit: 1 | 60 | 3600;
      // arrlen i  sec    time_col
      // 3      0  3600   2
      // 3      1  60     1
      // 3      2  1      0
      // 2      0  60     1
      // 2      1  1      0
      // 1      0  1      0
      switch (time_col) {
        case 0:
          sec_unit = 1;
          break;
        case 1:
          sec_unit = 60;
          break;
        case 2:
          sec_unit = 3600;
          break;
        default:
          return "Split array length out of range";
      }
      const v = Strs.parse_number(arr[i], () => NaN);
      if (isNaN(v)) {
        return "NaN";
      }
      if (i !== 0 && v >= 60) {
        return "Non-first value ge 60";
      }
      sum += sec_unit * v;
    }
    return sum;
  }
}

export type TableLike<K extends string = string> = Record<
  K,
  string | number | null
>[];

// deno-lint-ignore no-namespace
export namespace Json {
  export type JsonDumpOption = {
    mode?: "JSON";
    indent?: number;
  };

  export function dump(obj: any, option?: JsonDumpOption) {
    if (!option) {
      option = {};
    }
    const replacer = (_k: string, v: any) => {
      return typeof v === "bigint" ? Number(v) : v;
    };
    if (option.mode === undefined || option.mode === "JSON") {
      return JSON.stringify(obj, replacer, option.indent);
    }
    // else if (option.mode === "JSON5") {
    //   return JSON5.stringify(obj, replacer, option.indent);
    // }
    else {
      throw new Error(`Invalid option.mode ${option.mode}`);
    }
  }
}

