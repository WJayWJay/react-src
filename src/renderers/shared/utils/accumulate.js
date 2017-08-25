/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule accumulate
 * @flow
 */

'use strict';

var invariant = require('fbjs/lib/invariant');

/**
 * Accumulates items that must not be null or undefined.
 * 累计那些不能为null,undefined 的items 
 *
 * This is used to conserve memory by avoiding array allocations.
 * 这通常用于守护内存，避免数组分配问题
 * @return {*|array<*>} An accumulation of items. 返回Items 的累积值
 */
function accumulate<T>(
  current: ?(T | Array<T>),
  next: T | Array<T>,
): T | Array<T> {
  invariant(
    next != null,
    'accumulate(...): Accumulated items must be not be null or undefined.',
  );

  if (current == null) {
    return next;
  }

  // Both are not empty. Warning: Never call x.concat(y) when you are not
  // certain that x is an Array (x could be a string with concat method).
  // 两个都不为空， 警告：当你不确定 x 是否是数组时，不要调用 x.concat(y) （x 可能是拥有concat 方法的字符串）
  if (Array.isArray(current)) {
    return current.concat(next);
  }

  if (Array.isArray(next)) {
    return [current].concat(next);
  }

  return [current, next];
}

module.exports = accumulate;
