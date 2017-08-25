/**
 * Copyright 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactNoopUpdateQueue
 */

'use strict';

var warning = require('fbjs/lib/warning');

function warnNoop(publicInstance, callerName) {
  if (__DEV__) {
    var constructor = publicInstance.constructor;
    warning(
      false,
      '%s(...): Can only update a mounted or mounting component. ' +
        'This usually means you called %s() on an unmounted component. ' +
        'This is a no-op.\n\nPlease check the code for the %s component.',
      callerName,
      callerName,
      (constructor && (constructor.displayName || constructor.name)) ||
        'ReactClass',
    );
  }
}

/**
 * This is the abstract API for an update queue.
 * 这是一个更新队列的抽象api
 */
var ReactNoopUpdateQueue = {
  /**
   * Checks whether or not this composite component is mounted.
   * 检查组件是否已经挂载
   * @param {ReactClass} publicInstance The instance we want to test.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function(publicInstance) {
    return false;
  },

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   * 强制更新，这只在我们明确知道不在dom transaction(事务)中,的时候调用
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   * 你可能会在一些组件状态(state) 深层次方面改变时候调用，但是这时候并没有调用setState
   *
   * This will not invoke `shouldComponentUpdate`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   * 这将不会调用 shouldComponentUpdate,但是会调用 componentWillUpdate和 componentDidUpdate
   *
   * @param {ReactClass} publicInstance The instance that should rerender.需要重新渲染的实例
   * @param {?function} callback Called after component is updated.
   * @param {?string} Name of the calling function in the public API.
   * @internal
   */
  enqueueForceUpdate: function(publicInstance, callback, callerName) {
    warnNoop(publicInstance, 'forceUpdate');
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} completeState Next state.
   * @param {?function} callback Called after component is updated.
   * @param {?string} Name of the calling function in the public API.
   * @internal
   */
  enqueueReplaceState: function(
    publicInstance,
    completeState,
    callback,
    callerName,
  ) {
    warnNoop(publicInstance, 'replaceState');
  },

  /**
   * Sets a subset of the state. This only exists because _pendingState is
   * internal. This provides a merging strategy that is not available to deep
   * properties which is confusing. TODO: Expose pendingState or don't use it
   * during the merge.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialState Next partial state to be merged with state.
   * @param {?function} callback Called after component is updated.
   * @param {?string} Name of the calling function in the public API.
   * @internal
   */
  enqueueSetState: function(
    publicInstance,
    partialState,
    callback,
    callerName,
  ) {
    warnNoop(publicInstance, 'setState');
  },
};

module.exports = ReactNoopUpdateQueue;
