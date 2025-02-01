import { Jsons } from "../util.ts";


// TODO: 正在开发，人力不足。

export function fastype(param: {
  // deno-lint-ignore no-explicit-any
  inputs: any[];
  typename: string;
}) {
  const { inputs } = param;

  const travel_obj = (
    // deno-lint-ignore no-explicit-any
    o: any,
    cb: {
      set_undefineable: () => void;
      set_nullable: () => void;
    }
  ) => {
    if (o === undefined || typeof o === "undefined") {
      cb.set_undefineable();
      return;
    }
    if (o === null) {
      cb.set_nullable();
    }
    if (Array.isArray(o)) {
      return;
    }
  };

  travel_obj(inputs, {
    set_undefineable() {},
    set_nullable() {},
  });

  const type_graph: { name: string }[] = [];
}
