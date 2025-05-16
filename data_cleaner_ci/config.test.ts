import config from "./config.ts";

Deno.test(function readConfigTest() {
  console.log("config repositories", config.repositories);
});
