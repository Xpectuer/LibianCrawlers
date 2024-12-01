import os from "node:os";
import path from "node:path";
import { exists_else_create } from "./util.ts";

function template_config() {
  return {
    repositories: [
      {
        typ: "postgres",
        mode: "read",
      },
    ],
  };
}

export async function init_config() {
  const config_file_path = path.join(
    os.homedir(),
    ".libian",
    "crawler",
    "config",
    "dc_v1.json"
  );
  await exists_else_create({
    file_path: config_file_path,
    creator: {
      mode: "text",
      content: () =>
        new Promise<string>((rs, _) =>
          rs(JSON.stringify(template_config(), null, 2))
        ),
    },
    log_tag: {
      alia_name: "config file",
    },
  });
  await exists_else_create({
    file_path: path.join(Deno.cwd(), "data-cleaner-ci-generated", ".gitignore"),
    creator: {
      mode: "text",
      content: () => new Promise<string>((rs, _) => rs("*")),
    },
    log_tag: {
      alia_name: "gitignore file",
    },
  });
  await exists_else_create({
    file_path: path.join(
      Deno.cwd(),
      "data-cleaner-ci-generated",
      "config.json"
    ),
    creator: {
      mode: "symlink",
      old: config_file_path,
      allow_old_not_found: false,
    },
    log_tag: {
      alia_name: "config file symlink",
    },
  });
}

if (import.meta.main) {
  await init_config();
}
