// deno-lint-ignore-file no-explicit-any ban-types prefer-const
"use strict";

import { isPrimitive, objectActions, objectType } from "./dca-library.ts";

/**
 * copy options for deep-copy-all
 * @typedef {Object} CopyOptions
 * @property {boolean} goDeep
 * @property {boolean} includeNonEnumerable
 * @property {boolean} detectCircular
 * @property {number} maxDepth
 */

/**
 * args for copyObjectContents()
 * @typedef {Object} CopyArgs
 * @property {Object} destObject
 * @property {string} srcType
 * @property {Watcher} watcher
 * @property {CopyOptions|Object} options
 */

/** @type {CopyOptions} **/
const defaultOpts = {
  goDeep: true,
  includeNonEnumerable: false,
  detectCircular: true,
  maxDepth: 20,
};
function setMissingOptions(
  options: {
    [x: string]: any;
    goDeep?: boolean;
    includeNonEnumerable?: boolean;
    detectCircular?: boolean;
    maxDepth?: number;
  },
) {
  Object.keys(defaultOpts).forEach((optName) => {
    if (typeof options[optName] === "undefined") {
      options[optName] = (defaultOpts as any)[optName];
    }
  });
}

// watch for circular references
class Watcher {
  _seenMap: WeakMap<WeakKey, any>;

  constructor() {
    this._seenMap = new WeakMap();
  }

  setAsCopied(obj: any, copy: any) {
    if (!(obj instanceof Object)) return;
    this._seenMap.set(obj, copy);
  }

  wasCopied(obj: any) {
    if (!(obj instanceof Object)) return false;
    return this._seenMap.has(obj);
  }

  getCopy(obj: any) {
    return this._seenMap.get(obj);
  }
}

/**
 * make copy of element
 * @param {Object} element
 * @param {ObjectActions} elActions
 * @param {Object} args
 * @param {CopyOptions|Object} args.options
 * @param {Watcher} args.watcher
 * @return {*}
 */
function copyElement(
  element: any,
  elActions: {
    mayDeepCopy: any;
    addElement?: Function;
    makeEmpty: any;
    makeShallow: any;
    iterate?: Function;
  },
  args: { options: any; watcher: any },
) {
  const { options, watcher } = args;
  let copy;
  // console.debug("elActions", {
  //   elActions,
  //   element,
  // });
  if (elActions.mayDeepCopy) {
    copy = elActions.makeEmpty(element);
    if (options.detectCircular) watcher.setAsCopied(element, copy);
  } else {
    copy = elActions.makeShallow(element);
  }
  return copy;
}

function checkForExceededDepth(depth: number, maxDepth: number) {
  if (depth >= maxDepth) {
    // console.log('copyObjectContents max depth exceeded srcObject:',srcObject);
    throw `Error max depth of ${maxDepth} levels exceeded, possible circular reference`;
  }
}

/**
 * copy source object contents to destination object (recursive)
 * @param {[]|{}} srcObject
 * @param {CopyArgs} args
 * @param {number} depth
 */
const copyObjectContents = (
  srcObject: any,
  args: { destObject: any; srcType: any; watcher: any; options: any },
  depth: number,
) => {
  const { destObject, srcType, watcher, options } = args;
  const detectCircular = options.detectCircular;

  checkForExceededDepth(++depth, options.maxDepth);

  const objActions = objectActions(srcType);
  if (!objActions.mayDeepCopy) return;

  const addElementToObject = objActions.addElement;

  // iterate over source object's elements
  objActions.iterate(
    srcObject,
    options.includeNonEnumerable,
    (elInfo: { value: any; type: any; key: any; descriptor: any }) => {
      const elValue = elInfo.value,
        elType = elInfo.type,
        elActions = objectActions(elType);
      let elSeenBefore = false, elCopy;

      // create copy of source element
      if (detectCircular && watcher.wasCopied(elValue)) {
        // console.log('copyObjectContents was seen, using reference elValue:',
        // elValue);
        elCopy = watcher.getCopy(elValue);
        elSeenBefore = true;
      } else {
        elCopy = copyElement(elValue, elActions, { options, watcher });
      }

      addElementToObject(destObject, elInfo.key, elCopy, elInfo.descriptor);

      if (!elActions.mayDeepCopy || elSeenBefore) return;

      copyObjectContents(elValue, {
        destObject: elCopy,
        srcType: elType,
        watcher,
        options,
      }, depth);
    },
  );
};

/**
 * return deep copy of the source
 * @param {Date|[]|{}} source
 * @param {CopyOptions} options
 * @return {*}
 */
export function ______deepCopy(source: any, options = defaultOpts) {
  setMissingOptions(options);

  // don't deep copy primitives
  if (isPrimitive(source)) return source;

  const srcType = objectType(source);
  const srcActions = objectActions(srcType);

  if (!options.goDeep || !srcActions.mayDeepCopy) {
    return srcActions.makeShallow(source);
  }

  // create watcher for circular references
  const watcher = (options.detectCircular) ? new Watcher() : null;

  // recursive copy: make empty object to be filled by copyObjectContents
  let destObject = srcActions.makeEmpty(source);

  if (options.detectCircular) watcher!.setAsCopied(source, destObject);

  // copy contents of source object to destination object
  copyObjectContents(source, { destObject, srcType, watcher, options }, 0);
  return destObject;
}
