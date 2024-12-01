import pl from "nodejs-polars";

export type DPEdge<F extends DPNode = DPNode, T extends DPNode = F> = {
  from: F;
  to: T;
};

export type DPNodeFromPolars = {
  mode: "polars_dataframe";
  value: pl.DataFrame;
};

export type DPNodeStreamLike<
  T,
  S extends AsyncGenerator<T> = AsyncGenerator<T>
> = {
  mode: "stream_like";
  get_stream: () => Promise<S>;
};

export type DPNodeComputed<
  PrevNodes extends readonly DPNode[],
  Latest = PrevNodes
> = {
  mode: "computed";
  get_prev_nodes: () => PrevNodes;
  check_update: (
    latest: null | Latest,
    prevNodes: PrevNodes
  ) => [boolean, Latest];
  update: (prevNodes: PrevNodes) => DPNode;
};

export type DPNode = DPNodeFromPolars | DPNodeComputed<DPNode[]>;

export type DPDiGraph<K, KS extends readonly K[] = readonly K[]> = {
  get_node: (k: K) => null | DPNode;
  get_keys: () => KS;
  get_edges: () => readonly DPEdge[];
};

export type DPNodeMappingTask<I extends DPNode, O extends DPNode> = {};

export type DPNodeMapper<I extends DPNode, O extends DPNode> = (
  data_input: I
) => O | DPNodeMappingTask<I, O>;

// export type DPNodeMappingOneByOne<IV,OV> = DFNodeMapper<>

//
// 以 TL 开头的应当代表 Literal 类型。
//
// 以 TB 开头的代表业务的类型。

export const tlNumber = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
] as const;

export type TLNumber = (typeof tlNumber)[number];
export type TBQQNumber = TLNumber[];
export type TLPhoneNumber = (TLNumber | "*" | "#")[];

// mappers

// export type MapQQ2Phone = DataProcessMapper<TBQQNumber, TLPhoneNumber>;
