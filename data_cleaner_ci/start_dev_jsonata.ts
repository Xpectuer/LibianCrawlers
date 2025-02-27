import path from "node:path";
import child_process from "node:child_process";

async function start_dev_jsonata() {
  const watcher = Deno.watchFs([
    path.join("jsonata_templates"),
    path.join("util.ts"),
  ]);

  const need_run_test = {
    value: true,
  };

  const test_is_running = {
    value: false,
  };

  const run_test = async () => {
    // try {
    const child = child_process.spawn(
      "deno",
      [
        "test",
        "--allow-read=data_cleaner_ci_generated/.cache_by_id,jsonata_templates,user_code,util.ts",
        "--allow-write=user_code",
        "--allow-run=deno",
        "jsonata_templates/jsonata_test.ts",
      ],
      {
        stdio: ["inherit", "inherit", "inherit"],
      }
    );
    await new Promise<void>((rs) => {
      child.on("exit", (code) => {
        if (code === 0) {
          console.info("Return code zero");
        } else {
          console.error("Return code not zero but", code);
        }
        rs();
      });
    });
  };

  setInterval(async () => {
    if (need_run_test.value && !test_is_running.value) {
      try {
        test_is_running.value = true;
        await run_test();
      } finally {
        test_is_running.value = false;
        need_run_test.value = false;
      }
    }
  }, 100);

  console.log("Start watch jsonata templates change");
  for await (const event of watcher) {
    event.paths.forEach((it) => {
      console.log(`on ${event.kind} ${it}`);
    });
    need_run_test.value = true;
  }
}

// ```shell
// deno run start_watch_and_test_jsonata.ts
// ```
if (import.meta.main) {
  await start_dev_jsonata();
}
