// deno-lint-ignore-file no-explicit-any
import path from "node:path";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { parseChineseNumber } from "parse-chinese-number";
import { MultiProgressBar } from "jsr:@deno-library/progress";
import { PlatformEnum } from "./general_data_process/media.ts";
import { Paragraphs } from "./general_data_process/paragraph_analysis.ts";
import JSON5 from "json5";
import NumberParser from "intl-number-parser";
import { delay } from "@std/async/delay";
import { equal } from "@std/assert/equal";
import jsonata from "jsonata";
import { encodeHex } from "jsr:@std/encoding/hex";
import { isDate } from "node:util/types";
import { Buffer } from "node:buffer";
import { createStringifyStream } from "big-json";
import { safeDestr } from "destr";
import * as Comlink from "comlink";
import { type EvaluateJsonataExp } from "./workers/evaluate_jsonata_exp.ts";
import AsyncLock from "async-lock";
import { JsonStreamStringify } from "json-stream-stringify";
import { Writable } from "node:stream";
import { JSONParser } from "@streamparser/json";

export function is_nullish(obj: any): obj is null | undefined {
  return obj === null || obj === undefined;
}

export function is_deep_equal<B>(a: unknown, b: B): a is B {
  return equal(a, b);
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
        overwrite?: boolean;
      }
    | {
        mode: "symlink";
        old: string;
        allow_old_not_found: boolean;
      };
  log_tag:
    | "no"
    | {
        alia_name: string;
      };
}) {
  const { file_path, creator, log_tag } = param;
  const { alia_name } = log_tag === "no" ? {} : log_tag;
  // let overwrite: boolean;
  if ("overwrite" in creator && creator.overwrite === true) {
    if (log_tag !== "no") {
      console.log(`skip checking existed for ${alia_name} ( at ${file_path} )`);
    }
    // overwrite = true;
  } else {
    try {
      const file_info = await Deno.lstat(file_path);
      if (log_tag !== "no") {
        console.log(`exists ${alia_name} ( at ${file_path} )`);
      }
      return file_info;
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
      }
      if (log_tag !== "no") {
        console.log(`not exists ${alia_name} and creating it on ${file_path}`);
      }
    }
    // overwrite = false;
  }
  await Deno.mkdir(path.dirname(file_path), {
    recursive: true,
    mode: 0o700,
  });
  if (creator.mode === "text") {
    const fsfile = await Deno.create(file_path);
    try {
      await fsfile.write(new TextEncoder().encode(await creator.content()));
      if (log_tag !== "no") {
        console.log(`success write text for ${alia_name} ( at ${file_path} )`);
      }
    } finally {
      fsfile.close();
    }
  } else if (creator.mode === "symlink") {
    try {
      const old_info = await Deno.lstat(creator.old);
      if (log_tag !== "no") {
        console.log(
          `exists old target at ${creator.old} , create symlink at ${file_path} , old info is`,
          old_info
        );
      }
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
      }
      if (creator.allow_old_not_found) {
        if (log_tag !== "no") {
          console.warn("not found old target at", creator.old);
        }
      } else {
        if (log_tag !== "no") {
          console.error("not found old target at", creator.old);
        }
        throw err;
      }
    }
    await Deno.symlink(creator.old, file_path);
    if (log_tag !== "no") {
      console.log(
        `success symlink for ${alia_name} from ${creator.old} to ${file_path}`
      );
    }
  } else {
    throw Error("Invalid param `creator.mode` , creator is", creator);
  }
  return await Deno.lstat(file_path);
}

/**
 * https://stackoverflow.com/a/41854075/21185704
 */
export function name_function(name: string, body: (...args: any[]) => any) {
  return {
    [name](...args: any[]) {
      return body.apply(this, args);
    },
  }[name];
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

  export type ComparableUseOpt = bigint | number | Date;
  export type ComparableUseProto = Temporal.Instant;
  export type Comparable = ComparableUseOpt | ComparableUseProto;

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

  // -------------------------------------------
  // https://stackoverflow.com/a/55128956/21185704

  // oh boy don't do this
  export type UnionToIntersection<U> = (
    U extends any ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never;
  type LastOf<T> = UnionToIntersection<
    T extends any ? () => T : never
  > extends () => infer R
    ? R
    : never;

  // TS4.0+
  type Push<T extends any[], V> = [...T, V];

  // TS4.1+
  export type TuplifyUnion<
    T,
    L = LastOf<T>,
    N = [T] extends [never] ? true : false
  > = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;
  // -------------------------------------------

  // export type KeyNonNullableExclude<T, E = never> = {
  //   [K in keyof T]-?: K extends E
  //     ? NonNullable<T[K]> | null
  //     : NonNullable<T[K]>;
  // };

  // export type KeyNonNullableInclude<T, I> = {
  //   [K in keyof T]-?: K extends I
  //     ? NonNullable<T[K]>
  //     : NonNullable<T[K]> | null;
  // };

  export type MinusOptional<T, K extends keyof T> = Pick<
    T,
    Exclude<keyof T, K>
  > & {
    [P in K]-?: T[P];
  };

  export function has_nonnull_property_2<T, P extends keyof T>(
    t: T,
    p: P
  ): t is T &
    (Extract<T, { P?: any }> extends { P?: infer V }
      ? Record<P, NonNullable<V>>
      : Record<P, unknown>) {
    return has_nonnull_property(t, p);
  }

  export type HasNonnullProperty<
    T,
    P extends string | number | symbol | keyof T
  > = T &
    (Extract<T, { P?: unknown } | { P: unknown }> extends { P?: infer V }
      ? Record<P, NonNullable<V>>
      : Record<P, unknown>);

  export function has_nonnull_property<
    T,
    P extends string | number | symbol | keyof T
  >(t: T, p: P): t is HasNonnullProperty<T, P> {
    if (typeof t !== "object" || t === null) {
      return false;
    }
    if (p in t) {
      const _t: any = t;
      return _t[p] !== undefined && _t[p] !== null;
    } else {
      return false;
    }
  }

  export type Values<T> = T[keyof T];

  export type Concrete<T> = { [P in keyof T]-?: T[P] };

  /**
   * https://stackoverflow.com/a/49402091/21185704
   */
  export type AvailableKeys<T> = Exclude<
    T extends T ? keyof T : never,
    keyof unknown[]
  >;

  type _Test_AvailableKeys = AvailableKeys<
    | { id: 1 }
    | { id: 2 }
    | { str?: "aa" }
    | { str?: "bb" }
    | { name: "a" }
    | { name?: "b" }
  >;

  /**
   * https://stackoverflow.com/a/79613705/21185704
   */
  export type ReduceUnionMapping<
    A,
    P = Record<never, never>,
    C = LastOf<A>,
    Stop = [A] extends [never] ? true : false
  > = true extends Stop
    ? P
    : ReduceUnionMapping<
        Exclude<A, C>,
        {
          [K in keyof C | keyof P]: K extends keyof C
            ? K extends keyof P
              ? C[K] | P[K]
              : C[K]
            : K extends keyof P
            ? P[K]
            : never;
        }
      >;

  type _Test_UnionReduceMap = ReduceUnionMapping<
    | { id: 1; xxx: 1 }
    | { id: 2; xxx: 2 }
    | { str?: "aa"; xxx: 3 }
    | { str?: "bb"; xxx: 4 }
    | { name: "a"; xxx: 5 }
    | { name?: "b"; xxx: 6 }
  >;

  export type RemovePrefixRecursion<
    T extends string,
    C extends string
  > = T extends `${C}${infer S}` ? RemovePrefixRecursion<S, C> : T;
  export type RemoveSuffixRecursion<
    T extends string,
    C extends string
  > = T extends `${infer P}${C}` ? RemoveSuffixRecursion<P, C> : T;

  type _Test_RemovePrefixRecursion = RemovePrefixRecursion<"aaaaa114514", "aa">;
  type _Test_RemoveSuffixRecursion = RemoveSuffixRecursion<"114514aaaaa", "aa">;

  export type RemovePrefixSuffixRecursion<
    T extends string,
    C extends string
  > = RemoveSuffixRecursion<RemovePrefixRecursion<T, C>, C>;

  type _Test_RemovePrefixSuffixRecursion = RemovePrefixSuffixRecursion<
    "aaaaa114514aaaaa",
    "aa"
  >;

  export type PickStringProps<Source extends object> = Pick<
    Source,
    {
      [Key in keyof Source]: Source[Key] extends string ? Key : never;
    }[keyof Source]
  >;
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
    R extends string = string extends T
      ? string
      : T extends `${P}${infer S}`
      ? S
      : never
  >(text: T, start: P): R {
    if (startswith(text, start)) {
      return text.slice(start.length) as R;
    } else {
      throw new Error(`Text ${text} not startswith ${start}`);
    }
  }

  export function remove_prefix_recursion<C extends string, T extends string>(
    text: T,
    char: C
  ): Typings.RemovePrefixRecursion<T, C> {
    let t: string = text;
    while (startswith(t, char)) {
      t = remove_prefix(t, char);
    }
    return t as any;
  }

  export function remove_suffix_recursion<C extends string, T extends string>(
    text: T,
    char: C
  ): Typings.RemoveSuffixRecursion<T, C> {
    let t: string = text;
    while (endswith(t, char)) {
      t = remove_suffix(t, char);
    }
    return t as any;
  }

  export function remove_prefix_suffix_recursion<
    C extends string,
    T extends string
  >(text: T, char: C): Typings.RemovePrefixSuffixRecursion<T, C> {
    return remove_suffix_recursion(remove_prefix_recursion(text, char), char);
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

  export function to_unicode(str: string) {
    const add_zeros = (str2: string) => {
      return ("0000" + str2).slice(-4);
    };
    return str
      .split("")
      .map((char) => add_zeros(char.charCodeAt(0).toString(16)))
      .join("");
  }

  /**
   * 判断是否非空白。一些字符也会被视为空白。
   *
   * 视为空白的字符，参见： @var empty_chars
   */
  export function is_not_blank(x: string | null | undefined): x is string {
    if (x === null || x === undefined) {
      return false;
    }
    let x2 = x;
    while (true) {
      x2 = x2.trim();
      for (const ch of empty_chars) {
        x2 = x2.replaceAll(ch, "");
      }
      if (x2 === "") {
        return false;
      }
      if (x === x2) {
        return true;
      }
      x = x2;
    }
  }

  // TODO:
  // https://invisible-characters.com/
  //

  export const empty_chars_cannot_trim = [
    "\0", // 0000
    "\u00ad",
    "\u2800",
    "\u034f",
    "\u061c",
    "\u115f",
    "\u1160",
    "\u17b4",
  ] as const;

  export const empty_chars_can_trim = [
    "\t", // 0009
    "\n", // 000a
    " ", // 0020
    "\u00a0",
    "\u2000",
    "\u2001",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200a",
    "\u2028",
    "\u205f",
    "\u3000",
  ] as const;

  export const empty_chars = [
    ...empty_chars_can_trim,
    ...empty_chars_cannot_trim,
  ] as const;

  export function parse_utf8(bytes: Uint8Array) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  export function join<A extends string, B extends string>(
    a: A,
    b: B
  ): `${A}${B}` {
    return `${a}${b}`;
  }

  export function join_everyone_with_remove_prefix_suffix_recursion<
    C extends string,
    T extends string
  >(split_char: C, first: T) {
    const trimed_first = Strs.remove_prefix_suffix_recursion(first, split_char);
    const create_option = () => {
      return {
        ok() {
          return trimed_first;
        },
        and_join<V extends string>(item: V) {
          const trimed_item = Strs.remove_prefix_suffix_recursion(
            item,
            split_char
          );
          const next = join(join(trimed_first, split_char), trimed_item);
          return join_everyone_with_remove_prefix_suffix_recursion(
            split_char,
            next
          );
        },
      };
    };
    return create_option();
  }
}

// deno-lint-ignore no-namespace
export namespace Times {
  export function unix_to_time(unix_ms_or_s: number): Temporal.Instant | null {
    let unit: "s" | "ms";
    if (unix_ms_or_s === 0) {
      return null;
    }

    if (BigInt(unix_ms_or_s) > BigInt("12345678900000")) {
      throw new Error(`Unsupport nano second unit , number is ${unix_ms_or_s}`);
    } else if (unix_ms_or_s > 12345678900) {
      unit = "ms";
    } else {
      unit = "s";
    }
    const timestamp_s = unix_ms_or_s / (unit === "ms" ? 1000.0 : 1);
    if (timestamp_s < 123456789) {
      throw new Error(
        `197x year timestamp ? unit is ${unit} , timestamp is ${timestamp_s} , unix_ms_or_s is ${unix_ms_or_s} , to date is ${new Date(
          timestamp_s
        )}`
      );
    }
    return Temporal.Instant.fromEpochMilliseconds(timestamp_s * 1000);
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
      const v = DataClean.parse_number(arr[i], () => NaN);
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

  export function parse_text_to_instant(text: string) {
    const errors = [];
    try {
      return Temporal.Instant.from(text);
    } catch (err) {
      errors.push(err);
    }
    try {
      return Temporal.ZonedDateTime.from(text).toInstant();
    } catch (err) {
      errors.push(err);
    }
    try {
      return Temporal.PlainDateTime.from(text)
        .toZonedDateTime("UTC")
        .toInstant();
    } catch (err) {
      errors.push(err);
    }
    try {
      const date_ms = new Date(text).getTime();
      if (Nums.is_invalid(date_ms) || date_ms <= 0) {
        throw new Error(`invalid Date.getTime() : ${date_ms}`);
      }
      return Temporal.Instant.fromEpochMilliseconds(date_ms);
    } catch (err) {
      errors.push(err);
    }
    throw new Error(`Failed parse ${JSON.stringify(text)} to instant`, {
      cause: errors,
    });
  }

  export function instant_to_date<T extends Temporal.Instant | null>(
    time: T
  ): null extends T ? Date | null : Date {
    if (time === null) {
      return null as any;
    }
    return new Date(time.toString());
  }

  export function parse_instant<
    T extends number | string | Date | Temporal.Instant | null | undefined
  >(value: T): Temporal.Instant | null {
    if (value === null || typeof value === "undefined") {
      return null;
    }
    if (value instanceof Temporal.Instant) {
      return value;
    }
    if (typeof value === "string") {
      return parse_text_to_instant(value);
    }
    if (typeof value === "number") {
      return unix_to_time(value);
    }
    if (isDate(value)) {
      const date_ms = value.getTime();
      if (Nums.is_invalid(date_ms) || date_ms <= 0) {
        return null;
      }
      return Temporal.Instant.fromEpochMilliseconds(date_ms);
    }
    throw new Error(`Unknown type of value ${value}`);
  }

  // export function format_yyyymmddhhmmss(date: Date) {
  //   const d = new Date(date),
  //     year = d.getFullYear();
  //   let month = "" + (d.getMonth() + 1),
  //     day = "" + d.getDate(),
  //     hour = "" + d.getHours(),
  //     minute = "" + d.getMinutes(),
  //     second = "" + d.getSeconds();

  //   if (month.length < 2) month = "0" + month;
  //   if (day.length < 2) day = "0" + day;
  //   if (hour.length < 2) hour = "0" + hour;
  //   if (minute.length < 2) minute = "0" + minute;
  //   if (second.length < 2) second = "0" + second;

  //   return [year, month, day, hour, minute, second].join("");
  // }
}

// deno-lint-ignore no-namespace
export namespace Jsons {
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

  export function dump<O>(
    obj: O,
    option?: JsonDumpOption
  ): O extends null
    ? `null`
    : O extends undefined
    ? `null`
    : O extends string
    ? `"${string}"`
    : O extends boolean | bigint | number
    ? `${O}`
    : string {
    if (!option) {
      option = {};
    }
    const replacer = (_k: string, v: any) => {
      if (typeof v === "bigint") {
        if (
          v > BigInt(Number.MAX_SAFE_INTEGER) ||
          v < BigInt(Number.MIN_SAFE_INTEGER)
        ) {
          throw new Error(`BigInt out of safe number range : ${v}`);
        }
        return Number(v);
      }
      return v;
    };
    if (option.mode === undefined || option.mode === "JSON") {
      return JSON.stringify(obj, replacer, option.indent) as any;
    }
    // else if (option.mode === "JSON5") {
    //   return JSON5.stringify(obj, replacer, option.indent);
    // }
    else {
      throw new Error(`Invalid option.mode ${option.mode}`);
    }
  }

  export function copy<T extends JSONValue>(obj: T) {
    return JSON.parse(Jsons.dump(obj)) as T;
  }

  export async function dump_to(param: {
    obj: unknown;
    output: {
      writer: Awaited<ReturnType<typeof Deno.open>>["writable"];
    };
    spaces?: number | string;
    buf_size?: number;
  }) {
    const { obj, output, buf_size, spaces } = param;
    const jsonStream = new JsonStreamStringify(
      obj,
      undefined,
      spaces,
      false,
      buf_size
    );
    return await Promise.resolve(
      jsonStream.pipe(Writable.fromWeb(output.writer))
    );
    // const stream = nodeReader(jsonStream, "utf-8");
    // const writer_node = nodeWriter(Writable.fromWeb(output.writer));
    // await stream.pipe(writer_node);
  }

  export type ParseJsonValue<T extends string> = T extends `true`
    ? true
    : T extends `false`
    ? false
    : T extends `null`
    ? null
    : T extends `"${string}"`
    ? string
    : T extends `${number}`
    ? number
    : T extends `${bigint}`
    ? number
    : T extends `${boolean}`
    ? boolean
    : JSONValue;

  export function load<T extends string>(
    s: T,
    opt?: { parse_json5?: boolean }
  ): ParseJsonValue<T> {
    const start_jsons_load_at = new Date().getTime();
    let value: any;
    try {
      value = (() => {
        if (opt?.parse_json5) {
          return JSON5.parse(s);
        }
        // It is very fast and save memory ! Cooooooooooooooooool !
        return safeDestr<any>(s);
      })();
    } finally {
      const end_jsons_load_at = new Date().getTime();
      if (end_jsons_load_at - start_jsons_load_at > 1000) {
        setTimeout(async () => {
          console.warn("WARN: jsons load too slow", {
            cast_time: `${(end_jsons_load_at - start_jsons_load_at) / 1000} s`,
            // cache_file_name: cache_file.cache_file_name,
            str_size: `${(
              (await Promise.resolve(SizeOf.sizeof(s))) /
              1024 /
              1024
            ).toFixed(2)} MB`,
            object_size: `${(
              (await Promise.resolve(SizeOf.sizeof(value))) /
              1024 /
              1024
            ).toFixed(2)} MB`,
          });
        }, 10);
      }
    }
    return value;
  }

  class JSONParserTransformer extends JSONParser {
    private controller: any;

    constructor(opts: any) {
      super(opts);
      this.onValue = (value) => this.controller.enqueue(value); //  Don't copy
      this.onError = (err) => this.controller.error(err);
      this.onEnd = () => this.controller.terminate();
    }
    start(controller: any) {
      this.controller = controller;
    }
    transform(chunk: any) {
      this.write(chunk);
    }
    flush() {
      this.end();
    }
  }

  class MyJsonStreamParser extends TransformStream {
    constructor() {
      const transformer = new JSONParserTransformer(undefined);
      super(transformer);
    }
  }

  export async function load_stream(param: {
    input_stream: ReadableStream<Uint8Array<ArrayBuffer>>;
    // input_stream: Awaited<ReturnType<typeof Deno.open>>["readable"];
  }) {
    const { input_stream } = param;
    const parser = new MyJsonStreamParser();
    const reader = input_stream.pipeThrough(parser).getReader();
    let root_value: unknown = undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      else root_value = value.value;
    }
    if (typeof root_value === "undefined") {
      throw new Error("Why undefined ?");
    }
    return root_value;
  }

  /**
   * https://stackoverflow.com/questions/2965293/javascript-parse-error-on-u2028-unicode-character
   */
  export function is_have_u2028_or_u2029(s: string) {
    return s.indexOf("\u2028") >= 0 || s.indexOf("\u2029") >= 0;
  }

  export function replace_u2028_or_u2029_to_empty(text: string) {
    let text2 = text;
    while (true) {
      text2 = text2.replaceAll("\u2028", "");
      text2 = text2.replaceAll("\u2029", "");
      if (text === text2) {
        break;
      }
      text = text2;
    }
    return text;
  }
}

// deno-lint-ignore no-namespace
export namespace Nums {
  export function is_invalid(s: number): s is never {
    return isNaN(s) || !isFinite(s);
  }

  export function take_extreme_value<
    A extends readonly [T, ...T[]],
    T extends Typings.Comparable | null = A[number]
  >(
    mode: "max" | "min",
    nums: A
  ): Arrays.AllNullable<A> extends false ? NonNullable<T> : T | null {
    let res: T = nums[0];
    for (let i = 0; i < nums.length; i++) {
      const item = nums[i];
      if (res === null) {
        res = item;
      } else if (item === null) {
        continue;
      } else if (mode === "max") {
        if (
          res instanceof Temporal.Instant &&
          item instanceof Temporal.Instant
        ) {
          res = Temporal.Instant.compare(res, item) < 0 ? item : res;
        } else {
          res = item > res ? item : res;
        }
      } else if (mode === "min") {
        if (
          res instanceof Temporal.Instant &&
          item instanceof Temporal.Instant
        ) {
          res = Temporal.Instant.compare(item, res) < 0 ? item : res;
        } else {
          res = item < res ? item : res;
        }
      }
    }
    return res as any;
  }

  export type NumberLike = number | `${number}`;

  export function is_int(s: string | number): s is NumberLike {
    if (typeof s === "number") {
      return !is_invalid(s) && s.toFixed(0) === s.toString();
    }
    return is_int(parseInt(s));
  }

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

  export type ExistStrInUnionArraySecondArg<A extends string[]> =
    A extends (infer T)[] ? (string extends T ? never : T) : string;

  export type ExistStrInUnionArray<
    A extends string[],
    S extends ExistStrInUnionArraySecondArg<A>
  > = A extends (infer T)[]
    ? Array<S> extends Array<T>
      ? string extends T
        ? never
        : A
      : never
    : never;

  export function exist_str_in_union_array<
    A extends string[],
    S extends A extends (infer T)[] ? (string extends T ? never : T) : string
  >(arr: A, str: S): arr is ExistStrInUnionArray<A, S> {
    return arr.indexOf(str) >= 0;
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
  export const object_entries = <T extends Record<PropertyKey, any>>(
    obj: T
  ): NonNullable<{ [K in keyof T]: [K, T[K]] }[keyof T]>[] => {
    return Object.entries(obj);
  };

  export const object_keys = <T extends Record<string, any>>(
    obj: T
  ): (string & Typings.AvailableKeys<T>)[] => {
    return Object.keys(obj) as any;
  };

  export const find_entry_which_defined_value_and_key_startswith = <
    P extends string,
    T extends Record<string, any>
  >(
    prefix: P,
    obj: T
  ) => {
    return (
      object_keys(obj)
        .map((key) => {
          if (Strs.startswith(key, prefix)) {
            const k: keyof Typings.ReduceUnionMapping<T> = key as any;
            if (k === undefined) {
              return null;
            }
            const o: Typings.ReduceUnionMapping<T> = obj as any;
            const v = o[k];
            if (v === undefined) {
              return null;
            }
            return [k, v] as const;
          } else {
            return null;
          }
        })
        .find((it) => it) ?? null
    );
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

  // deno-lint-ignore no-empty-interface
  interface _EmptyInterface {}
  type _EmptyRecord = Record<string | number | symbol, never>;
  // deno-lint-ignore ban-types
  type _EmptyObj = {};
  export type Empty = _EmptyObj | _EmptyInterface | _EmptyRecord;

  type _Test_Empty = [
    _EmptyInterface extends _EmptyInterface ? 1 : 0,
    _EmptyInterface extends _EmptyRecord ? 1 : 0,
    _EmptyInterface extends _EmptyObj ? 1 : 0,
    _EmptyInterface extends Empty ? "success" : "failed",
    _EmptyRecord extends _EmptyRecord ? 1 : 0,
    _EmptyRecord extends _EmptyInterface ? 1 : 0,
    _EmptyRecord extends _EmptyObj ? 1 : 0,
    _EmptyRecord extends Empty ? "success" : "failed",
    _EmptyObj extends _EmptyObj ? 1 : 0,
    _EmptyObj extends _EmptyInterface ? 1 : 0,
    _EmptyObj extends _EmptyRecord ? 1 : 0,
    _EmptyObj extends Empty ? "success" : "failed",
    Empty extends Empty ? "success" : "failed",
    Empty extends _EmptyInterface ? 1 : 0,
    Empty extends _EmptyRecord ? 1 : 0,
    Empty extends _EmptyObj ? 1 : 0
  ];

  export type IsNotConcreteEmpty<T> = T extends Empty
    ? Empty extends Typings.Concrete<T>
      ? never
      : T
    : T;

  // should be never
  type _Test_Empty_1 = IsNotConcreteEmpty<_EmptyInterface>;
  // should be never
  // deno-lint-ignore ban-types
  type _Test_Empty_2 = IsNotConcreteEmpty<{}>;
  // should not be never
  type _Test_Empty_3 = IsNotConcreteEmpty<{ id: number }>;
  // should not be never
  type _Test_Empty_4 = IsNotConcreteEmpty<{ id?: number }>;
  // should be { id?: number }
  // deno-lint-ignore ban-types
  type _Test_Empty_5 = IsNotConcreteEmpty<{} | { id?: number }>;

  export function is_not_concrete_empty<T>(t: T): t is IsNotConcreteEmpty<T> {
    return typeof t === "object" && t !== null && object_keys(t).length > 0;
  }

  export type HasKeys<
    T,
    KS extends Array<Typings.AvailableKeys<T>> = Array<Typings.AvailableKeys<T>>
  > = {
    [P in KS[number]]: Extract<
      T,
      | {
          [P2 in P]?: any;
        }
      | {
          [P2 in P]: any;
        }
    >[P];
  } & T;

  export function has_keys<
    T extends object,
    KS extends Array<Typings.AvailableKeys<T>>
  >(t: T, keys: KS): t is HasKeys<T, KS> {
    if (!is_not_concrete_empty(t)) {
      return false;
    }
    for (const k of keys) {
      if (!(k in t)) {
        return false;
      }
    }
    return true;
  }
}

// deno-lint-ignore no-namespace
export namespace Trees {
  export type ChildrenType<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? N | _TreesChildrenType._ChildrenType_1<N, K>
          : N
        : R);

  export function* travel_node_dfs<R, K extends string & keyof R>(param: {
    root: R;
    children_key: K;
  }): Generator<ChildrenType<R, K>> {
    const { children_key, root } = param;
    yield root;
    const children = root[children_key];
    if (Array.isArray(children)) {
      for (const c of children) {
        yield* travel_node_dfs({ children_key, root: c });
      }
    }
  }
}

// deno-lint-ignore no-namespace
export namespace DataClean {
  export type HttpUrl = `https://${string}` | `http://${string}`;

  export function url_use_https_noempty<S extends string>(url: S) {
    if (!Strs.is_not_blank(url)) {
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

  export function url_use_https_emptyable<S extends string>(
    url: S | null | undefined
  ) {
    if (Strs.is_not_blank(url)) {
      return url_use_https_noempty(url);
    } else {
      return null;
    }
  }

  export type NaturalNumber = bigint;

  export function cast_and_must_be_natural_number(n: number): NaturalNumber {
    if (Nums.is_invalid(n)) {
      throw new Error("NaN or Infinity");
    }
    if (!Nums.is_int(n)) {
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

  export function nan_infinity_to_null(n: number | string | null | undefined) {
    if (n === null || n === undefined) {
      return null;
    }
    if (typeof n === "string") {
      return nan_infinity_to_null(parseFloat(n));
    } else {
      return Nums.is_invalid(n) ? null : n;
    }
  }

  /**
   * npm package english2number
   */
  const english2number = (function () {
    // deno-lint-ignore prefer-const
    let large: any, small: any;

    small = {
      zero: 0,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      sixteen: 16,
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
      twenty: 20,
      thirty: 30,
      forty: 40,
      fifty: 50,
      sixty: 60,
      seventy: 70,
      eighty: 80,
      ninety: 90,
    };

    large = {
      thousand: 1000,
      million: 1000000,
      billion: 1000000000,
      trillion: 1000000000000,
      // quadrillion: 1000000000000000,
      // quintillion: 1000000000000000000,
      // sextillion: 1000000000000000000000,
      // septillion: 1000000000000000000000000,
      // octillion: 1000000000000000000000000000,
      // nonillion: 1000000000000000000000000000000,
      // decillion: 1000000000000000000000000000000000,
    };

    const english2Number = function (english: string) {
      let current, exponent, i, int, len, product, total, word, words, negative;
      if (!isNaN((int = parseInt(english, 10)))) {
        return int;
      }
      negative =
        english.indexOf("negative") === 0 || english.indexOf("-") === 0;
      words = english
        .replace(/\sand\s/g, " ")
        .replace(/^negative\s/, "")
        .replace(/^-\s/, "")
        .replace(/^a\s/, "one ")
        .replace(/,\s/g, " ")
        .replace(/first/g, "one")
        .replace(/second/g, "two")
        .replace(/third/g, "three")
        .replace(/fourth/g, "four")
        .replace(/fifth/g, "five")
        .replace(/eighth/g, "eight")
        .replace(/ninth/g, "nine")
        .replace(/twelfth/g, "twelve")
        .replace(/twentieth/g, "twenty")
        .replace(/fiftieth/g, "fifty")
        .replace(/seventieth/g, "seventy")
        .replace(/ninetieth/g, "ninety")
        .replace(/(i|ie)?th(\b|-|$)/g, "")
        .split(/[\s-]+/);
      total = 0;
      current = 0;
      for (i = 0, len = words.length; i < len; i++) {
        word = words[i];
        product = small[word];
        if (product !== undefined) {
          current += product;
        } else if (word === "hundred" && current !== 0) {
          current *= 100;
        } else {
          exponent = large[word];
          if (exponent) {
            total += current * exponent;
            current = 0;
          } else {
            throw new Error("Unknown number: " + word);
          }
        }
      }
      const output = total + current;
      if (negative) {
        return output * -1;
      }
      return output;
    };
    return english2Number;
  })();

  export function parse_number<R extends number>(
    value: string | number,
    on_nan:
      | "raise"
      | "allow_nan"
      | ((
          source_value: string | number | null,
          cause_value: string | number
        ) => R) = "raise",
    source_value: string | number | null = null,
    debug: null | ((text: string) => void) = null
  ): R | number {
    if (on_nan === "raise") {
      on_nan = (__source_value, cause_value) => {
        if (debug) {
          debug(
            `not a number sourced ${__source_value} cause by ${cause_value}`
          );
        }
        throw new Error(
          `Disallow NaN on parse_number : sourced ${__source_value} cause by ${cause_value}`
        );
      };
    } else if (on_nan === "allow_nan") {
      on_nan = (__source_value, cause_value) => {
        if (debug) {
          debug(
            `not a number sourced ${__source_value} cause by ${cause_value}`
          );
        }
        return NaN as R;
      };
    }
    if (typeof value === "number") {
      return value;
    }
    const source_value_v2 =
      source_value === null || source_value === undefined
        ? value
        : source_value;
    if (source_value_v2 === null || source_value_v2 === undefined) {
      throw new Error("BUG");
    }
    value = value.trim();
    _out_ignore_end_loop: while (true) {
      for (const ignore_end of ["+", "以上"] as const) {
        if (Strs.endswith(value, ignore_end)) {
          value = Strs.remove_suffix(value, ignore_end);
          continue _out_ignore_end_loop;
        }
      }
      break;
    }
    if (Strs.startswith(value, ".")) {
      value = "0" + value;
    }
    if (/^-?[0-9_\.]+$/g.test(value)) {
      if (value.split(".").length > 2 || value.split("-").length > 2) {
        return on_nan(source_value_v2, value);
      }
      const parse_float_res = parseFloat(value);
      if (!Nums.is_invalid(parse_float_res)) {
        if (debug) {
          debug(
            `parsed float number sourced ${source_value_v2} from ${value} to ${parse_float_res}`
          );
        }
        return parse_float_res;
      } else {
        throw new Error(
          `Parse should be success , why failed ? source_value_v2 is ${source_value_v2}`
        );
      }
    }
    const intl_number = NumberParser("en-US", {})(value);
    if (typeof intl_number === "number" && !Nums.is_invalid(intl_number)) {
      if (debug) {
        debug(
          `parsed intl number sourced ${source_value_v2} from ${value} to ${intl_number}`
        );
      }
      return intl_number;
    }
    const chinese_number = parseChineseNumber(value);
    if (
      typeof chinese_number === "number" &&
      !Nums.is_invalid(chinese_number)
    ) {
      if (debug) {
        debug(
          `parsed chinese number sourced ${source_value_v2} from ${value} to ${chinese_number}`
        );
      }
      return chinese_number;
    }
    if (/^[a-zA-Z\s]+$/g.test(value)) {
      const english_number = english2number(value);
      if (
        typeof english_number === "number" &&
        !Nums.is_invalid(english_number)
      ) {
        if (debug) {
          debug(
            `parsed english number sourced ${source_value_v2} from ${value} to ${english_number}`
          );
        }
        return english_number;
      }
    }
    const chinese_quantifier_endings = [
      ["个", 1],
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
      if (Strs.endswith(value, chinese_quantifier)) {
        const x = Strs.remove_suffix(value, chinese_quantifier);
        if (debug) {
          debug(
            `recursion call parsed number sourced ${source_value_v2} , x = ${x}`
          );
        }
        return (
          parse_number(x, on_nan, source_value_v2, debug) *
          chinese_quantifier_multi
        );
      }
    }
    if (debug) {
      debug(`no method to parse ${source_value_v2}`);
    }
    return on_nan(source_value_v2, value);
  }

  export function strip_html(html_text: string) {
    const doc = new DOMParser().parseFromString(
      `<p>${html_text}</p>`,
      "text/html"
    );
    return doc.textContent;
  }

  export function select_context_text(param: {
    content_text_summary_uncleaned_timeline: DataMerge.Timeline<string>;
    content_text_detail_uncleaned_timeline: DataMerge.Timeline<string>;
    platform: PlatformEnum | null;
  }) {
    //
    const {
      content_text_summary_uncleaned_timeline,
      content_text_detail_uncleaned_timeline,
    } = param;
    // const is_deleted = () => false;
    let content_text_timeline: DataMerge.Timeline<{
      text: string;
      is_summary: boolean;
    }> = [];
    const found_tags_in_context_text = new Set<string>();
    const clean_text = (value: string) => {
      const _clean = (v: string | null) => {
        if (v === null) {
          return null;
        }
        v = v.trim();
        v = DataClean.strip_html(v);
        const tag_res = Paragraphs.find_and_clean_tags_in_text(v);
        tag_res.tags.forEach((tag) => {
          found_tags_in_context_text.add(tag);
        });
        v = tag_res.text_cleaned;
        if (["-", "/", "#"].indexOf(v) >= 0) {
          v = "";
        }
        if (v === "") {
          v = null;
        }
        return v;
      };

      let v1: string | null = value;
      let v2: string | null = v1;
      do {
        v1 = v2;
        v2 = _clean(v1);
      } while (v2 !== v1);

      return v2;
    };
    for (const content_text of [
      ...(content_text_detail_uncleaned_timeline.length > 0
        ? content_text_detail_uncleaned_timeline
        : content_text_summary_uncleaned_timeline),
    ]) {
      const _value_cleand = clean_text(content_text.value);
      if (_value_cleand === null) {
        continue;
      }
      content_text_timeline = DataMerge.merge_and_sort_timeline({
        old: content_text_timeline,
        timeline: [
          {
            value: {
              text: _value_cleand,
              is_summary: false,
            },
            time: content_text.time,
          },
        ],
      });
    }
    for (const summary of content_text_summary_uncleaned_timeline) {
      let { value, time } = summary;
      while (true) {
        const _value_cleand = clean_text(value);
        if (_value_cleand === null) {
          break;
        }
        value = _value_cleand;
        let is_break = true;
        for (const suffix of [".", "…", " ", "更多", "展开"] as const) {
          while (Strs.endswith(value, suffix)) {
            is_break = false;
            value = Strs.remove_suffix(value, suffix);
          }
        }
        if (is_break) {
          break;
        }
      }
      if (
        content_text_timeline.filter((text) =>
          text.value.text.startsWith(value)
        ) !== undefined
      ) {
        // 已经爬到了展开后的内容
        continue;
      } else {
        const _value_cleand = clean_text(value);
        if (_value_cleand === null) {
          continue;
        }
        content_text_timeline = DataMerge.merge_and_sort_timeline({
          old: content_text_timeline,
          timeline: [
            {
              value: {
                text: _value_cleand,
                is_summary: true,
              },
              time: time,
            },
          ],
        });
      }
    }

    const is_deleted = (it: (typeof content_text_timeline)[number]) => false;
    const obj_deleted_first = content_text_timeline.find(is_deleted) ?? null;
    const context_text_latest =
      content_text_timeline.findLast((it) => !is_deleted(it))?.value.text ??
      null;
    let content_text_resume_after_deleted: boolean;

    if (Arrays.length_greater_then_0(content_text_timeline)) {
      // 如果有被删除的元素，但最后一个元素没有被删除，说明被恢复了。
      content_text_resume_after_deleted =
        obj_deleted_first != null && !is_deleted(content_text_timeline[0]);
    } else {
      content_text_resume_after_deleted = false;
    }

    return {
      content_text_timeline_count: content_text_timeline.length,
      context_text_latest_str_length: context_text_latest?.length ?? 0,
      context_text_latest,
      content_text_deleted_at_least_once:
        content_text_timeline.length > 0 && obj_deleted_first !== null,
      content_text_deleted_first_time: obj_deleted_first?.time ?? null,
      content_text_resume_after_deleted,
      content_text_timeline,
      found_tags_in_context_text,
    };
  }

  export function parse_gray_font_at_note_end(param: {
    crawl_time: Temporal.Instant;
    text: string;
    locale: string;
  }) {
    const { crawl_time, text, locale } = param;
    let edited = false;
    let datetime: {
      before_time_text: string;
      value: Temporal.Instant;
      after_time_text: string;
    } | null = null;

    for (const ch of ["编辑于", "修改于", "edited"]) {
      if (text.indexOf(ch) >= 0) {
        edited = true;
        break;
      }
    }

    if (datetime === null) {
      const t = text.replaceAll(",", " ").split(" ");
      const len = t.length;
      _loop_parse_time: for (let l = len; l > 0; l--) {
        for (let i = 0; len - i - l >= 0; i++) {}
      }
    }

    const match_before_days =
      /\s(.+?)天前/.exec(" " + text) ??
      /\s([0-9a-zA-Z\s]+?)+day[s]?[\s]+ago/.exec(" " + text);

    if (datetime === null && match_before_days) {
      const before_days = parse_number(match_before_days[1], "allow_nan");
      if (!Nums.is_invalid(before_days)) {
        // datetime = new Date(crawl_time);
        // datetime.setDate(crawl_time.getDate() - before_days);
      }
    }

    return {
      edited,
      datetime,
    };
  }
}

// deno-lint-ignore no-namespace
export namespace DataMerge {
  export type Timeline<V> = {
    time: Temporal.Instant | "unknown";
    value: V;
  }[];

  /**
   * 根据时间排序。
   *
   * 在排序后，如果前后两个元素的值一样（时间可以不同），则移除后面的元素。
   */
  export function merge_and_sort_timeline<
    V,
    T extends Timeline<V> = Timeline<V>
  >(param: { old: T; timeline: T }) {
    const { old, timeline } = param;
    const arr = [...old, ...timeline];
    arr.sort((a, b) => {
      const at = a.time === "unknown" ? 0 : a.time.epochMilliseconds;
      const bt = b.time === "unknown" ? 0 : b.time.epochMilliseconds;
      return at - bt;
    });
    for (let i = 0; i < arr.length; ) {
      const a = arr[i];
      if (i >= arr.length - 1) {
        break;
      }
      const b = arr[i + 1];
      if (is_deep_equal(a.value, b.value)) {
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
        time:
          it.time === "unknown"
            ? "unknown"
            : it.time.toZonedDateTimeISO("UTC").toString(),
        value: it.value,
      };
    });
  }
}

// deno-lint-ignore no-namespace
export namespace DataCleanJsHtmlTree {
  type _HasClassVarTypes<
    T,
    _VAR1_NODE = Typings.HasNonnullProperty<T, "attrs">,
    _VAR2_NODE_ATTR = _VAR1_NODE extends { attrs?: any }
      ? _VAR1_NODE["attrs"]
      : unknown,
    _VAR3_NODE_ATTR = Typings.HasNonnullProperty<_VAR2_NODE_ATTR, "class">,
    _VAR4_NODE_ATTR = Mappings.IsNotConcreteEmpty<_VAR3_NODE_ATTR>,
    _VAR5_NODE_ATTR_CLASS = _VAR4_NODE_ATTR extends { class?: any }
      ? Mappings.IsNotConcreteEmpty<_VAR4_NODE_ATTR["class"]>
      : unknown,
    _VAR6_NODE_ATTR_CLASS extends string[] = _VAR5_NODE_ATTR_CLASS extends string[]
      ? _VAR5_NODE_ATTR_CLASS
      : never
  > = {
    t: T;
    var1: _VAR1_NODE;
    var4: _VAR4_NODE_ATTR;
    var6: _VAR6_NODE_ATTR_CLASS;
  };

  type _HasClassFilterAttrsClass<
    T,
    C,
    _Var1 = Exclude<
      Extract<
        T,
        {
          attrs?: {
            class?: any;
          };
        }
      >,
      {
        attrs?: {
          class?: undefined;
        };
      }
    >
  > = _Var1 extends { attrs?: { class?: (infer T)[] } }
    ? string extends C
      ? _Var1
      : string extends T
      ? never
      : C extends T
      ? _Var1
      : never
    : never;

  type _Test_HasClassFilterAttrsClass = _HasClassFilterAttrsClass<
    // deno-lint-ignore ban-types
    | {}
    // deno-lint-ignore ban-types
    | { attrs?: {} }
    | { attrs?: { class: "a"[] } }
    | { attrs?: { class?: "a"[] } }
    | { attrs?: { class?: "x"[] } }
    | { attrs?: { class?: ("a" | "b" | "c")[] } }
    | { attrs?: { class?: string[] } },
    "a"
  >;

  export type HasClass<
    T,
    C extends Arrays.ExistStrInUnionArraySecondArg<_VARS["var6"]>,
    _VARS extends _HasClassVarTypes<T> = _HasClassVarTypes<T>,
    Attrs = _VARS["var4"] & {
      class: never extends C
        ? string[]
        : Arrays.ExistStrInUnionArray<_VARS["var6"], C>;
    }
  > = _HasClassFilterAttrsClass<_VARS["var1"], C> & {
    attrs: Attrs; // & Mappings.HasKeys<Attrs>;
  };

  export function has_class<
    T,
    C extends Arrays.ExistStrInUnionArraySecondArg<_VARS["var6"]>,
    _VARS extends _HasClassVarTypes<T> = _HasClassVarTypes<T>
  >(node: T, classname: C): node is HasClass<T, C> {
    if (
      Typings.has_nonnull_property(node, "attrs") &&
      Mappings.is_not_concrete_empty(node.attrs) &&
      Typings.has_nonnull_property(node.attrs, "class") &&
      Mappings.is_not_concrete_empty(node.attrs.class) &&
      Arrays.exist_str_in_union_array<any, string>(node.attrs.class, classname)
    ) {
      return true;
    } else {
      return false;
    }
  }

  export function has_class_no_typeguard<
    T,
    C extends Arrays.ExistStrInUnionArraySecondArg<_VARS["var6"]>,
    _VARS extends _HasClassVarTypes<T> = _HasClassVarTypes<T>
  >(node: T, classname: C | string): node is HasClass<T, C> {
    return has_class(node, classname as any);
  }
}

// deno-lint-ignore no-namespace
export namespace ProcessBar {
  export function create_scope<R>(
    setting: {
      title?: string;
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
      console.debug("--- Process bar scope enter ---");
      const res = await scope({
        render: async (render_param) => {
          const arr = Jsons.copy(render_param);
          for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (item.completed < 0) {
              item.completed = 0;
            }
            if (item.total < 0) {
              item.total = 0;
            }
            if (item.completed > item.total) {
              item.total = item.completed;
            }
          }
          await bars.render(arr);
        },
      });
      // await delay(1000);
      console.debug("--- Process bar scope exit ---");
      await bars.end();
      return res;
    })();
  }

  export type SingleBarSetter = {
    set_completed: (value: number) => Promise<void>;
    set_total: (value: number) => Promise<void>;
    set_text: (value: string) => Promise<void>;
    get_completed: () => number;
    get_total: () => number;
    get_text: () => string;
  };

  /**
   * 每个任务一个进度条
   */
  export function bind_each<
    R = unknown,
    P = unknown,
    Tasks extends ((param: P, bar: SingleBarSetter) => Promise<R>)[] = ((
      param: P,
      bar: SingleBarSetter
    ) => Promise<R>)[]
  >(
    tasks: Tasks,
    bars_render: Parameters<Parameters<typeof create_scope>[1]>[0]["render"]
  ) {
    const render_params_handler: {
      value: null | Parameters<typeof bars_render>[0];
    } = {
      value: null,
    };
    const queue: Array<(typeof render_params_handler)["value"]> = [];

    const get_now = () => new Date().getTime();

    const last_update_time = {
      value: get_now(),
    };

    const update = async () => {
      if (render_params_handler.value) {
        queue.push(Jsons.copy(render_params_handler.value));
      } else {
        console.warn("BUG , render_params_handler not init");
      }
      if (get_now() - last_update_time.value > 20) {
        while (true) {
          last_update_time.value = get_now();
          const removed = Arrays.last_or_null(queue.splice(0, queue.length));
          if (removed) {
            await bars_render(removed);
            continue;
          } else {
            break;
          }
        }
        return "updated";
      } else {
        return "debounced";
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
            if (value >= render_param.total) {
              while ((await update()) === "debounced") {
                continue;
              }
            } else {
              await update();
            }
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
        get_completed: () => render_param.completed,
        get_total: () => render_param.total,
        get_text: () => render_param.text,
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
  export type MapItemsType<A extends Iterable<unknown>, R> = A extends Iterable<
    infer T
  >
    ? A extends []
      ? never[]
      : A extends Array<T>
      ? Array<R>
      : Iterable<R>
    : never;

  // type _MapItemsType_Test_1 = MapItemsType<number[], string>;
  // type _MapItemsType_Test_2 = MapItemsType<[1, 2, 4], string>;
  // type _MapItemsType_Test_3 = MapItemsType<[], string>;
  // type _MapItemsType_Test_4 = MapItemsType<Map<string, number>, string>;
  // type _MapItemsType_Test_5 = MapItemsType<Set<number>, string>;

  export type SubArray<A extends Iterable<unknown>> = A extends Iterable<
    infer T
  >
    ? A extends []
      ? never[]
      : T[]
    : never;

  export function* split_array_use_batch_size<T>(
    batch_size: number,
    arr: readonly T[]
  ) {
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

  export function find_first<T>(
    condition: (it: T) => boolean,
    items: Iterable<T>
  ) {
    let idx = 0;
    for (const item of items) {
      if (condition(item)) {
        return {
          idx,
          item,
        };
      }
      idx++;
    }
    return null;
  }

  export function filter<T, R extends T>(
    items: Iterable<T>,
    filter: (it: T) => it is R
  ): {
    matched: SubArray<MapItemsType<typeof items, R>>;
    not_matched: SubArray<MapItemsType<typeof items, Exclude<T, R>>>;
  } {
    const matched: R[] = [];
    const not_matched: Exclude<T, R>[] = [];
    for (const item of items) {
      if (filter(item)) {
        matched.push(item);
      } else {
        not_matched.push(item as any);
      }
    }
    return {
      matched,
      not_matched,
    };
  }

  export function filter2<T>(
    items: Iterable<T>,
    filter: (it: T) => boolean
  ): {
    matched: SubArray<typeof items>;
    not_matched: SubArray<typeof items>;
  } {
    const matched: T[] = [];
    const not_matched: T[] = [];
    for (const item of items) {
      if (filter(item)) {
        matched.push(item);
      } else {
        not_matched.push(item as any);
      }
    }
    return {
      matched,
      not_matched,
    };
  }

  export function deduplicate<T>(
    items: Iterable<T>,
    is_deep_equal_func: (a: T, b: T) => boolean = is_deep_equal
  ): SubArray<typeof items> {
    const res: T[] = [];
    items_loop: for (const item of items) {
      for (const existed of res) {
        if (is_deep_equal_func(item, existed)) {
          continue items_loop;
        }
      }
      res.push(item);
    }
    return res;
  }

  export function queue_cached<T>(_param: {
    gen: AsyncGenerator<T, void, undefined>;
    queue_size: number;
    reader_delay_ms?: () => number;
    writer_delay_ms?: () => number;
    before_event?: (
      ev:
        | "reader_delay_queue_full"
        | "reader_inqueue"
        | "reader_end"
        | "write_pop"
        | "writer_end"
        | "writer_delay_queue_empty"
    ) => void;
  }): () => AsyncGenerator<T, void, undefined> {
    const { gen, queue_size, reader_delay_ms, writer_delay_ms, before_event } =
      _param;

    const before = before_event ? before_event : () => {};

    const get_delay = (deft: number, func: undefined | (() => number)) => {
      const d = func ? func() : deft;
      return d > 0 ? d : deft;
    };
    return async function* () {
      const queue: T[] = [];
      const is_end = {
        value: false,
      };
      setTimeout(async () => {
        try {
          let last_queue_full = false;
          for await (const item of gen) {
            while (queue.length >= queue_size) {
              if (!last_queue_full) {
                before("reader_delay_queue_full");
              }
              await delay(get_delay(66, reader_delay_ms));
              last_queue_full = true;
            }
            before("reader_inqueue");
            queue.push(item);
            last_queue_full = false;
          }
        } catch (err) {
          console.error("Error on backpressure stream :", err);
          throw err;
        } finally {
          before("reader_end");
          is_end.value = true;
        }
      }, 10);
      while (true) {
        const popped = queue.splice(0, 1)[0];
        if (popped) {
          before("write_pop");
          yield popped;
          continue;
        } else if (is_end.value) {
          before("writer_end");
          break;
        } else {
          before("writer_delay_queue_empty");
          const ms = get_delay(66, writer_delay_ms);
          await delay(ms);
        }
      }
    };
  }
}

// deno-lint-ignore no-namespace
export namespace Errors {
  export function logerror_and_throw(msg: string, obj: object): never {
    console.error(msg, obj);
    throw new Error(`${msg}`, { cause: obj });
  }
}

// deno-lint-ignore no-namespace
export namespace Jsonatas {
  export function register_common_function_on_exp(
    jsonata_exp?: null | ReturnType<typeof jsonata>
  ) {
    if (jsonata_exp) {
      jsonata_exp.registerFunction(
        "deno_eval",
        async (str: string) => {
          let script_filepath: string;
          while (true) {
            script_filepath = path.join(
              "user_code",
              ".tmp",
              "jsonata_deno_eval_scripts",
              `${new Date()
                .toISOString()
                .slice(0, 19)
                .replaceAll("-", "")
                .replaceAll(":", "")
                .replaceAll("T", "")}-${encodeHex(
                await crypto.subtle.digest(
                  "SHA-1",
                  new TextEncoder().encode(str)
                )
              )}.js`
            );
            try {
              await Deno.stat(script_filepath);
              await delay(1000);
              // if found existed , wait it delete by other thread
            } catch (err) {
              if (err instanceof Deno.errors.NotFound) {
                // if not found , create and run script
                break;
              } else {
                throw err;
              }
            }
          }
          await write_file({
            file_path: script_filepath,
            creator: {
              mode: "text",
              // deno-lint-ignore require-await
              content: async () => str,
            },
            log_tag: "no",
          });
          const command = new Deno.Command("deno", {
            args: [
              "run",
              script_filepath,
              "--check",
              "--no-config",
              "--no-lock",
              "--no-npm",
              "--no-remote",
              "--",
              "--deny-all",
            ],
            stdin: "null",
            stdout: "piped",
            stderr: "piped",
            env: {},
          });
          const proc = command.spawn();
          const o = await proc.output();
          const stderr_str = new TextDecoder("utf-8").decode(o.stderr);
          const stdout_str = new TextDecoder("utf-8").decode(o.stdout);
          let stdout_json: Jsons.JSONValue;
          try {
            stdout_json = Jsons.load(stdout_str, {
              parse_json5: true,
            });
          } catch (err) {
            stdout_json = null;
          }
          return {
            success: o.success,
            code: o.code,
            stderr_str,
            stdout_str,
            stdout_json,
          };
        },
        "<s:o>"
      );
      jsonata_exp.registerFunction(
        "json_parse",
        (str: string) => {
          try {
            return {
              result: Jsons.load(str, { parse_json5: true }),
              success: true,
              error: null,
            };
          } catch (err) {
            return {
              result: null,
              success: false,
              error: `${err}`,
              source: str,
            };
          }
        },
        "<s:o>"
      );
    }
  }

  const _cache_jsonata_template_exp = new Map<string, jsonata.Expression>();

  export async function read_jsonata_template_exp(
    template_name: string,
    opt?: { no_cache?: boolean }
  ) {
    if (opt?.no_cache !== true) {
      const _cached = _cache_jsonata_template_exp.get(template_name);
      if (_cached) {
        return _cached;
      }
    }
    const jsonata_template_exp = jsonata(
      await Deno.readTextFile(
        path.join("jsonata_templates", `${template_name}.jsonata`)
      )
    );
    if (opt?.no_cache !== true) {
      Jsonatas.register_common_function_on_exp(jsonata_template_exp);
    }
    _cache_jsonata_template_exp.set(template_name, jsonata_template_exp);
    return jsonata_template_exp;
  }

  const _EvaluateJsonataExp_handler: {
    instances: null | EvaluateJsonataExp[];
  } = {
    instances: null,
  };
  const evaluate_workers: Worker[] = [];
  const evaluate_in_worker_init_lock = new AsyncLock();

  export async function evaluate_in_worker(param: {
    script: Parameters<EvaluateJsonataExp["evaluate"]>[0];
    data: Parameters<EvaluateJsonataExp["evaluate"]>[1];
    debugopt_logtime_for_jsonata_evalute_too_slow: number | null;
  }) {
    const { script, data, debugopt_logtime_for_jsonata_evalute_too_slow } =
      param;
    let instances: (typeof _EvaluateJsonataExp_handler)["instances"];
    while ((instances = _EvaluateJsonataExp_handler.instances) === null) {
      await new Promise((rs, rj) => {
        evaluate_in_worker_init_lock.acquire(
          "evaluate_in_worker_init",
          async (done: (err?: Error | null, ret?: any) => void) => {
            const done2: typeof done = (err, ret) => {
              if (err) {
                done(err);
                rj(err);
              } else {
                done(null, ret);
                rs(ret);
              }
            };
            try {
              if (
                (instances = _EvaluateJsonataExp_handler.instances) === null
              ) {
                console.debug("Creating instance of evaluate jsonata exp", {
                  hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
                });
                const arr: NonNullable<
                  (typeof _EvaluateJsonataExp_handler)["instances"]
                > = [];
                for (let i = 0; i < navigator.hardwareConcurrency * 4; i++) {
                  const worker = new Worker(
                    new URL(
                      "./workers/evaluate_jsonata_exp.ts",
                      import.meta.url
                    ).href,
                    {
                      type: "module",
                      name: "evaluate_jsonata_exp_worker",
                    }
                  );
                  evaluate_workers.push(worker);
                  const _EvaluateJsonataExp: any =
                    Comlink.wrap<EvaluateJsonataExp>(worker);
                  arr.push(await new _EvaluateJsonataExp());
                }
                _EvaluateJsonataExp_handler["instances"] = arr;
                console.debug(
                  "_EvaluateJsonataExp_handler['instance']?.length = ",
                  `${_EvaluateJsonataExp_handler["instances"]?.length}`
                );
              }
              done2(null);
            } catch (err) {
              done2(err as any);
            }
          }
        );
      });
    }
    const start_at = new Date().getTime();
    const random_idx = Math.floor(Math.random() * instances.length);
    if (random_idx < 0 || random_idx >= instances.length) {
      throw new Error(
        `random index out of range : ${random_idx} , instances is ${instances}`
      );
    }
    const instance = instances[random_idx];
    const res = await instance.evaluate(script, data);
    const end_at = new Date().getTime();
    if (
      debugopt_logtime_for_jsonata_evalute_too_slow &&
      debugopt_logtime_for_jsonata_evalute_too_slow > 0
    ) {
      if (end_at - start_at > debugopt_logtime_for_jsonata_evalute_too_slow) {
        const data_object_size = await Promise.resolve(SizeOf.sizeof(data));
        console.debug("WARN: script evalute too slow", {
          script,
          cast_time: `${(end_at - start_at) / 1000} s`,
          data_object_size: `${(data_object_size / 1024 / 1024).toFixed(2)} MB`,
          data,
        });
      }
    }
    return res;
  }

  export async function shutdown_all_workers() {
    await new Promise((rs, rj) => {
      evaluate_in_worker_init_lock.acquire(
        "evaluate_in_worker_init",
        // deno-lint-ignore require-await
        async (done: (err?: Error | null, ret?: any) => void) => {
          const done2: typeof done = (err, ret) => {
            if (err) {
              done(err);
              rj(err);
            } else {
              done(null, ret);
              rs(ret);
            }
          };
          try {
            console.info("shutdown all jsonatas worker");
            evaluate_workers
              .splice(0, evaluate_workers.length)
              .forEach((it) => it.terminate());
            _EvaluateJsonataExp_handler.instances = null;
            done2(null);
          } catch (err) {
            done2(err as any);
          }
        }
      );
    });
  }
}

// deno-lint-ignore no-namespace
export namespace SizeOf {
  const ECMA_SIZES = {
    STRING: 2,
    BOOLEAN: 4,
    BYTES: 4,
    NUMBER: 8,
    Int8Array: 1,
    Uint8Array: 1,
    Uint8ClampedArray: 1,
    Int16Array: 2,
    Uint16Array: 2,
    Int32Array: 4,
    Uint32Array: 4,
    Float32Array: 4,
    Float64Array: 8,
  } as const;

  /**
   * Precisely calculate size of string in node
   * Based on https://stackoverflow.com/questions/68789144/how-much-memory-do-v8-take-to-store-a-string/68791382#68791382
   * @param {} str
   */
  function preciseStringSizeNode(str: string) {
    return 12 + 4 * Math.ceil(str.length / 4);
  }

  /**
   * In the browser environment, window and document are defined as global objects
   * @returns true if its a Node.js env, false if it is a browser
   */
  function isNodeEnvironment() {
    return true as const;
  }

  function getSizeOfTypedArray(typedArray: any) {
    if (typedArray.BYTES_PER_ELEMENT) {
      return typedArray.length * typedArray.BYTES_PER_ELEMENT;
    }
    throw new Error("Unknown typed array size");
    // return -1; // error indication
  }

  /**
   * Size in bytes for complex objects
   * @param {*} obj
   * @returns size in bytes, or -1 if JSON.stringify threw an exception
   */
  function objectSizeComplex(obj: object) {
    // handle typed arrays
    if (ArrayBuffer.isView(obj)) {
      return getSizeOfTypedArray(obj);
    }

    // convert Map and Set to an object representation
    let convertedObj = obj;
    if (obj instanceof Map) {
      convertedObj = Object.fromEntries(obj);
    } else if (obj instanceof Set) {
      convertedObj = Array.from(obj);
    }
    const stringifyStream = createStringifyStream({
      body: convertedObj,
    });

    let totalSize = 0;

    return new Promise<number>((rs, rj) => {
      try {
        stringifyStream.on("data", function (strChunk: string) {
          // console.debug(strChunk);
          totalSize = totalSize + strChunk.length;
        });

        stringifyStream.on("end", function () {
          try {
            // console.debug("total size is :", totalSize);
            rs(totalSize);
          } catch (ex) {
            console.warn("Error on object size complex big-json inner:", ex);
            rj(ex);
          }
        });
      } catch (ex) {
        console.warn("Error on object size complex big-json outer:", ex);
        rj(ex);
      }
    });
  }

  /**
   * Size in bytes for primitive types
   * @param {*} obj
   * @returns size in bytes
   */
  function objectSizeSimple(obj: unknown) {
    if (typeof obj === "object") {
      throw new Error(`assert not object but : ${obj}`);
    }

    const objectList = [];
    const stack = [obj];
    let bytes = 0;
    if (typeof obj === "undefined" || obj === null) {
      return bytes;
    }

    while (stack.length) {
      const value = stack.pop();

      if (typeof value === "boolean") {
        bytes += ECMA_SIZES.BYTES;
      } else if (typeof value === "string") {
        if (isNodeEnvironment()) {
          bytes += preciseStringSizeNode(value);
        } else {
          bytes += value.length * ECMA_SIZES.STRING;
        }
      } else if (typeof value === "number") {
        bytes += ECMA_SIZES.NUMBER;
      } else if (typeof value === "symbol") {
        const isGlobalSymbol = Symbol.keyFor && Symbol.keyFor(obj as any);
        if (isGlobalSymbol) {
          bytes +=
            (Symbol.keyFor(obj as any) as any).length * ECMA_SIZES.STRING;
        } else {
          bytes += (obj.toString().length - 8) * ECMA_SIZES.STRING;
        }
      } else if (typeof value === "bigint") {
        bytes += Buffer.from(value.toString()).byteLength;
      } else if (typeof value === "function") {
        bytes += value.toString().length;
      } else if (
        typeof value === "object" &&
        objectList.indexOf(value) === -1
      ) {
        objectList.push(value);

        for (const i in value) {
          stack.push((value as any)[i]);
        }
      }
    }
    if (isNaN(bytes)) {
      throw new Error(`Why NAN ? obj is ${obj}`);
    }
    return bytes;
  }

  export function sizeof(obj: unknown) {
    return _size_of_in_main_thread(obj);
  }

  function _size_of_in_main_thread(obj: unknown) {
    if (obj !== null && typeof obj === "object") {
      return objectSizeComplex(obj);
    } else {
      return objectSizeSimple(obj);
    }
  }

  export const get_deno_mem_loginfo = () => {
    const to_human_read_mem_size = (x: number) =>
      `${(x / 1024 / 1024).toFixed(2)} MB` as const;
    const deno_mem = Deno.memoryUsage();
    return {
      external: to_human_read_mem_size(deno_mem.external),
      heapTotal: to_human_read_mem_size(deno_mem.heapTotal),
      heapUsed: to_human_read_mem_size(deno_mem.heapUsed),
      rss: to_human_read_mem_size(deno_mem.rss),
    };
  };
}

// deno-lint-ignore no-namespace
export namespace MonkeyPatch {
  // Copy from:
  // https://www.npmjs.com/package/monkeypatch
  export function monkey_patch(
    obj: any,
    method: string,
    handler: (original: any) => any,
    context?: any
  ) {
    let original = obj[method];

    // Unpatch first if already patched.
    if (original.unpatch) {
      original = original.unpatch();
    }

    // Patch the function.
    obj[method] = function () {
      const ctx = context || this;
      const args: any = [].slice.call(arguments);
      args.unshift(original.bind(ctx));
      return handler.apply(ctx, args);
    };

    // Provide "unpatch" function.
    obj[method].unpatch = function () {
      obj[method] = original;
      return original;
    };

    // Return the original.
    return original;
  }
}

// ---------------------- internal utils ----------------------

// deno-lint-ignore no-namespace
namespace _TreesChildrenType {
  export type _ChildrenType_1<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_2<N, K>
          : N
        : R);

  export type _ChildrenType_2<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_3<N, K>
          : N
        : R);

  export type _ChildrenType_3<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_4<N, K>
          : N
        : R);

  export type _ChildrenType_4<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_5<N, K>
          : N
        : R);

  export type _ChildrenType_5<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_6<N, K>
          : N
        : R);

  export type _ChildrenType_6<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_7<N, K>
          : N
        : R);

  export type _ChildrenType_7<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_8<N, K>
          : N
        : R);

  export type _ChildrenType_8<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_9<N, K>
          : N
        : R);

  export type _ChildrenType_9<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_10<N, K>
          : N
        : R);

  export type _ChildrenType_10<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_11<N, K>
          : N
        : R);

  export type _ChildrenType_11<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_12<N, K>
          : N
        : R);

  export type _ChildrenType_12<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_13<N, K>
          : N
        : R);

  export type _ChildrenType_13<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_14<N, K>
          : N
        : R);

  export type _ChildrenType_14<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_15<N, K>
          : N
        : R);

  export type _ChildrenType_15<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_16<N, K>
          : N
        : R);

  export type _ChildrenType_16<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_17<N, K>
          : N
        : R);

  export type _ChildrenType_17<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_18<N, K>
          : N
        : R);

  export type _ChildrenType_18<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_19<N, K>
          : N
        : R);

  export type _ChildrenType_19<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_20<N, K>
          : N
        : R);

  export type _ChildrenType_20<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_21<N, K>
          : N
        : R);

  export type _ChildrenType_21<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_22<N, K>
          : N
        : R);

  export type _ChildrenType_22<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_23<N, K>
          : N
        : R);

  export type _ChildrenType_23<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_24<N, K>
          : N
        : R);

  export type _ChildrenType_24<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_25<N, K>
          : N
        : R);

  export type _ChildrenType_25<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_26<N, K>
          : N
        : R);

  export type _ChildrenType_26<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_27<N, K>
          : N
        : R);

  export type _ChildrenType_27<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_28<N, K>
          : N
        : R);

  export type _ChildrenType_28<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_29<N, K>
          : N
        : R);

  export type _ChildrenType_29<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_30<N, K>
          : N
        : R);

  export type _ChildrenType_30<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? _ChildrenType_31<N, K>
          : N
        : R);

  export type _ChildrenType_31<R, K extends string & keyof R> =
    | R
    | (R[K] extends Array<infer N> | null | undefined
        ? K extends keyof N
          ? never
          : N
        : R);

  // raise error on deep 32 ...
}

if (import.meta.main) {
  const children_types_fmt = (i: number) => `
  export type _ChildrenType_${i}<R, K extends string & keyof R> =
      | R
      | (R[K] extends Array<infer N> | null | undefined
          ? K extends keyof N
            ? _ChildrenType_${i + 1}<N, K>
            : N
          : R);
`;

  let s = "";
  for (let i = 1; i <= 31; i++) {
    s += children_types_fmt(i);
  }
  console.debug(s);
}
