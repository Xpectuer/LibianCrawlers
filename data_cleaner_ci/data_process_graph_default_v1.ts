import { DPDiGraph, DPNode } from "./data_process_graph.ts";

export const data_process_graph_default_v1_keys = [
  "libian_crawler_postgres_table_garbage",
] as const;

export function create_data_process_graph_default_v1() {
  const nodes = {
    libian_crawler_postgres_table_garbage: {
        
    } satisfies DPNode,
  } as const;
  const graph: DPDiGraph<
    (typeof data_process_graph_default_v1_keys)[number],
    typeof data_process_graph_default_v1_keys
  > = {
    get_keys() {
      return data_process_graph_default_v1_keys;
    },
    get_node(k) {
      return nodes?.[k] ?? null;
    },
    get_edges() {
      return [];
    },
  };
  return graph;
}
