import path from "node:path";

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
