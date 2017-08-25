/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CallbackQueue
 * @flow
 */

'use strict';

var PooledClass = require('PooledClass');

var invariant = require('fbjs/lib/invariant');
var validateCallback = require('validateCallback');

/**
 * A specialized pseudo-event module to help keep track of components waiting to
 * be notified when their DOM representations are available for use.
 * 一个专门的伪事件模块，追踪组件当dom呈现可用时，会被通知
 *
 * This implements `PooledClass`, so you should never need to instantiate this.
 * Instead, use `CallbackQueue.getPooled()`.
 *
 * @class CallbackQueue
 * @implements PooledClass
 * @internal
 */
class CallbackQueue<T, Targ> {
  _callbacks: ?Array<(arg: Targ) => void>;
  _contexts: ?Array<T>;
  _arg: Targ;

  constructor(arg) {
    this._callbacks = null;
    this._contexts = null;
    this._arg = arg;
  }

  /**
   * Enqueues a callback to be invoked when `notifyAll` is invoked.
   * 把一个可调用的callback 放入队列，在notifyAll时调用
   * @param {function} callback Invoked when `notifyAll` is invoked.
   * @param {?object} context Context to call `callback` with.
   * @internal
   */
  enqueue(callback: () => void, context: T) {
    this._callbacks = this._callbacks || [];
    this._callbacks.push(callback);
    this._contexts = this._contexts || [];
    this._contexts.push(context);
  }

  /**
   * Invokes all enqueued callbacks and clears the queue. This is invoked after
   * the DOM representation of a component has been created or updated.
   * 调用所有入队的callback,然后清除队列. 这个会在组件的dom 呈现被创建或更新后调用
   * @internal
   */
  notifyAll() {
    var callbacks = this._callbacks;
    var contexts = this._contexts;
    var arg = this._arg;
    if (callbacks && contexts) {
      invariant(
        callbacks.length === contexts.length,
        'Mismatched list of contexts in callback queue',
      );
      this._callbacks = null;
      this._contexts = null;
      for (var i = 0; i < callbacks.length; i++) {
        validateCallback(callbacks[i]);
        callbacks[i].call(contexts[i], arg); //调用
      }
      callbacks.length = 0;
      contexts.length = 0;
    }
  }

  checkpoint() {
    return this._callbacks ? this._callbacks.length : 0;
  }

  rollback(len: number) {
    if (this._callbacks && this._contexts) {
      this._callbacks.length = len;
      this._contexts.length = len;
    }
  }

  /**
   * Resets the internal queue.
   * 重置内部队列
   *
   * @internal
   */
  reset() {
    this._callbacks = null;
    this._contexts = null;
  }

  /**
   * `PooledClass` looks for this.
   */
  destructor() {
    this.reset();
  }
}

module.exports = PooledClass.addPoolingTo(CallbackQueue);
