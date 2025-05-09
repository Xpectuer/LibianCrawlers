// import { is_deep_equal, Jsons, Streams } from "../util.ts";
// import isDateObject from "is-date-object";
// import isArrayBuffer from "is-array-buffer";
// import whichCollection from "which-collection";
// import whichBoxedPrimitive from "which-boxed-primitive";
// import whichTypedArray from "which-typed-array";
// import isRegex from "is-regex";
// import isSharedArrayBuffer from "is-shared-array-buffer";
// import isArguments from "is-arguments";
// import ts from "typescript";

// type TypeNode =
//   | "unknown"
//   | "bigint"
//   | "string"
//   | "number"
//   | "typeof Infinity"
//   | "typeof NaN"
//   | "symbol"
//   | "function"
//   | "empty_object"
//   | {
//       literal: "undefined";
//     }
//   | {
//       literal: "null";
//     }
//   | {
//       literal: `${number}`;
//     }
//   | {
//       literal: `"${string}"`;
//     }
//   | {
//       literal: `${boolean}`;
//     }
//   | {
//       literal: `${bigint}`;
//       is_bigint: true;
//     }
//   | {
//       clzname: string;
//       generic_types?: Array<TypeNode>;
//     }
//   | {
//       unions: Array<TypeNode>;
//     }
//   | {
//       array_item_typ: TypeNode;
//     }
//   | {
//       tuples: Array<TypeNode>;
//     }
//   | {
//       fields: Map<
//         `"${string}"`,
//         {
//           typ: TypeNode;
//           optional: boolean;
//         }
//       >;
//     };

// type UnionTypeNode = Extract<TypeNode, { unions: Array<TypeNode> }>;

// // deno-lint-ignore no-explicit-any
// type TupleTypeNode = Extract<TypeNode, { tuples: any }>;
// // deno-lint-ignore no-explicit-any
// type ArrayTypeNode = Extract<TypeNode, { array_item_typ: any }>;

// type FastypeContext = {
//   root_inputs: TypeNode;
//   logd: boolean;
//   logi: boolean;
//   tuple_to_array: (node: TupleTypeNode) => "dont cast" | "cast to array";
// };

// function _ts_number_node(value: number) {
//   if (isNaN(value) || !isFinite(value)) {
//     throw new Error(
//       `Please check value before pass argument , value is ${value}`
//     );
//   }
//   if (value < 0) {
//     return ts.factory.createPrefixUnaryExpression(
//       ts.SyntaxKind.MinusToken,
//       ts.factory.createNumericLiteral(Math.abs(value))
//     );
//   } else {
//     return ts.factory.createNumericLiteral(Math.abs(value));
//   }
// }

// function _optimize_other_type(node: TypeNode, ctx: FastypeContext): TypeNode {
//   const _func = (): TypeNode => {
//     if (typeof node === "string") {
//       return node;
//     } else {
//       if ("unions" in node) {
//         return _optimize_union_type(node, ctx);
//       }
//       if ("tuples" in node) {
//         if (node.tuples.length <= 0) {
//           return "unknown";
//         }
//         if (node.tuples.length === 1) {
//           return _optimize_other_type(node.tuples[0], ctx);
//         }
//         const res_tuples = node.tuples.map((it) =>
//           _optimize_other_type(it, ctx)
//         );
//         switch (ctx.tuple_to_array(node)) {
//           case "dont cast":
//             return {
//               tuples: res_tuples,
//             };
//           case "cast to array":
//             return {
//               array_item_typ: _union_types_and_optimize({
//                 types_to_union: res_tuples,
//                 ctx,
//               }),
//             };
//         }
//       }
//       if ("generic_types" in node && node.generic_types?.length) {
//         return {
//           clzname: node.clzname,
//           generic_types: node.generic_types?.map((it) =>
//             _optimize_other_type(it, ctx)
//           ),
//         };
//       }
//       return node;
//     }
//   };
//   const _res = _func();
//   if (ctx.logd) {
//     if (!is_deep_equal(node, _res)) {
//       console.debug("optimize other type", { from: node, to: _res });
//     } else {
//       console.debug("optimize other type", { same: node });
//     }
//   }
//   return _res;
// }

// function _optimize_union_type(
//   node: UnionTypeNode,
//   ctx: FastypeContext
// ): TypeNode {
//   const _func = () => {
//     let unions = node.unions;
//     while (true) {
//       if (unions.length <= 0) {
//         return "unknown";
//       }
//       if (unions.length === 1) {
//         return _optimize_other_type(unions[0], ctx);
//       }
//       if (unions.find((it) => it === "unknown")) {
//         unions = unions.filter((it) => it !== "unknown");
//         continue;
//       }
//       // --------- optimize literals ---------
//       const {
//         matched: _literals_matched,
//         not_matched: _not_literal_not_deduplicate,
//       } = Streams.filter(
//         unions,
//         (it) => typeof it === "object" && "literal" in it
//       );
//       const not_literal = Streams.deduplicate(_not_literal_not_deduplicate);
//       let literals = Streams.deduplicate(_literals_matched);
//       unions = [...literals, ...not_literal];
//       const read_literals_with_value = () =>
//         literals.map((l) => {
//           if (l.literal === "undefined") {
//             return [undefined, l] as const;
//           }
//           const v = Jsons.load(l.literal);
//           // Repeat to pass the type guard
//           if (typeof v === "number") {
//             return [v, l] as const;
//           }
//           if (typeof v === "boolean") {
//             return [v, l] as const;
//           }
//           if (typeof v === "string") {
//             return [v, l] as const;
//           }
//           return [v, l] as const;
//         });
//       const _num_literals = Streams.filter(
//         read_literals_with_value(),
//         (it) => typeof it[0] === "number"
//       );
//       const { matched: bigint_literals, not_matched: number_literals } =
//         Streams.filter2(
//           _num_literals.matched,
//           (it) => "is_bigint" in it[1] && it[1].is_bigint
//         );
//       if (
//         not_literal.find((it) => it === "number") ||
//         number_literals.length > 30
//       ) {
//         not_literal.push("number");
//         literals = [
//           ...bigint_literals.map((it) => it[1]),
//           ..._num_literals.not_matched.map((it) => it[1]),
//         ];
//         unions = [...literals, ...not_literal];
//         continue;
//       }
//       if (
//         not_literal.find((it) => it === "bigint") ||
//         bigint_literals.length > 30
//       ) {
//         not_literal.push("bigint");
//         literals = [
//           ...number_literals.map((it) => it[1]),
//           ..._num_literals.not_matched.map((it) => it[1]),
//         ];
//         unions = [...literals, ...not_literal];
//         continue;
//       }
//       const _str_literals = Streams.filter(
//         read_literals_with_value(),
//         (it) => typeof it[0] === "string"
//       );
//       if (
//         not_literal.find((it) => it === "string") ||
//         _str_literals.matched.length > 30
//       ) {
//         not_literal.push("string");
//         literals = [..._str_literals.not_matched.map((it) => it[1])];
//         unions = [...literals, ...not_literal];
//         continue;
//       }
//       break;
//     }
//     return {
//       unions: unions.map((it) => _optimize_other_type(it, ctx)),
//     };
//   };

//   const _res = _func();
//   if (ctx.logd) {
//     if (!is_deep_equal(node, _res)) {
//       console.debug("optimize union type", { from: node, to: _res });
//     } else {
//       console.debug("optimize union type", { same: _res });
//     }
//   }
//   return _res;
// }

// function _union_two_type(a: TypeNode, b: TypeNode): UnionTypeNode {
//   const a_is_union = typeof a === "object" && "unions" in a;
//   const b_is_union = typeof b === "object" && "unions" in b;
//   if (a_is_union && b_is_union) {
//     return {
//       unions: [...a.unions, ...b.unions],
//     };
//   } else if (a_is_union && !b_is_union) {
//     return {
//       unions: [...a.unions, b],
//     };
//   } else if (!a_is_union && b_is_union) {
//     return {
//       unions: [a, ...b.unions],
//     };
//   } else {
//     return {
//       unions: [a, b],
//     };
//   }
// }

// export function _union_types_and_optimize(_param: {
//   types_to_union: TypeNode[];
//   ctx: FastypeContext;
// }): TypeNode {
//   const { types_to_union, ctx } = _param;
//   const _func = () => {
//     if (types_to_union.length <= 0) {
//       return "unknown";
//     }
//     let t: UnionTypeNode = {
//       unions: [types_to_union[0]],
//     };
//     for (let i = 1; i < types_to_union.length; i++) {
//       t = _union_two_type(t, types_to_union[i]);
//     }
//     return _optimize_union_type(t, ctx);
//   };

//   const _res = _func();
//   if (ctx.logd) {
//     console.debug("union types and optimize", {
//       from: types_to_union,
//       to: _res,
//     });
//   }
//   return _res;
// }

// export type OnTopLevelInput = (idx: number) => Promise<void>;

// export async function fastype(param: {
//   // deno-lint-ignore no-explicit-any
//   inputs: any[];
//   typename: string;
//   logd?: boolean | FastypeContext["logd"];
//   logi?: boolean | FastypeContext["logi"];
//   on_top_level_input?: OnTopLevelInput;
//   travel_iter_batch_size?: number;
//   tuple_to_array?: FastypeContext["tuple_to_array"];
// }) {
//   const { inputs, typename, tuple_to_array } = param;
//   let { travel_iter_batch_size } = param;
//   if (travel_iter_batch_size === undefined || travel_iter_batch_size < 1) {
//     travel_iter_batch_size = 20;
//   }
//   const logd = param.logd === true;
//   const logi = param.logi === true || logd === true;
//   const ctx: FastypeContext = {
//     root_inputs: "unknown",
//     logd,
//     logi,
//     tuple_to_array:
//       tuple_to_array !== undefined
//         ? tuple_to_array
//         : (node) => {
//             if (node.tuples.length > 25) {
//               return "cast to array";
//             }
//             return "dont cast";
//             // if () {
//             //   return "cast to array";
//             // } else {
//             //   return "dont cast";
//             // }
//           },
//   };

//   const travel_obj = async (
//     o: unknown,
//     cb: {
//       getter: () => TypeNode;
//       setter: (node_type: TypeNode) => void;
//       on_top_level_input?: OnTopLevelInput;
//     }
//   ) => {
//     const set_with_union = (v: TypeNode) => {
//       cb.setter(
//         _union_types_and_optimize({
//           types_to_union: [cb.getter(), v],
//           ctx,
//         })
//       );
//     };
//     const get_type_tuple_from_iter = async (
//       v: Iterable<unknown>,
//       on_top_level_input?: OnTopLevelInput
//     ) => {
//       const res: Map<number, TypeNode> = new Map();
//       const tasks = [...v].map((item, i) => {
//         return async () => {
//           await travel_obj(item, {
//             getter() {
//               if (res.has(i)) {
//                 return res.get(i)!;
//               } else {
//                 return "unknown";
//               }
//             },
//             setter(it) {
//               res.set(i, it);
//             },
//           });
//         };
//       });
//       for (const tasks_batch of Streams.split_array_use_batch_size(
//         travel_iter_batch_size,
//         tasks
//       )) {
//         if (on_top_level_input) {
//           await on_top_level_input(tasks_batch.start);
//         }
//         await Promise.all(tasks_batch.sliced.map((it) => it()));
//         if (on_top_level_input) {
//           await on_top_level_input(tasks_batch.end);
//         }
//       }
//       return [...res.values()];
//     };
//     if (cb.on_top_level_input) {
//       if (Array.isArray(o)) {
//         if (logi) {
//           console.debug("Travel top level inputs array");
//         }
//         set_with_union({
//           unions: await get_type_tuple_from_iter(o, cb.on_top_level_input),
//         });
//         return;
//       } else {
//         throw new Error("top level must be array");
//       }
//     }
//     if (o === undefined || typeof o === "undefined") {
//       set_with_union({ literal: "undefined" });
//       return;
//     }
//     if (typeof o === "symbol") {
//       set_with_union("symbol");
//       return;
//     }
//     if (typeof o === "function") {
//       set_with_union("function");
//       return;
//     }
//     if (typeof o === "number") {
//       if (isNaN(o)) {
//         set_with_union("typeof NaN");
//         return;
//       } else if (!isFinite(o)) {
//         set_with_union("typeof Infinity");
//         return;
//       } else {
//         set_with_union({ literal: Jsons.dump(o) });
//         return;
//       }
//     }
//     if (typeof o === "string" || typeof o === "boolean") {
//       set_with_union({ literal: Jsons.dump(o) });
//       return;
//     }
//     if (typeof o === "bigint") {
//       set_with_union({ literal: Jsons.dump(o), is_bigint: true });
//       return;
//     }
//     if (typeof o === "object") {
//       if (o === null) {
//         set_with_union({ literal: "null" });
//         return;
//       }
//       if (isDateObject(o)) {
//         set_with_union({
//           clzname: "Date",
//         });
//         return;
//       }
//       if (o instanceof Temporal.Instant) {
//         set_with_union({
//           clzname: "Temporal.Instant",
//         });
//         return;
//       }
//       if (o instanceof Temporal.Duration) {
//         set_with_union({
//           clzname: "Temporal.Duration",
//         });
//         return;
//       }
//       if (o instanceof Temporal.PlainDate) {
//         set_with_union({
//           clzname: "Temporal.PlainDate",
//         });
//         return;
//       }
//       if (o instanceof Temporal.PlainDateTime) {
//         set_with_union({
//           clzname: "Temporal.PlainDateTime",
//         });
//         return;
//       }
//       if (o instanceof Temporal.PlainMonthDay) {
//         set_with_union({
//           clzname: "Temporal.PlainMonthDay",
//         });
//         return;
//       }
//       if (o instanceof Temporal.PlainTime) {
//         set_with_union({
//           clzname: "Temporal.PlainTime",
//         });
//         return;
//       }
//       if (o instanceof Temporal.PlainYearMonth) {
//         set_with_union({
//           clzname: "Temporal.PlainYearMonth",
//         });
//         return;
//       }
//       if (o instanceof Temporal.ZonedDateTime) {
//         set_with_union({
//           clzname: "Temporal.ZonedDateTime",
//         });
//         return;
//       }
//       if (isRegex(o)) {
//         set_with_union({
//           clzname: "RegExp",
//         });
//         return;
//       }
//       if (isArguments(o)) {
//         set_with_union({
//           clzname: "IArguments",
//         });
//         return;
//       }
//       if (isArrayBuffer(o)) {
//         set_with_union({
//           clzname: "ArrayBuffer",
//         });
//         return;
//       }
//       if (isSharedArrayBuffer(o)) {
//         set_with_union({
//           clzname: "SharedArrayBuffer",
//         });
//         return;
//       }
//       const collection_type = whichCollection(o);
//       if (collection_type) {
//         switch (collection_type) {
//           case "Map":
//             set_with_union({
//               clzname: "Map",
//               generic_types: await (async () => {
//                 const _o = o as Map<unknown, unknown>;
//                 return [
//                   {
//                     unions: await get_type_tuple_from_iter(_o.keys()),
//                   },
//                   {
//                     unions: await get_type_tuple_from_iter(_o.values()),
//                   },
//                 ] as const;
//               })(),
//             });
//             return;
//           case "Set":
//             set_with_union({
//               clzname: "Set",
//               generic_types: [
//                 {
//                   unions: await get_type_tuple_from_iter(o as Set<unknown>),
//                 },
//               ],
//             });
//             return;
//           case "WeakMap":
//           case "WeakSet":
//             throw new Error(`Unsupport collection type : ${collection_type}`);
//           default:
//             throw new Error(`Unknown collection type : ${collection_type}`);
//         }
//       }
//       const boxed_primitive_type = whichBoxedPrimitive(o);
//       if (boxed_primitive_type) {
//         set_with_union({
//           clzname: boxed_primitive_type,
//         });
//         return;
//       }
//       const typed_array_type = whichTypedArray(o);
//       if (typed_array_type) {
//         set_with_union({
//           clzname: typed_array_type,
//         });
//         return;
//       }
//       if (Array.isArray(o)) {
//         set_with_union({
//           tuples: await get_type_tuple_from_iter(o),
//         });
//         return;
//       }
//       const keys: string[] = Object.keys(o);
//       if (keys.length === 0) {
//         set_with_union("empty_object");
//         return;
//       }
//       const fields: Map<
//         `"${string}"`,
//         {
//           typ: TypeNode;
//           optional: boolean;
//         }
//       > = new Map();
//       for (const k of keys) {
//         const handler: { value: TypeNode } = {
//           value: "unknown",
//         };
//         const v = o[k as keyof typeof o];
//         await travel_obj(v, {
//           getter() {
//             return handler.value;
//           },
//           setter(it) {
//             handler.value = it;
//           },
//         });
//         fields.set(Jsons.dump(k), { typ: handler.value, optional: false });
//       }
//       set_with_union({
//         fields,
//       });
//       return;
//     }
//     throw new Error(
//       `typeof o (is ${typeof o}) out of range : o is ${o} , jsonfiy is ${Jsons.dump(
//         o
//       )}`
//     );
//   };

//   if (logi) console.debug("start travel object tree");

//   await travel_obj(inputs, {
//     getter() {
//       return ctx.root_inputs;
//     },
//     setter(it) {
//       ctx.root_inputs = it;
//     },
//     on_top_level_input: param.on_top_level_input,
//   });

//   if (logi) console.debug("finish travel object tree");

//   const _to_ts_type_node = (n: TypeNode): ts.TypeNode => {
//     if (n === "unknown") {
//       return ts.factory.createTypeReferenceNode("unknown");
//     }
//     if (n === "function") {
//       return ts.factory.createTypeReferenceNode("Function");
//     }
//     if (n === "symbol") {
//       return ts.factory.createTypeReferenceNode("Symbol");
//     }
//     if (n === "string") {
//       return ts.factory.createTypeReferenceNode("string");
//     }
//     if (n === "number") {
//       return ts.factory.createTypeReferenceNode("number");
//     }
//     if (n === "bigint") {
//       return ts.factory.createTypeReferenceNode("bigint");
//     }
//     if (n === "empty_object") {
//       return ts.factory.createTypeReferenceNode("Record", [
//         ts.factory.createTypeReferenceNode("PropertyKey"),
//         ts.factory.createTypeReferenceNode("never"),
//       ]);
//     }
//     if (n === "typeof Infinity") {
//       return ts.factory.createTypeReferenceNode("typeof Infinity");
//     }
//     if (n === "typeof NaN") {
//       return ts.factory.createTypeReferenceNode("typeof NaN");
//     }
//     if ("literal" in n) {
//       if (n.literal === "undefined") {
//         return ts.factory.createTypeReferenceNode("undefined");
//       }
//       if (n.literal === "null") {
//         return ts.factory.createLiteralTypeNode(ts.factory.createNull());
//       }
//       if ("is_bigint" in n && n.is_bigint) {
//         return ts.factory.createLiteralTypeNode(
//           ts.factory.createBigIntLiteral(
//             BigInt(Jsons.load(n.literal)).toString()
//           )
//         );
//       }
//       const l = Jsons.load(n.literal);
//       if (typeof l === "number") {
//         return ts.factory.createLiteralTypeNode(_ts_number_node(l));
//       }
//       if (typeof l === "boolean") {
//         if (l) {
//           return ts.factory.createLiteralTypeNode(ts.factory.createTrue());
//         } else {
//           return ts.factory.createLiteralTypeNode(ts.factory.createFalse());
//         }
//       }
//       if (typeof l === "string") {
//         return ts.factory.createLiteralTypeNode(
//           ts.factory.createStringLiteral(l)
//         );
//       }
//       throw new Error(`json parse literal result unknown type : ${n.literal}`);
//     }
//     if ("clzname" in n) {
//       return ts.factory.createTypeReferenceNode(
//         n.clzname,
//         (n.generic_types ?? []).map((it) => _to_ts_type_node(it))
//       );
//     }
//     if ("unions" in n) {
//       return ts.factory.createUnionTypeNode(
//         n.unions.map((it) => _to_ts_type_node(it))
//       );
//     }
//     if ("array_item_typ" in n) {
//       return ts.factory.createArrayTypeNode(_to_ts_type_node(n.array_item_typ));
//     }
//     if ("tuples" in n) {
//       return ts.factory.createTupleTypeNode(
//         n.tuples.map((it) => _to_ts_type_node(it))
//       );
//     }
//     if ("fields" in n) {
//       return ts.factory.createTypeLiteralNode([
//         ...n.fields
//           .entries()
//           .map(([name, field]) =>
//             ts.factory.createPropertySignature(
//               undefined,
//               Jsons.load(name),
//               field.optional
//                 ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
//                 : undefined,
//               _to_ts_type_node(field.typ)
//             )
//           ),
//       ]);
//     }
//     const _ = n satisfies never;
//     throw new Error(
//       `'not match , n is ${n} (jsonfiy is ${JSON.stringify(n)})'`
//     );
//   };

//   const root_type_node = _to_ts_type_node(ctx.root_inputs);

//   const root_TypeAliasDeclaration = ts.factory.createTypeAliasDeclaration(
//     ts.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Export),
//     typename,
//     undefined,
//     root_type_node
//     // ts.factory.createIndexedAccessTypeNode(
//     //   root_type_node,
//     //   ts.factory.createTypeReferenceNode("number")
//     // )
//   );

//   if (logi) console.debug("start create ts source file");

//   const sourcefile = ts.createSourceFile(
//     `${typename}.ts`,
//     "",
//     ts.ScriptTarget.Latest
//   );

//   const printer = ts.createPrinter({
//     newLine: ts.NewLineKind.LineFeed,
//   });

//   if (logi) console.debug("start print ts source file");

//   return printer.printNode(
//     ts.EmitHint.Unspecified,
//     root_TypeAliasDeclaration,
//     sourcefile
//   );
// }
