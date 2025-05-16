import * as net from "node:net";
// import dnsSocket from "dns-socket";
import config from "./config.ts";

const test_socket_connect = async (options: net.SocketConnectOpts) => {
  console.debug("test_socket_connect :", options);
  let timer = -1;
  const s = new net.Socket();
  s.on("close", () => {
    console.debug("socket close:", options);
  });
  s.on("lookup", (...args: unknown[]) => {
    console.debug("socket lookup", args);
  });
  try {
    await new Promise<void>((rs, rj) => {
      try {
        s.connect(options, () => {
          rs();
        });
        timer = setTimeout(() => {
          rj(new Error(`timeout : ${options}`));
        }, 15 * 1000);
      } catch (err) {
        rj(err);
      }
    });
  } finally {
    if (!s.destroyed) {
      s.destroy();
    }
    if (timer !== -1) {
      clearTimeout(timer);
    }
  }
};

Deno.test("test socket connect", async () => {
  //
  //
  // https://github.com/nodejs/node/issues/14617
  // https://docs.libuv.org/en/v1.x/guide/networking.html#querying-dns
  //
  //
  // await test_socket_connect({ host: "www.baidu.com", port: 80 });
  // await test_socket_connect({ host: "bing.com", port: 80 });
  // const libian_crawler_db = {
  //   host: config.libian_crawler.data_storage.connect_param.host,
  //   port: config.libian_crawler.data_storage.connect_param.port,
  // } as const;
  // await test_socket_connect(libian_crawler_db);
  //   await test_socket_connect({
  //     ...libian_crawler_db,
  //     lookup(hostname, options, callback) {
  //         Deno.
  //     },
  //   });
});
