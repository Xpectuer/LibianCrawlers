export type ICache<K extends string, V> = {
  get_batch(keys: Set<K>): Record<K, V | Promise<V>>;

  set(k: K, v: V): "ok" | Promise<"ok">;
};

export function create_cache_in_memory<V>(): ICache<string, V> {
  const cache: Record<string, V> = {};
  return {
    get_batch(keys) {
      const res: Record<string, V> = {};
      for (const k of keys) {
        res[k] = cache[k];
      }
      return res;
    },
    set(k, v) {
      cache[k] = v;
      return "ok";
    },
  };
}
