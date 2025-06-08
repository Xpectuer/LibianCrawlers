// deno-lint-ignore-file no-unused-vars no-node-globals no-window prefer-const no-prototype-builtins ban-unused-ignore no-explicit-any
// object library - specific behaviors for each object type

import { Buffer } from "node:buffer";

const objectBehaviors: Record<string, any> = {};

// return true if item is a primitive data type
export const isPrimitive = (item: unknown) => {
  let type = typeof item;
  return type === "number" || type === "string" || type === "boolean" ||
    type === "undefined" || type === "bigint" || type === "symbol" ||
    item === null;
};

// establish a "type" keyword for an object
export const objectType = (obj: { constructor: { name: string } }) => {
  // match primitives right away
  if (isPrimitive(obj) || !(obj instanceof Object)) {
    return "primitive";
  }

  // try to match object constructor name
  const consName = obj.constructor && obj.constructor.name &&
    obj.constructor.name.toLowerCase();
  if (
    typeof consName === "string" && consName.length &&
    objectBehaviors[consName]
  ) {
    return consName;
  }

  // try to match by looping through objectBehaviors type property
  let typeTry;
  for (const name in objectBehaviors) {
    typeTry = objectBehaviors[name].type;
    if (!typeTry || obj instanceof typeTry) {
      // console.log('objectType matched in a fall-back loop name:',name);
      return name;
    }
  }
  return "unknown";
};

/**
 * define object behaviors
 * Note: The order is important - custom objects must be listed BEFORE
 *       the standard JavaScript Object.
 * @namespace
 * @property {*} type - object data "type"
 * @property {Boolean} [mayDeepCopy] - true if object may be deep copied
 * @property {function} [addElement] - add a single element to object
 * @property {function} [makeEmpty] - make an empty object
 * @property {function} makeShallow - make shallow copy of object
 * @property {function} [iterate] - iterate over objects elements
 *                                  with callback({key,value,"type"})
 */

const arrayAddElement = (array: any, key: any, value: any) =>
  Array.prototype.push.call(array, value);

const arrayMakeEmpty = (source: any) => {
  const newArray: never[] = [];
  Object.setPrototypeOf(newArray, Object.getPrototypeOf(source));
  return newArray;
};

const arrayMakeShallow = (source: any) => {
  const dest = [...source];
  Object.setPrototypeOf(dest, Object.getPrototypeOf(source));
  return dest;
};

const arrayIterate = (
  array: string | any[],
  copyNonEnumerables: any,
  callback: (arg0: { key: number; value: any; type: string }) => void,
) => {
  const len = array.length;
  for (let i = 0; i < len; i++) {
    const val = array[i];
    const elInfo = {
      key: i,
      value: val,
      type: objectType(val),
    };
    callback(elInfo);
  }
};

const addArrayBehavior = () => {
  Object.assign(objectBehaviors, {
    "array": {
      type: Array,
      mayDeepCopy: true,
      addElement: arrayAddElement,
      makeEmpty: arrayMakeEmpty,
      makeShallow: arrayMakeShallow,
      iterate: arrayIterate,
    },
  });
};

const addDateBehavior = () => {
  Object.assign(objectBehaviors, {
    "date": {
      type: Date,
      makeShallow: (date: { getTime: () => string | number | Date }) =>
        new Date(date.getTime()),
    },
  });
};

const addRegExpBehavior = () => {
  Object.assign(objectBehaviors, {
    "regexp": {
      type: RegExp,
      makeShallow: (src: string | RegExp) => new RegExp(src),
    },
  });
};

const addFunctionBehavior = () => {
  Object.assign(objectBehaviors, {
    "function": {
      type: Function,
      makeShallow: (fn: any) => fn,
    },
  });
};

const addErrorBehavior = () => {
  Object.assign(objectBehaviors, {
    "error": {
      type: Error,
      makeShallow: (
        err: { message: string | undefined; stack: string | undefined },
      ) => {
        const errCopy = new Error(err.message);
        errCopy.stack = err.stack;
        return errCopy;
      },
    },
  });
};

// in case they don't exist, perform existence checks on these
// types before adding them

// add a named TypedArray to objectBehaviors
const addTypedArrayBehavior = (name: string) => {
  // let type = (typeof global !== "undefined" && global[name]) ||
  //   (typeof window !== "undefined" && window[name]) ||
  //   (typeof WorkerGlobalScope !== "undefined" && WorkerGlobalScope[name]);
  let type = (globalThis as any)[name];
  // console.debug("type is", type);
  if (typeof type !== "undefined") {
    objectBehaviors[name.toLowerCase()] = {
      type,
      makeShallow: (source: any) => {
        // console.debug("source is ", source);
        return type.from(source);
      },
    };
  }
};

const addAllTypedArrayBehaviors = () => {
  const typedArrayNames = [
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float32Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array",
  ];
  typedArrayNames.forEach((name) => addTypedArrayBehavior(name));
};

const addArrayBufferBehavior = () => {
  if (typeof ArrayBuffer !== "undefined") {
    Object.assign(objectBehaviors, {
      "arraybuffer": {
        type: ArrayBuffer,
        makeShallow: (buffer: string | any[]) => buffer.slice(0),
      },
    });
  }
};

const addMapBehavior = () => {
  if (typeof Map === "undefined") return;
  Object.assign(objectBehaviors, {
    "map": {
      type: Map,
      mayDeepCopy: true,
      addElement: (
        map: { set: (arg0: any, arg1: any) => any },
        key: any,
        value: any,
      ) => map.set(key, value),
      makeEmpty: () => new Map(),
      makeShallow: (
        sourceMap: Iterable<readonly [unknown, unknown]> | null | undefined,
      ) => new Map(sourceMap),
      iterate: (
        map: any[],
        copyNonEnumerables: any,
        callback: (arg0: { key: any; value: any; type: string }) => void,
      ) => {
        map.forEach((val: any, key: any) => {
          const elInfo = {
            key: key,
            value: val,
            type: objectType(val),
          };
          callback(elInfo);
        });
      },
    },
  });
};

const addSetBehavior = () => {
  if (typeof Set === "undefined") return;
  Object.assign(objectBehaviors, {
    "set": {
      type: Set,
      mayDeepCopy: true,
      addElement: (set: { add: (arg0: any) => any }, key: any, value: any) =>
        set.add(value),
      makeEmpty: () => new Set(),
      makeShallow: (set: Iterable<unknown> | null | undefined) => new Set(set),
      iterate: (
        set: any[],
        copyNonEnumerables: any,
        callback: (arg0: { key: null; value: any; type: string }) => void,
      ) => {
        set.forEach((val: any) => {
          const elInfo = {
            key: null,
            value: val,
            type: objectType(val),
          };
          callback(elInfo);
        });
      },
    },
  });
};

const addWeakSetBehavior = () => {
  if (typeof WeakSet === "undefined") return;
  Object.assign(objectBehaviors, {
    "weakset": {
      type: WeakSet,
      makeShallow: (wset: any) => wset,
    },
  });
};

const addWeakMapBehavior = () => {
  if (typeof WeakMap === "undefined") return;
  Object.assign(objectBehaviors, {
    "weakmap": {
      type: WeakMap,
      makeShallow: (wmap: any) => wmap,
    },
  });
};

// node.js Buffer
const addBufferBehavior = () => {
  if (typeof Buffer === "undefined") return;
  Object.assign(objectBehaviors, {
    "buffer": {
      type: Buffer,
      makeShallow: (buf: any) => Buffer.from(buf),
    },
  });
};

// always include Object, primitive, unknown
const objectAddElement = (
  obj: { [x: PropertyKey]: any },
  key: PropertyKey,
  value: any,
  descriptor = undefined,
) => {
  if (!descriptor) {
    obj[key] = value;
  } else {
    Object.defineProperty(obj, key, descriptor);
  }
};

const objectMakeEmpty = (source: any) => {
  const newObj = {};
  Object.setPrototypeOf(newObj, Object.getPrototypeOf(source));
  return newObj;
};

const objectMakeShallow = (source: any) => {
  const dest = Object.assign({}, source);
  Object.setPrototypeOf(dest, Object.getPrototypeOf(source));
  return dest;
};

const objectIterate = (
  obj: { [x: string]: any; propertyIsEnumerable?: any },
  copyNonEnumerables: any,
  callback: (
    arg0: {
      key: string;
      value: any;
      type: string;
      descriptor?: PropertyDescriptor | undefined;
    },
  ) => void,
) => {
  const keys = copyNonEnumerables
    ? Object.getOwnPropertyNames(obj)
    : Object.keys(obj);
  const len = keys.length;
  for (let i = 0; i < len; i++) {
    const key = keys[i],
      value = obj[key],
      elInfo = {
        key,
        value,
        type: objectType(value),
        descriptor: undefined as PropertyDescriptor | undefined,
      };
    if (copyNonEnumerables && !obj.propertyIsEnumerable(key)) {
      elInfo.descriptor = Object.getOwnPropertyDescriptor(obj, key);
    }
    callback(elInfo);
  }
};

const addObjectBehavior = () => {
  Object.assign(objectBehaviors, {
    "object": {
      type: Object,
      mayDeepCopy: true,
      addElement: objectAddElement,
      makeEmpty: objectMakeEmpty,
      makeShallow: objectMakeShallow,
      iterate: objectIterate,
    },
  });
};

const addUnknownAndPrimitive = () => {
  Object.assign(objectBehaviors, {
    "instant": {
      makeShallow: (source: any) => {
        if (source instanceof Temporal.Instant) {
          return Temporal.Instant.fromEpochMilliseconds(
            source.epochMilliseconds,
          );
        } else {
          throw new Error("source should be instant");
        }
      },
    },
  });
};

const addInstantBehaviors = () => {
  Object.assign(objectBehaviors, {
    "unknown": {
      makeShallow: (source: any) => source,
    },
    "primitive": {
      makeShallow: (source: any) => source,
    },
  });
};

addArrayBehavior();
addDateBehavior();
addRegExpBehavior();
addFunctionBehavior();
addErrorBehavior();
addAllTypedArrayBehaviors();
addArrayBufferBehavior();
addMapBehavior();
addSetBehavior();
addWeakSetBehavior();
addWeakMapBehavior();
addBufferBehavior();
addObjectBehavior();
addUnknownAndPrimitive();
addInstantBehaviors();

/**
 * object actions as defined in objectBehaviors { }
 * @typedef {Object} ObjectActions
 * @property {Boolean} mayDeepCopy
 * @property {Function} addElement
 * @property {Function} makeEmpty
 * @property {Function} makeShallow
 * @property {Function} iterate
 */
/**
 * return object actions for the named typed
 * @param {string} typeName
 * @return {ObjectActions}
 */
export function objectActions(typeName: string) {
  return objectBehaviors[typeName];
}
