// deno-lint-ignore-file no-explicit-any
import path from "node:path";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import deepEqual from "deep-equal";
export type Nullish = null | undefined;

export function is_nullish(obj: any): obj is null | undefined {
  return obj === null || obj === undefined;
}

export function chain<T>(init_value: () => T) {
  const cache = {
    value: null as null | T,
  };
  return {
    get_value() {
      return is_nullish(cache.value)
        ? cache.value
        : (cache.value = init_value());
    },
    map<R>(mapper: (value: T) => R) {
      return chain(() => mapper(this.get_value()));
    },
    array_wrap_nonnull(): T extends Nullish
      ? []
      : Nullish extends T
      ? [T] | []
      : [T] {
      const v = this.get_value();
      if (v === null || v === undefined) {
        return [] as any;
      } else {
        return [v] as any;
      }
    },
  };
}

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

export type DeepReadonly<T> = Readonly<{
  [K in keyof T]: T[K] extends number | string | symbol // Is it a primitive? Then make it readonly
    ? Readonly<T[K]>
    : // Is it an array of items? Then make the array readonly and the item as well
    T[K] extends Array<infer A>
    ? Readonly<Array<DeepReadonly<A>>>
    : // It is some other object, make it readonly as well
      DeepReadonly<T[K]>;
}>;

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

/**
 * Object.fromEntries
 *
 * Copy from:
 * https://stackoverflow.com/a/76176570/21185704
 */
export const typeSafeObjectFromEntries = <
  const T extends ReadonlyArray<readonly [PropertyKey, unknown]>
>(
  entries: T
): { [K in T[number] as K[0]]: K[1] } => {
  return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };
};

/**
 * Object.entries
 * (add const param for less broader types (ie. string -> "apple") -> const T extends Record<PropertyKey, unknown>)
 *
 * Copy from:
 * https://stackoverflow.com/a/76176570/21185704
 */
export const typeSafeObjectEntries = <T extends Record<PropertyKey, unknown>>(
  obj: T
): { [K in keyof T]: [K, T[K]] }[keyof T][] => {
  return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][];
};

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

  export function check_length_property<S extends string>(
    _text: S
  ): _text is S & Record<"length", LengthOfString<S>> {
    return true;
  }

  export function to_string<X extends number | string>(x: X) {
    const r = x.toString() as `${X}`;
    if (!check_length_property(r)) {
      throw new Error("assert true");
    }
    return r;
  }

  export function is_not_empty(
    x: string | null | undefined
  ): x is string & Exclude<string, ""> {
    return x !== null && x !== undefined && x.trim() !== "";
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

// deno-lint-ignore no-namespace
export namespace Json {
  export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONObject
    | JSONArray;

  export type JSONObject = {
    [x: string]: JSONValue;
  };

  export type JSONArray = Array<JSONValue>;

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

  export function copy<T extends JSONValue>(obj: T) {
    return JSON.parse(Json.dump(obj)) as T;
  }
}

// deno-lint-ignore no-namespace
export namespace Nums {
  export type Comparable = bigint | number | Date;

  export type NaturalNumber = bigint;

  export function requireNaturalNumber(n: number): NaturalNumber {
    try {
      const r = BigInt(n.toString());
      if (r < 0) {
        throw new Error(`less then zero : ${r}`);
      }
      return r;
    } catch (err) {
      throw new Error(`not integer : ${n} <<< cause by ${err}`);
    }
  }

  export function take_extreme_value<
    A extends readonly [T, ...T[]],
    T extends Comparable | null = A[number]
  >(
    mode: "max" | "min",
    nums: A
  ): Arrays.AllNullable<A> extends false ? NonNullable<T> : T | null {
    let res_max: T = nums[0];
    for (let i = 0; i < nums.length; i++) {
      const item = nums[i];
      if (res_max === null) {
        res_max = item;
      } else if (item === null) {
        continue;
      } else if (mode === "max") {
        res_max = item > res_max ? item : res_max;
      } else if (mode === "min") {
        res_max = item < res_max ? item : res_max;
      }
    }
    return res_max as any;
  }
}

// deno-lint-ignore no-namespace
export namespace Arrays {
  export function length_greater_then_0<T>(arr: T[]): arr is [T, ...T[]] {
    return arr.length > 0;
  }

  export type AllNullable<A> = A extends [infer U, ...infer P]
    ? null extends U
      ? AllNullable<P>
      : false
    : true;

  export function first<T>(arr: [T, ...T[]]) {
    return arr[0];
  }
}

// deno-lint-ignore no-namespace
export namespace DataMerge {
  export type Timeline<V> = {
    time: Date | "unknown";
    value: V;
  }[];

  export function merge_and_sort_timeline<V>(param: {
    old: Timeline<V>;
    timeline: Timeline<V>;
  }) {
    const { old, timeline } = param;
    const arr = [...old, ...timeline];
    arr.sort((a, b) => {
      const at = a.time === "unknown" ? 0 : a.time.getTime();
      const bt = b.time === "unknown" ? 0 : b.time.getTime();
      return at - bt;
    });
    for (let i = 0; i < arr.length; ) {
      const a = arr[i];
      if (i >= arr.length) {
        break;
      }
      const b = arr[i + 1];
      if (deepEqual(a.value, b.value)) {
        arr.splice(i + 1, 1);
      } else {
        i++;
      }
    }
    return arr;
  }
}

// export function group_by<K extends string | number, T>(
//   arr: T[],
//   get_key: (it: T) => K,
//   on_key_duplicate: (
//     old: T & { group: T[] },
//     cur: T,
//     key: K
//   ) => T & { group: T[] } = (old, cur, _key) => ({
//     ...cur,
//     group: [...old.group, cur],
//   })
// ) {
//   // const { arr, get_key, on_duplicate } = param;
//   const res = new Map<string | number, T & { group: T[] }>();
//   for (const cur of arr) {
//     const k = get_key(cur);
//     if (res.has(k)) {
//       const old = res.get(k);
//       if (old === undefined) {
//         throw new Error(`why got undefined when has key ${k} , res is ${res}`);
//       }
//       res.set(k, on_key_duplicate(old, cur, k));
//     } else {
//       res.set(k, {
//         ...cur,
//         group: [cur],
//       });
//     }
//   }
//   return res;
// }
