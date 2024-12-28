// deno-lint-ignore-file no-explicit-any
import path from "node:path";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import deepEqual from "deep-equal";

import { MultiProgressBar } from "jsr:@deno-library/progress";
import { time } from "node:console";

export function is_nullish(obj: any): obj is null | undefined {
  return obj === null || obj === undefined;
}

export function is_deep_equal<B>(a: unknown, b: B): a is B {
  if (a === b) {
    return true;
  }
  if (a && b && typeof a == "object" && typeof b == "object") {
    if (a.constructor !== b.constructor) return false;
    // let length, i, keys;
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) {
        return false;
      }
      const length = a.length;
      if (length != b.length) return false;
      for (let i = length - 1; i >= 0; i--) {
        if (!is_deep_equal(a[i], b[i])) return false;
      }
      return true;
    } else {
      const keys = Object.keys(a);
      const length = keys.length;
      if (length !== Object.keys(b).length) return false;

      for (let i = length - 1; i >= 0; i--)
        if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

      for (let i = length - 1; i >= 0; i--) {
        const key = keys[i];
        if (!is_deep_equal((a as any)[key], (b as any)[key])) return false;
      }
      return true;
    }
  } else {
    // true if both NaN, false otherwise
    return a !== a && b !== b;
  }
}

export function chain<T>(init_value: () => T) {
  const cache = {
    value: null as null | T,
  };
  return {
    get_value() {
      return !is_nullish(cache.value)
        ? cache.value
        : (cache.value = init_value());
    },
    map<R>(mapper: (value: T) => R) {
      return chain(() => mapper(this.get_value()));
    },
    array_wrap_nonnull(): T extends Typings.Nullish
      ? []
      : Typings.Nullish extends T
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

// deno-lint-ignore no-namespace
export namespace Typings {
  export type Nullish = null | undefined;

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

  export type DeepReadonly<T> = Readonly<{
    [K in keyof T]: T[K] extends number | string | symbol // Is it a primitive? Then make it readonly
      ? Readonly<T[K]>
      : // Is it an array of items? Then make the array readonly and the item as well
      T[K] extends Array<infer A>
      ? Readonly<Array<DeepReadonly<A>>>
      : // It is some other object, make it readonly as well
        DeepReadonly<T[K]>;
  }>;

  export type Comparable = bigint | number | Date;

  /**
   * Copy from:
   * https://stackoverflow.com/a/76698672/21185704
   */
  export type Range<
    T extends number,
    Arr extends number[] = []
  > = Arr["length"] extends T ? Arr[number] : Range<T, [...Arr, Arr["length"]]>;

  export type MapToRecord<
    P extends Map<K, V>,
    K extends keyof any = Parameters<P["get"]>[0],
    V = NonNullable<ReturnType<P["get"]>>
  > = ReturnType<typeof Mappings.map_to_record<K, V>>;
}

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
  ): _text is S & Record<"length", Typings.LengthOfString<S>> {
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
  export function unix_to_time(unix_ms_or_s: number): Date | null {
    let unit: "s" | "ms";
    if (unix_ms_or_s === 0) {
      return null;
    }

    if (unix_ms_or_s > 12345678900) {
      unit = "ms";
    } else {
      unit = "s";
    }
    const timestamp_s = unix_ms_or_s / (unit === "ms" ? 1000 : 1);
    if (timestamp_s < 123456789) {
      throw new Error(
        `197x year timestamp ? unit is ${unit} , timestamp is ${timestamp_s} , unix_ms_or_s is ${unix_ms_or_s} , to date is ${new Date(
          timestamp_s
        )}`
      );
    }
    return new Date(timestamp_s * 1000);
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

  export function format_yyyymmddhhmmss(date: Date) {
    const d = new Date(date),
      year = d.getFullYear();
    let month = "" + (d.getMonth() + 1),
      day = "" + d.getDate(),
      hour = "" + d.getHours(),
      minute = "" + d.getMinutes(),
      second = "" + d.getSeconds();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    if (hour.length < 2) hour = "0" + hour;
    if (minute.length < 2) minute = "0" + minute;
    if (second.length < 2) second = "0" + second;

    return [year, month, day, hour, minute, second].join("");
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
  export function take_extreme_value<
    A extends readonly [T, ...T[]],
    T extends Typings.Comparable | null = A[number]
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

  // export type NumberLike = number | `${number}`;

  // export type IsZero<N extends NumberLike> = Typings.CheckLeftIsExtendsRight<
  //   N,
  //   0 | "0"
  // >;
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

  export function first_or_null<T>(arr: T[]) {
    if (length_greater_then_0(arr)) {
      return first(arr);
    } else {
      return null;
    }
  }

  export function last<T>(arr: [T, ...T[]]) {
    return arr[arr.length - 1];
  }

  export function last_or_null<T>(arr: T[]) {
    if (length_greater_then_0(arr)) {
      return last(arr);
    } else {
      return null;
    }
  }
}

// deno-lint-ignore no-namespace
export namespace Mappings {
  /**
   * Object.fromEntries
   *
   * Copy from:
   * https://stackoverflow.com/a/76176570/21185704
   */
  export const object_from_entries = <
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
  export const object_entries = <T extends Record<PropertyKey, unknown>>(
    obj: T
  ): { [K in keyof T]: [K, T[K]] }[keyof T][] => {
    return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][];
  };

  export function filter_keys<
    T extends Record<string, any>,
    OPT extends "omit" | "pick",
    KS extends (keyof T)[]
  >(
    obj: T,
    opt: OPT,
    keys: KS
  ): typeof opt extends "omit"
    ? Omit<T, (typeof keys)[number]>
    : Pick<T, (typeof keys)[number]> {
    return object_from_entries(
      object_entries(obj).filter(([k, _]) =>
        opt === "omit" ? keys.indexOf(k) < 0 : keys.indexOf(k) >= 0
      )
    ) as any;
  }

  export function map_to_record<K extends keyof any, V>(
    m: Map<K, V>
  ): Record<K, V> {
    const obj: Record<K, V> = {} as any;
    for (const [key, value] of m) {
      obj[key] = value;
    }
    return obj;
  }
}

// deno-lint-ignore no-namespace
export namespace DataClean {
  export type HttpUrl = `https://${string}` | `http://${string}`;

  export function url_use_https_noempty<S extends string>(url: S) {
    if (!Strs.is_not_empty(url)) {
      throw new Error(`url is empty : ${JSON.stringify(url)}`);
    }
    if (Strs.startswith(url, "https://")) {
      return url;
    }
    if (Strs.startswith(url, "http://")) {
      const _url: `http://${string}` = url;
      return `https://${Strs.remove_prefix(_url, "http://")}` as const;
    }
    if (url.indexOf("://") >= 0) {
      throw new Error(`Not http or https protocol : ${url}`);
    }
    let url2: string = url;
    while (Strs.startswith(url2, "/")) {
      url2 = Strs.remove_prefix(url2, "/");
    }
    return `https://${url2}` as const;
  }

  export function url_use_https_emptyable<S extends string>(url: S | null) {
    if (Strs.is_not_empty(url)) {
      return url_use_https_noempty(url);
    } else {
      return null;
    }
  }

  export type NaturalNumber = bigint;

  export function cast_and_must_be_natural_number(n: number): NaturalNumber {
    if (isNaN(n)) {
      throw new Error("NaN");
    }
    if (!Number.isInteger(n)) {
      throw new Error(`${n} is not integer`);
    }
    if (typeof n !== "number") {
      throw new Error(`${n} is not type number`);
    }
    if (n < 0) {
      throw new Error(`${n} is less then zero`);
    }
    return BigInt(n);
  }

  export function nan_to_null(n: number | string | null | undefined) {
    if (n === null || n === undefined) {
      return null;
    }
    if (typeof n === "string") {
      return nan_to_null(parseFloat(n));
    } else {
      return isNaN(n) ? null : n;
    }
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
      if (i >= arr.length - 1) {
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

  export function timeline_to_json<V>(timeline: Timeline<V>) {
    return timeline.map((it) => {
      return {
        time: it.time === "unknown" ? "unknown" : it.time.toISOString(),
        value: it.value,
      };
    });
  }
}

// deno-lint-ignore no-namespace
export namespace ProcessBar {
  export function create_scope<R>(
    setting: {
      title: string;
    },
    scope: (bars: {
      render: (
        render_param: {
          completed: number;
          total: number;
          text: string;
        }[]
      ) => Promise<void>;
    }) => Promise<R>
  ) {
    const { title } = setting;
    const bars = new MultiProgressBar({
      title,
      complete: "=",
      incomplete: "-",
      display: "[:bar] :percent :time :completed/:total :text |",
    });
    return (async () => {
      const res = await scope({
        render: async (render_param) => {
          await bars.render(render_param);
        },
      });
      await bars.end();
      return res;
    })();
  }

  export type SingleBarSetter = {
    set_completed: (value: number) => Promise<void>;
    set_total: (value: number) => Promise<void>;
    set_text: (value: string) => Promise<void>;
  };

  /**
   * 每个任务一个进度条
   */
  export function bind_each<
    P,
    R,
    Tasks extends ((param: P, bar: SingleBarSetter) => Promise<R>)[]
  >(
    tasks: Tasks,
    bars_render: Parameters<Parameters<typeof create_scope>[1]>[0]["render"]
  ) {
    const render_params_handler: {
      value: null | Parameters<typeof bars_render>[0];
    } = {
      value: null,
    };
    const update = async () => {
      if (render_params_handler.value) {
        await bars_render(Json.copy(render_params_handler.value));
      }
    };

    const tasks_wrap = tasks.map((task, idx) => {
      const render_param = {
        completed: 0,
        total: 100,
        text: `(function ${task.name} [at ${idx}])`,
      };
      const bar = {
        set_completed: async (value: number) => {
          if (render_param.completed !== value) {
            render_param.completed = value;
            await update();
          }
        },
        set_total: async (value: number) => {
          if (render_param.total !== value) {
            render_param.total = value;
            await update();
          }
        },
        set_text: async (value: string) => {
          if (render_param.text !== value) {
            render_param.text = value;
            await update();
          }
        },
      };
      return {
        task: (param: P) => task(param, bar),
        render_param,
      };
    });

    const render_params = tasks_wrap.map((it) => it.render_param);
    render_params_handler.value = render_params;

    return tasks_wrap.map((it) => it.task);
  }

  /**
   * 一个代表完成所有任务的进度条
   */
  export function bind_all<R, Tasks extends (() => Promise<R>)[]>(
    tasks: Tasks,
    bars_render: Parameters<Parameters<typeof create_scope>[1]>[0]["render"]
  ) {
    let completed = 0;
    return tasks.map((task) => {
      return async () => {
        const res = await task();
        completed++;
        await bars_render([{ completed, total: tasks.length, text: "" }]);
        return res;
      };
    });
  }
}

// deno-lint-ignore no-namespace
export namespace Streams {
  export function* split_array_use_batch_size<T>(batch_size: number, arr: T[]) {
    if (batch_size <= 0 || typeof batch_size !== "number") {
      throw new Error(`Invalid batch_size ${batch_size}`);
    }
    for (let start = 0; start < arr.length; start += batch_size) {
      const end = Math.min(start + batch_size, arr.length);
      yield {
        start,
        end,
        total: arr.length,
        sliced: arr.slice(start, end),
      };
    }
  }
}

// deno-lint-ignore no-namespace
export namespace Errors {
  export function logerror_and_throw(msg: string, obj: object): never {
    console.error(msg, obj);
    throw new Error(`${msg}`, { cause: obj });
  }
}
