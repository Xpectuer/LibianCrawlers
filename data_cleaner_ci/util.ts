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
    nan_if: () => R
  ): R | number {
    if (typeof value === "number") {
      return value;
    }
    value = value.trim();
    if (startswith(value, ".")) {
      return parse_number(concat_string("0", value), nan_if);
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
        return parse_number(x, nan_if) * chinese_quantifier_multi;
      }
    }
    const parse_float_res = parseFloat(value);
    if (!isNaN(parse_float_res)) {
      return parse_float_res;
    } else {
      return nan_if();
    }
  }

  export function strip_html(html_text: string) {
    const doc = new DOMParser().parseFromString(
      `<p>${html_text}</p>`,
      "text/html"
    );
    return doc.textContent;
  }
}

export type TableLike<K extends string = string> = Record<
  K,
  string | number | null
>[];
