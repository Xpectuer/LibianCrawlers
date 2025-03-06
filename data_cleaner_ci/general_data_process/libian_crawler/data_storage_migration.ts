import { PostgresColumnType } from "../../pg.ts";
import { _libian_crawler_cleaned } from "./data_storage.ts";
import {
  AlterTableColumnAlteringBuilder,
  CreateTableBuilder,
  JSONColumnType,
  Kysely,
  Migration,
  InsertObject,
  Expression,
} from "kysely";

export type CreateOrAlterTableBuilder<N extends string> =
  | CreateTableBuilder<N>
  | Pick<AlterTableColumnAlteringBuilder, "addColumn" | "execute">;
// | AlterTableBuilder;

export type RequireImmediateValue<V> = V extends
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  ? V
  : Expression<V | unknown>;

export function create_migration<
  DBInterface,
  V extends string = typeof version,
  CM extends "create_table" | "alter_table" = typeof ctb_mode
>(param: {
  version: V;
  ctb_mode: "create_table" | "alter_table";
  func_up: (ctx: {
    db: Kysely<DBInterface>;
    create_or_alter_table: <
      TB extends DBInterface[TN],
      TN extends string & keyof DBInterface = string & keyof DBInterface
    >(
      table_name: TN,
      cb: (ctb_ctx: {
        add_column: <CN extends string & keyof TB>(
          param:
            | {
                col_name: CN;
                datatype: Parameters<
                  CreateOrAlterTableBuilder<TN>["addColumn"]
                >[1] &
                  (NonNullable<TB[CN]> extends string | bigint
                    ? "text" | `varchar${string}`
                    : NonNullable<TB[CN]> extends Date
                    ? "timestamptz"
                    : NonNullable<TB[CN]> extends PostgresColumnType.Numeric
                    ? "decimal" | "bigint" | "integer"
                    : NonNullable<TB[CN]> extends JSONColumnType<object | null>
                    ? "jsonb"
                    : NonNullable<TB[CN]> extends boolean
                    ? "boolean"
                    : string);
              } & (
                | { pk: true }
                | {
                    nullable: null extends TB[CN]
                      ? true
                      : undefined extends TB[CN]
                      ? true
                      : NonNullable<TB[CN]> extends JSONColumnType<infer J>
                      ? null extends J
                        ? true
                        : undefined extends J
                        ? true
                        : false
                      : false;
                    indexed?: "asc" | "desc";
                    // | (NonNullable<TB[CN]> extends string
                    //     ? "gin" | "gist"
                    //     : never);
                  }
              ) &
                (CM extends "alter_table"
                  ? null extends TB[CN]
                    ? // deno-lint-ignore ban-types
                      {}
                    : {
                        default_value: () => RequireImmediateValue<
                          CN extends keyof InsertObject<DBInterface, TN>
                            ? InsertObject<DBInterface, TN>[CN]
                            : never
                        >;
                      }
                  : // deno-lint-ignore ban-types
                    {})
        ) => typeof ctb_ctx;
        ok: () => CreateOrAlterTableBuilder<TN>;
      }) => Promise<void>
    ) => Promise<void>;
  }) => Promise<void>;
  func_down: (ctx: { db: Kysely<DBInterface> }) => Promise<void>;
}) {
  const { version, func_up, func_down, ctb_mode } = param;
  return {
    version,
    async up(db: Kysely<DBInterface>) {
      console.debug(`Start migration up`, { that: this, db });
      await db.schema
        .createSchema(_libian_crawler_cleaned)
        .ifNotExists()
        .execute();
      await func_up({
        db,
        create_or_alter_table: async (table_name, cb) => {
          console.debug(`Start create or alter table : ${table_name}`);
          const need_indexed_cols: [string, "asc" | "desc"][] = [];
          const wrap_to_cb_param: <N extends string>(
            ctb2: CreateOrAlterTableBuilder<N>
          ) => Parameters<typeof cb>[0] = (ctb_next) => {
            return {
              add_column(param) {
                const { col_name, datatype } = param;
                const builder = ctb_next.addColumn(
                  col_name,
                  datatype,
                  (col) => {
                    if ("pk" in param && param.pk) {
                      return col.primaryKey();
                    }
                    if (!("nullable" in param && param["nullable"])) {
                      col = col.notNull();
                    }
                    if ("indexed" in param && param["indexed"]) {
                      need_indexed_cols.push([col_name, param["indexed"]]);
                    }
                    if ("default_value" in param) {
                      col = col.defaultTo(param["default_value"]());
                    }
                    return col;
                  }
                );
                return wrap_to_cb_param(builder);
              },
              ok() {
                // console.debug("create table:", ctb_next.compile());
                return ctb_next;
              },
            };
          };
          const ctb_root =
            ctb_mode === "create_table"
              ? db.schema.createTable(table_name)
              : ctb_mode === "alter_table"
              ? db.schema.alterTable(table_name)
              : (() => {
                  throw new Error(`Invalid ctb_mode ${ctb_mode}`);
                })();
          // 这里类型其实有问题(因为缺失 execute 函数)。但是我不想改了。
          await cb(wrap_to_cb_param(ctb_root as any));
          for (const [col_name, mode] of need_indexed_cols) {
            const index_name = `index_${col_name}_${mode}`;
            let builder = db.schema.createIndex(index_name).on(table_name);
            if (mode === "asc" || mode === "desc") {
              builder = builder.column(`${col_name} ${mode}`);
            } else {
              throw new Error(`TODO for index mode ${mode}`);
              // builder.using(mode);
              // builder = builder.column(col_name);
              // if (mode === "gin") {
              //   builder = builder.using(
              //     `gin (to_tsvector('chinese', ${col_name} ))`
              //   );
              // } else {
              // }
            }
            console.debug(`create index:`, builder.compile().sql);
            await builder.ifNotExists().execute();
          }
          console.debug(`Success create table : ${table_name}`);
        },
      });
      console.debug(`Success migration up`);
    },
    async down(db: Kysely<DBInterface>) {
      console.debug(`Start migration down`, { that: this, db });
      await func_down({ db });
      console.debug(`Success migration down`);
    },
  } satisfies Migration & { version: string };
}
