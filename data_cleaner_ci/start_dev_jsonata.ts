import path from "node:path";
import util from "node:util";
import child_process from "node:child_process";

async function start_dev_jsonata() {
  const watcher = Deno.watchFs(path.join("jsonata_templates"));

  const need_run_test = {
    value: true,
  };

  const test_is_running = {
    value: false,
  };

  const run_test = async () => {
    const exec = util.promisify(child_process.exec);
    let stdout: string;
    let stderr: string;
    try {
      const res = await exec(
        "deno test --allow-read=data_cleaner_ci_generated/.cache_by_id,jsonata_templates,user_code --allow-write=user_code jsonata_templates/jsonata_test.ts"
      );
      stdout = res.stdout;
      stderr = res.stderr;
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "stdout" in err &&
        "stderr" in err &&
        typeof err.stdout === "string" &&
        typeof err.stderr === "string"
      ) {
        stdout = err.stdout;
        stderr = err.stderr;
      } else {
        throw err;
      }
    }
    console.log("============== stdout ==============\n", stdout);
    console.error("============== stderr ==============\n", stderr);
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
