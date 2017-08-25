/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @providesModule ReactARTFiber-prod
 */
"use strict";

var current = require("art/modes/current"), fastNoSideEffects = require("art/modes/fast-noSideEffects"), transform$1 = require("art/core/transform"), invariant = require("fbjs/lib/invariant"), emptyObject = require("fbjs/lib/emptyObject"), React = require("React");

require("prop-types/checkPropTypes");

var warning = require("fbjs/lib/warning"), shallowEqual = require("fbjs/lib/shallowEqual"), ExecutionEnvironment = require("fbjs/lib/ExecutionEnvironment"), ReactTypeOfSideEffect = {
    // Don't change these two values:
    NoEffect: 0,
    //           0b00000000
    PerformedWork: 1,
    //      0b00000001
    // You can change the rest (and add more).
    Placement: 2,
    //          0b00000010
    Update: 4,
    //             0b00000100
    PlacementAndUpdate: 6,
    // 0b00000110
    Deletion: 8,
    //           0b00001000
    ContentReset: 16,
    //      0b00010000
    Callback: 32,
    //          0b00100000
    Err: 64,
    //               0b01000000
    Ref: 128
}, ReactPriorityLevel = {
    NoWork: 0,
    // No work is pending.
    SynchronousPriority: 1,
    // For controlled text inputs. Synchronous side-effects.
    TaskPriority: 2,
    // Completes at the end of the current tick.
    HighPriority: 3,
    // Interaction that needs to complete pretty soon to feel responsive.
    LowPriority: 4,
    // Data fetching, or result from updating stores.
    OffscreenPriority: 5
}, ReactTypeOfWork = {
    IndeterminateComponent: 0,
    // Before we know whether it is functional or class
    FunctionalComponent: 1,
    ClassComponent: 2,
    HostRoot: 3,
    // Root of a host tree. Could be nested inside another node.
    HostPortal: 4,
    // A subtree. Could be an entry point to a different renderer.
    HostComponent: 5,
    HostText: 6,
    CoroutineComponent: 7,
    CoroutineHandlerPhase: 8,
    YieldComponent: 9,
    Fragment: 10
}, CallbackEffect = ReactTypeOfSideEffect.Callback, NoWork = ReactPriorityLevel.NoWork, SynchronousPriority = ReactPriorityLevel.SynchronousPriority, TaskPriority = ReactPriorityLevel.TaskPriority, ClassComponent = ReactTypeOfWork.ClassComponent, HostRoot = ReactTypeOfWork.HostRoot;

// Callbacks are not validated until invocation
// Singly linked-list of updates. When an update is scheduled, it is added to
// the queue of the current fiber and the work-in-progress fiber. The two queues
// are separate but they share a persistent structure.
//
// During reconciliation, updates are removed from the work-in-progress fiber,
// but they remain on the current fiber. That ensures that if a work-in-progress
// is aborted, the aborted updates are recovered by cloning from current.
//
// The work-in-progress queue is always a subset of the current queue.
//
// When the tree is committed, the work-in-progress becomes the current.
function comparePriority(a, b) {
    // When comparing update priorities, treat sync and Task work as equal.
    // TODO: Could we avoid the need for this by always coercing sync priority
    // to Task when scheduling an update?
    // When comparing update priorities, treat sync and Task work as equal.
    // TODO: Could we avoid the need for this by always coercing sync priority
    // to Task when scheduling an update?
    return a !== TaskPriority && a !== SynchronousPriority || b !== TaskPriority && b !== SynchronousPriority ? a === NoWork && b !== NoWork ? -255 : a !== NoWork && b === NoWork ? 255 : a - b : 0;
}

function createUpdateQueue() {
    return {
        first: null,
        last: null,
        hasForceUpdate: !1,
        callbackList: null
    };
}

function cloneUpdate(update) {
    return {
        priorityLevel: update.priorityLevel,
        partialState: update.partialState,
        callback: update.callback,
        isReplace: update.isReplace,
        isForced: update.isForced,
        isTopLevelUnmount: update.isTopLevelUnmount,
        next: null
    };
}

function insertUpdateIntoQueue(queue, update, insertAfter, insertBefore) {
    null !== insertAfter ? insertAfter.next = update : (// This is the first item in the queue.
    update.next = queue.first, queue.first = update), null !== insertBefore ? update.next = insertBefore : // This is the last item in the queue.
    queue.last = update;
}

// Returns the update after which the incoming update should be inserted into
// the queue, or null if it should be inserted at beginning.
function findInsertionPosition(queue, update) {
    var priorityLevel = update.priorityLevel, insertAfter = null, insertBefore = null;
    if (null !== queue.last && comparePriority(queue.last.priorityLevel, priorityLevel) <= 0) // Fast path for the common case where the update should be inserted at
    // the end of the queue.
    insertAfter = queue.last; else for (insertBefore = queue.first; null !== insertBefore && comparePriority(insertBefore.priorityLevel, priorityLevel) <= 0; ) insertAfter = insertBefore, 
    insertBefore = insertBefore.next;
    return insertAfter;
}

function ensureUpdateQueues(fiber) {
    var alternateFiber = fiber.alternate, queue1 = fiber.updateQueue;
    null === queue1 && (queue1 = fiber.updateQueue = createUpdateQueue());
    var queue2 = void 0;
    // TODO: Refactor to avoid returning a tuple.
    return null !== alternateFiber ? null === (queue2 = alternateFiber.updateQueue) && (queue2 = alternateFiber.updateQueue = createUpdateQueue()) : queue2 = null, 
    [ queue1, // Return null if there is no alternate queue, or if its queue is the same.
    queue2 !== queue1 ? queue2 : null ];
}

// The work-in-progress queue is a subset of the current queue (if it exists).
// We need to insert the incoming update into both lists. However, it's possible
// that the correct position in one list will be different from the position in
// the other. Consider the following case:
//
//     Current:             3-5-6
//     Work-in-progress:        6
//
// Then we receive an update with priority 4 and insert it into each list:
//
//     Current:             3-4-5-6
//     Work-in-progress:        4-6
//
// In the current queue, the new update's `next` pointer points to the update
// with priority 5. But in the work-in-progress queue, the pointer points to the
// update with priority 6. Because these two queues share the same persistent
// data structure, this won't do. (This can only happen when the incoming update
// has higher priority than all the updates in the work-in-progress queue.)
//
// To solve this, in the case where the incoming update needs to be inserted
// into two different positions, we'll make a clone of the update and insert
// each copy into a separate queue. This forks the list while maintaining a
// persistent structure, because the update that is added to the work-in-progress
// is always added to the front of the list.
//
// However, if incoming update is inserted into the same position of both lists,
// we shouldn't make a copy.
//
// If the update is cloned, it returns the cloned update.
function insertUpdate(fiber, update) {
    // We'll have at least one and at most two distinct update queues.
    var _ensureUpdateQueues = ensureUpdateQueues(fiber), queue1 = _ensureUpdateQueues[0], queue2 = _ensureUpdateQueues[1], insertAfter1 = findInsertionPosition(queue1, update), insertBefore1 = null !== insertAfter1 ? insertAfter1.next : queue1.first;
    if (null === queue2) // If there's no alternate queue, there's nothing else to do but insert.
    return insertUpdateIntoQueue(queue1, update, insertAfter1, insertBefore1), null;
    // If there is an alternate queue, find the insertion position.
    var insertAfter2 = findInsertionPosition(queue2, update), insertBefore2 = null !== insertAfter2 ? insertAfter2.next : queue2.first;
    // See if the insertion positions are equal. Be careful to only compare
    // non-null values.
    if (// Now we can insert into the first queue. This must come after finding both
    // insertion positions because it mutates the list.
    insertUpdateIntoQueue(queue1, update, insertAfter1, insertBefore1), insertBefore1 === insertBefore2 && null !== insertBefore1 || insertAfter1 === insertAfter2 && null !== insertAfter1) // The insertion positions are the same, so when we inserted into the first
    // queue, it also inserted into the alternate. All we need to do is update
    // the alternate queue's `first` and `last` pointers, in case they
    // have changed.
    return null === insertAfter2 && (queue2.first = update), null === insertBefore2 && (queue2.last = null), 
    null;
    // The insertion positions are different, so we need to clone the update and
    // insert the clone into the alternate queue.
    var update2 = cloneUpdate(update);
    return insertUpdateIntoQueue(queue2, update2, insertAfter2, insertBefore2), update2;
}

function addUpdate(fiber, partialState, callback, priorityLevel) {
    insertUpdate(fiber, {
        priorityLevel: priorityLevel,
        partialState: partialState,
        callback: callback,
        isReplace: !1,
        isForced: !1,
        isTopLevelUnmount: !1,
        next: null
    });
}

var addUpdate_1 = addUpdate;

function addReplaceUpdate(fiber, state, callback, priorityLevel) {
    insertUpdate(fiber, {
        priorityLevel: priorityLevel,
        partialState: state,
        callback: callback,
        isReplace: !0,
        isForced: !1,
        isTopLevelUnmount: !1,
        next: null
    });
}

var addReplaceUpdate_1 = addReplaceUpdate;

function addForceUpdate(fiber, callback, priorityLevel) {
    insertUpdate(fiber, {
        priorityLevel: priorityLevel,
        partialState: null,
        callback: callback,
        isReplace: !1,
        isForced: !0,
        isTopLevelUnmount: !1,
        next: null
    });
}

var addForceUpdate_1 = addForceUpdate;

function getUpdatePriority(fiber) {
    var updateQueue = fiber.updateQueue;
    return null === updateQueue ? NoWork : fiber.tag !== ClassComponent && fiber.tag !== HostRoot ? NoWork : null !== updateQueue.first ? updateQueue.first.priorityLevel : NoWork;
}

var getUpdatePriority_1 = getUpdatePriority;

function addTopLevelUpdate$1(fiber, partialState, callback, priorityLevel) {
    var isTopLevelUnmount = null === partialState.element, update = {
        priorityLevel: priorityLevel,
        partialState: partialState,
        callback: callback,
        isReplace: !1,
        isForced: !1,
        isTopLevelUnmount: isTopLevelUnmount,
        next: null
    }, update2 = insertUpdate(fiber, update);
    if (isTopLevelUnmount) {
        // TODO: Redesign the top-level mount/update/unmount API to avoid this
        var _ensureUpdateQueues2 = ensureUpdateQueues(fiber), queue1 = _ensureUpdateQueues2[0], queue2 = _ensureUpdateQueues2[1];
        // Drop all updates that are lower-priority, so that the tree is not
        // remounted. We need to do this for both queues.
        null !== queue1 && null !== update.next && (update.next = null, queue1.last = update), 
        null !== queue2 && null !== update2 && null !== update2.next && (update2.next = null, 
        queue2.last = update);
    }
}

var addTopLevelUpdate_1 = addTopLevelUpdate$1;

function getStateFromUpdate(update, instance, prevState, props) {
    var partialState = update.partialState;
    if ("function" == typeof partialState) {
        return partialState.call(instance, prevState, props);
    }
    return partialState;
}

function beginUpdateQueue(current$$1, workInProgress, queue, instance, prevState, props, priorityLevel) {
    if (null !== current$$1 && current$$1.updateQueue === queue) {
        // We need to create a work-in-progress queue, by cloning the current queue.
        var currentQueue = queue;
        queue = workInProgress.updateQueue = {
            first: currentQueue.first,
            last: currentQueue.last,
            // These fields are no longer valid because they were already committed.
            // Reset them.
            callbackList: null,
            hasForceUpdate: !1
        };
    }
    for (var callbackList = queue.callbackList, hasForceUpdate = queue.hasForceUpdate, state = prevState, dontMutatePrevState = !0, update = queue.first; null !== update && comparePriority(update.priorityLevel, priorityLevel) <= 0; ) {
        // Remove each update from the queue right before it is processed. That way
        // if setState is called from inside an updater function, the new update
        // will be inserted in the correct position.
        queue.first = update.next, null === queue.first && (queue.last = null);
        var _partialState = void 0;
        update.isReplace ? (state = getStateFromUpdate(update, instance, state, props), 
        dontMutatePrevState = !0) : (_partialState = getStateFromUpdate(update, instance, state, props)) && (state = dontMutatePrevState ? Object.assign({}, state, _partialState) : Object.assign(state, _partialState), 
        dontMutatePrevState = !1), update.isForced && (hasForceUpdate = !0), // Second condition ignores top-level unmount callbacks if they are not the
        // last update in the queue, since a subsequent update will cause a remount.
        null === update.callback || update.isTopLevelUnmount && null !== update.next || (callbackList = null !== callbackList ? callbackList : [], 
        callbackList.push(update.callback), workInProgress.effectTag |= CallbackEffect), 
        update = update.next;
    }
    // The queue is empty and there are no callbacks. We can reset it.
    return queue.callbackList = callbackList, queue.hasForceUpdate = hasForceUpdate, 
    null !== queue.first || null !== callbackList || hasForceUpdate || (workInProgress.updateQueue = null), 
    state;
}

var beginUpdateQueue_1 = beginUpdateQueue;

function commitCallbacks(finishedWork, queue, context) {
    var callbackList = queue.callbackList;
    if (null !== callbackList) {
        // Set the list to null to make sure they don't get called more than once.
        queue.callbackList = null;
        for (var i = 0; i < callbackList.length; i++) {
            var _callback = callbackList[i];
            invariant("function" == typeof _callback, "Invalid argument passed as callback. Expected a function. Instead " + "received: %s", _callback), 
            _callback.call(context);
        }
    }
}

var commitCallbacks_1 = commitCallbacks, ReactFiberUpdateQueue = {
    addUpdate: addUpdate_1,
    addReplaceUpdate: addReplaceUpdate_1,
    addForceUpdate: addForceUpdate_1,
    getUpdatePriority: getUpdatePriority_1,
    addTopLevelUpdate: addTopLevelUpdate_1,
    beginUpdateQueue: beginUpdateQueue_1,
    commitCallbacks: commitCallbacks_1
};

/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getComponentName
 * 
 */
function getComponentName$1(instanceOrFiber) {
    if ("function" == typeof instanceOrFiber.getName) {
        return instanceOrFiber.getName();
    }
    if ("number" == typeof instanceOrFiber.tag) {
        // Fiber reconciler
        var fiber = instanceOrFiber, type = fiber.type;
        if ("string" == typeof type) return type;
        if ("function" == typeof type) return type.displayName || type.name;
    }
    return null;
}

var getComponentName_1 = getComponentName$1, ReactInstanceMap = {
    /**
   * This API should be called `delete` but we'd have to make sure to always
   * transform these to strings for IE support. When this transform is fully
   * supported we can rename it.
   */
    remove: function(key) {
        key._reactInternalInstance = void 0;
    },
    get: function(key) {
        return key._reactInternalInstance;
    },
    has: function(key) {
        return void 0 !== key._reactInternalInstance;
    },
    set: function(key, value) {
        key._reactInternalInstance = value;
    }
}, ReactInstanceMap_1 = ReactInstanceMap, ReactInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, ReactGlobalSharedState = {
    ReactCurrentOwner: ReactInternals.ReactCurrentOwner
}, ReactGlobalSharedState_1 = ReactGlobalSharedState, HostRoot$2 = ReactTypeOfWork.HostRoot, HostComponent$1 = ReactTypeOfWork.HostComponent, HostText = ReactTypeOfWork.HostText, NoEffect = ReactTypeOfSideEffect.NoEffect, Placement = ReactTypeOfSideEffect.Placement, MOUNTING = 1, MOUNTED = 2, UNMOUNTED = 3;

function isFiberMountedImpl(fiber) {
    var node = fiber;
    if (fiber.alternate) for (;node.return; ) node = node.return; else {
        // If there is no alternate, this might be a new tree that isn't inserted
        // yet. If it is, then it will have a pending insertion effect on it.
        if ((node.effectTag & Placement) !== NoEffect) return MOUNTING;
        for (;node.return; ) if (node = node.return, (node.effectTag & Placement) !== NoEffect) return MOUNTING;
    }
    return node.tag === HostRoot$2 ? MOUNTED : UNMOUNTED;
}

var isFiberMounted$1 = function(fiber) {
    return isFiberMountedImpl(fiber) === MOUNTED;
}, isMounted = function(component) {
    var fiber = ReactInstanceMap_1.get(component);
    return !!fiber && isFiberMountedImpl(fiber) === MOUNTED;
};

function assertIsMounted(fiber) {
    invariant(isFiberMountedImpl(fiber) === MOUNTED, "Unable to find node on an unmounted component.");
}

function findCurrentFiberUsingSlowPath(fiber) {
    var alternate = fiber.alternate;
    if (!alternate) {
        // If there is no alternate, then we only need to check if it is mounted.
        var state = isFiberMountedImpl(fiber);
        return invariant(state !== UNMOUNTED, "Unable to find node on an unmounted component."), 
        state === MOUNTING ? null : fiber;
    }
    for (// If we have two possible branches, we'll walk backwards up to the root
    // to see what path the root points to. On the way we may hit one of the
    // special cases and we'll deal with them.
    var a = fiber, b = alternate; !0; ) {
        var parentA = a.return, parentB = parentA ? parentA.alternate : null;
        if (!parentA || !parentB) // We're at the root.
        break;
        // If both copies of the parent fiber point to the same child, we can
        // assume that the child is current. This happens when we bailout on low
        // priority: the bailed out fiber's child reuses the current child.
        if (parentA.child === parentB.child) {
            for (var child = parentA.child; child; ) {
                if (child === a) // We've determined that A is the current branch.
                return assertIsMounted(parentA), fiber;
                if (child === b) // We've determined that B is the current branch.
                return assertIsMounted(parentA), alternate;
                child = child.sibling;
            }
            // We should never have an alternate for any mounting node. So the only
            // way this could possibly happen is if this was unmounted, if at all.
            invariant(!1, "Unable to find node on an unmounted component.");
        }
        if (a.return !== b.return) // The return pointer of A and the return pointer of B point to different
        // fibers. We assume that return pointers never criss-cross, so A must
        // belong to the child set of A.return, and B must belong to the child
        // set of B.return.
        a = parentA, b = parentB; else {
            for (// The return pointers point to the same fiber. We'll have to use the
            // default, slow path: scan the child sets of each parent alternate to see
            // which child belongs to which set.
            //
            // Search parent A's child set
            var didFindChild = !1, _child = parentA.child; _child; ) {
                if (_child === a) {
                    didFindChild = !0, a = parentA, b = parentB;
                    break;
                }
                if (_child === b) {
                    didFindChild = !0, b = parentA, a = parentB;
                    break;
                }
                _child = _child.sibling;
            }
            if (!didFindChild) {
                for (// Search parent B's child set
                _child = parentB.child; _child; ) {
                    if (_child === a) {
                        didFindChild = !0, a = parentB, b = parentA;
                        break;
                    }
                    if (_child === b) {
                        didFindChild = !0, b = parentB, a = parentA;
                        break;
                    }
                    _child = _child.sibling;
                }
                invariant(didFindChild, "Child was not found in either parent set. This indicates a bug " + "related to the return pointer.");
            }
        }
        invariant(a.alternate === b, "Return fibers should always be each others' alternates.");
    }
    // If the root is not a host container, we're in a disconnected tree. I.e.
    // unmounted.
    return invariant(a.tag === HostRoot$2, "Unable to find node on an unmounted component."), 
    a.stateNode.current === a ? fiber : alternate;
}

var findCurrentFiberUsingSlowPath_1 = findCurrentFiberUsingSlowPath, findCurrentHostFiber$1 = function(parent) {
    var currentParent = findCurrentFiberUsingSlowPath(parent);
    if (!currentParent) return null;
    for (// Next we'll drill down this component to find the first HostComponent/Text.
    var node = currentParent; !0; ) {
        if (node.tag === HostComponent$1 || node.tag === HostText) return node;
        if (node.child) // TODO: If we hit a Portal, we're supposed to skip it.
        node.child.return = node, node = node.child; else {
            if (node === currentParent) return null;
            for (;!node.sibling; ) {
                if (!node.return || node.return === currentParent) return null;
                node = node.return;
            }
            node.sibling.return = node.return, node = node.sibling;
        }
    }
    // Flow needs the return null here, but ESLint complains about it.
    // eslint-disable-next-line no-unreachable
    return null;
}, ReactFiberTreeReflection = {
    isFiberMounted: isFiberMounted$1,
    isMounted: isMounted,
    findCurrentFiberUsingSlowPath: findCurrentFiberUsingSlowPath_1,
    findCurrentHostFiber: findCurrentHostFiber$1
}, valueStack = [], index = -1, createCursor$1 = function(defaultValue) {
    return {
        current: defaultValue
    };
}, isEmpty = function() {
    return -1 === index;
}, pop$1 = function(cursor, fiber) {
    index < 0 || (cursor.current = valueStack[index], valueStack[index] = null, index--);
}, push$1 = function(cursor, value, fiber) {
    index++, valueStack[index] = cursor.current, cursor.current = value;
}, reset = function() {
    for (;index > -1; ) valueStack[index] = null, index--;
}, ReactFiberStack = {
    createCursor: createCursor$1,
    isEmpty: isEmpty,
    pop: pop$1,
    push: push$1,
    reset: reset
}, _extends$1 = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) Object.prototype.hasOwnProperty.call(source, key) && (target[key] = source[key]);
    }
    return target;
}, isFiberMounted = ReactFiberTreeReflection.isFiberMounted, ClassComponent$1 = ReactTypeOfWork.ClassComponent, HostRoot$1 = ReactTypeOfWork.HostRoot, createCursor = ReactFiberStack.createCursor, pop = ReactFiberStack.pop, push = ReactFiberStack.push, contextStackCursor = createCursor(emptyObject), didPerformWorkStackCursor = createCursor(!1), previousContext = emptyObject;

function getUnmaskedContext(workInProgress) {
    return isContextProvider$1(workInProgress) ? previousContext : contextStackCursor.current;
}

var getUnmaskedContext_1 = getUnmaskedContext;

function cacheContext(workInProgress, unmaskedContext, maskedContext) {
    var instance = workInProgress.stateNode;
    instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext, instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
}

var cacheContext_1 = cacheContext, getMaskedContext = function(workInProgress, unmaskedContext) {
    var type = workInProgress.type, contextTypes = type.contextTypes;
    if (!contextTypes) return emptyObject;
    // Avoid recreating masked context unless unmasked context has changed.
    // Failing to do this will result in unnecessary calls to componentWillReceiveProps.
    // This may trigger infinite loops if componentWillReceiveProps calls setState.
    var instance = workInProgress.stateNode;
    if (instance && instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext) return instance.__reactInternalMemoizedMaskedChildContext;
    var context = {};
    for (var key in contextTypes) context[key] = unmaskedContext[key];
    return instance && cacheContext(workInProgress, unmaskedContext, context), context;
}, hasContextChanged = function() {
    return didPerformWorkStackCursor.current;
};

function isContextConsumer(fiber) {
    return fiber.tag === ClassComponent$1 && null != fiber.type.contextTypes;
}

var isContextConsumer_1 = isContextConsumer;

function isContextProvider$1(fiber) {
    return fiber.tag === ClassComponent$1 && null != fiber.type.childContextTypes;
}

var isContextProvider_1 = isContextProvider$1;

function popContextProvider(fiber) {
    isContextProvider$1(fiber) && (pop(didPerformWorkStackCursor, fiber), pop(contextStackCursor, fiber));
}

var popContextProvider_1 = popContextProvider, pushTopLevelContextObject = function(fiber, context, didChange) {
    invariant(null == contextStackCursor.cursor, "Unexpected context found on stack"), 
    push(contextStackCursor, context, fiber), push(didPerformWorkStackCursor, didChange, fiber);
};

function processChildContext$1(fiber, parentContext, isReconciling) {
    var instance = fiber.stateNode, childContextTypes = fiber.type.childContextTypes;
    // TODO (bvaughn) Replace this behavior with an invariant() in the future.
    // It has only been added in Fiber to match the (unintentional) behavior in Stack.
    if ("function" != typeof instance.getChildContext) return parentContext;
    var childContext = void 0;
    childContext = instance.getChildContext();
    for (var contextKey in childContext) invariant(contextKey in childContextTypes, '%s.getChildContext(): key "%s" is not defined in childContextTypes.', getComponentName_1(fiber) || "Unknown", contextKey);
    return _extends$1({}, parentContext, childContext);
}

var processChildContext_1 = processChildContext$1, pushContextProvider = function(workInProgress) {
    if (!isContextProvider$1(workInProgress)) return !1;
    var instance = workInProgress.stateNode, memoizedMergedChildContext = instance && instance.__reactInternalMemoizedMergedChildContext || emptyObject;
    // Remember the parent context so we can merge with it later.
    return previousContext = contextStackCursor.current, push(contextStackCursor, memoizedMergedChildContext, workInProgress), 
    push(didPerformWorkStackCursor, !1, workInProgress), !0;
}, invalidateContextProvider = function(workInProgress) {
    var instance = workInProgress.stateNode;
    invariant(instance, "Expected to have an instance by this point.");
    // Merge parent and own context.
    var mergedContext = processChildContext$1(workInProgress, previousContext, !0);
    instance.__reactInternalMemoizedMergedChildContext = mergedContext, // Replace the old (or empty) context with the new one.
    // It is important to unwind the context in the reverse order.
    pop(didPerformWorkStackCursor, workInProgress), pop(contextStackCursor, workInProgress), 
    // Now push the new context and mark that it has changed.
    push(contextStackCursor, mergedContext, workInProgress), push(didPerformWorkStackCursor, !0, workInProgress);
}, resetContext = function() {
    previousContext = emptyObject, contextStackCursor.current = emptyObject, didPerformWorkStackCursor.current = !1;
}, findCurrentUnmaskedContext$1 = function(fiber) {
    // Currently this is only used with renderSubtreeIntoContainer; not sure if it
    // makes sense elsewhere
    invariant(isFiberMounted(fiber) && fiber.tag === ClassComponent$1, "Expected subtree parent to be a mounted class component");
    for (var node = fiber; node.tag !== HostRoot$1; ) {
        if (isContextProvider$1(node)) return node.stateNode.__reactInternalMemoizedMergedChildContext;
        var parent = node.return;
        invariant(parent, "Found unexpected detached subtree parent"), node = parent;
    }
    return node.stateNode.context;
}, ReactFiberContext = {
    getUnmaskedContext: getUnmaskedContext_1,
    cacheContext: cacheContext_1,
    getMaskedContext: getMaskedContext,
    hasContextChanged: hasContextChanged,
    isContextConsumer: isContextConsumer_1,
    isContextProvider: isContextProvider_1,
    popContextProvider: popContextProvider_1,
    pushTopLevelContextObject: pushTopLevelContextObject,
    processChildContext: processChildContext_1,
    pushContextProvider: pushContextProvider,
    invalidateContextProvider: invalidateContextProvider,
    resetContext: resetContext,
    findCurrentUnmaskedContext: findCurrentUnmaskedContext$1
}, ReactTypeOfInternalContext = {
    NoContext: 0,
    AsyncUpdates: 1
}, IndeterminateComponent = ReactTypeOfWork.IndeterminateComponent, ClassComponent$3 = ReactTypeOfWork.ClassComponent, HostRoot$3 = ReactTypeOfWork.HostRoot, HostComponent$2 = ReactTypeOfWork.HostComponent, HostText$1 = ReactTypeOfWork.HostText, HostPortal = ReactTypeOfWork.HostPortal, CoroutineComponent = ReactTypeOfWork.CoroutineComponent, YieldComponent = ReactTypeOfWork.YieldComponent, Fragment = ReactTypeOfWork.Fragment, NoWork$1 = ReactPriorityLevel.NoWork, NoContext = ReactTypeOfInternalContext.NoContext, NoEffect$1 = ReactTypeOfSideEffect.NoEffect, createFiber = function(tag, key, internalContextTag) {
    return {
        // Instance
        tag: tag,
        key: key,
        type: null,
        stateNode: null,
        // Fiber
        return: null,
        child: null,
        sibling: null,
        index: 0,
        ref: null,
        pendingProps: null,
        memoizedProps: null,
        updateQueue: null,
        memoizedState: null,
        internalContextTag: internalContextTag,
        effectTag: NoEffect$1,
        nextEffect: null,
        firstEffect: null,
        lastEffect: null,
        pendingWorkPriority: NoWork$1,
        alternate: null
    };
};

function shouldConstruct(Component) {
    return !(!Component.prototype || !Component.prototype.isReactComponent);
}

// This is used to create an alternate fiber to do work on.
var createWorkInProgress = function(current$$1, renderPriority) {
    var workInProgress = current$$1.alternate;
    // We use a double buffering pooling technique because we know that we'll
    // only ever need at most two versions of a tree. We pool the "other" unused
    // node that we're free to reuse. This is lazily created to avoid allocating
    // extra objects for things that are never updated. It also allow us to
    // reclaim the extra memory if needed.
    // We already have an alternate.
    // Reset the effect tag.
    // The effect list is no longer valid.
    // pendingProps is set by the parent during reconciliation.
    // TODO: Pass this as an argument.
    // These will be overridden during the parent's reconciliation
    return null === workInProgress ? (workInProgress = createFiber(current$$1.tag, current$$1.key, current$$1.internalContextTag), 
    workInProgress.type = current$$1.type, workInProgress.stateNode = current$$1.stateNode, 
    workInProgress.alternate = current$$1, current$$1.alternate = workInProgress) : (workInProgress.effectTag = NoWork$1, 
    workInProgress.nextEffect = null, workInProgress.firstEffect = null, workInProgress.lastEffect = null), 
    workInProgress.pendingWorkPriority = renderPriority, workInProgress.child = current$$1.child, 
    workInProgress.memoizedProps = current$$1.memoizedProps, workInProgress.memoizedState = current$$1.memoizedState, 
    workInProgress.updateQueue = current$$1.updateQueue, workInProgress.sibling = current$$1.sibling, 
    workInProgress.index = current$$1.index, workInProgress.ref = current$$1.ref, workInProgress;
}, createHostRootFiber$1 = function() {
    return createFiber(HostRoot$3, null, NoContext);
}, createFiberFromElement = function(element, internalContextTag, priorityLevel) {
    var owner = null, fiber = createFiberFromElementType(element.type, element.key, internalContextTag, owner);
    return fiber.pendingProps = element.props, fiber.pendingWorkPriority = priorityLevel, 
    fiber;
}, createFiberFromFragment = function(elements, internalContextTag, priorityLevel) {
    // TODO: Consider supporting keyed fragments. Technically, we accidentally
    // support that in the existing React.
    var fiber = createFiber(Fragment, null, internalContextTag);
    return fiber.pendingProps = elements, fiber.pendingWorkPriority = priorityLevel, 
    fiber;
}, createFiberFromText = function(content, internalContextTag, priorityLevel) {
    var fiber = createFiber(HostText$1, null, internalContextTag);
    return fiber.pendingProps = content, fiber.pendingWorkPriority = priorityLevel, 
    fiber;
};

function createFiberFromElementType(type, key, internalContextTag, debugOwner) {
    var fiber = void 0;
    if ("function" == typeof type) fiber = shouldConstruct(type) ? createFiber(ClassComponent$3, key, internalContextTag) : createFiber(IndeterminateComponent, key, internalContextTag), 
    fiber.type = type; else if ("string" == typeof type) fiber = createFiber(HostComponent$2, key, internalContextTag), 
    fiber.type = type; else if ("object" == typeof type && null !== type && "number" == typeof type.tag) // Currently assumed to be a continuation and therefore is a fiber already.
    // TODO: The yield system is currently broken for updates in some cases.
    // The reified yield stores a fiber, but we don't know which fiber that is;
    // the current or a workInProgress? When the continuation gets rendered here
    // we don't know if we can reuse that fiber or if we need to clone it.
    // There is probably a clever way to restructure this.
    fiber = type; else {
        var info = "";
        invariant(!1, "Element type is invalid: expected a string (for built-in components) " + "or a class/function (for composite components) but got: %s.%s", null == type ? type : typeof type, info);
    }
    return fiber;
}

var createFiberFromElementType_1 = createFiberFromElementType, createFiberFromHostInstanceForDeletion = function() {
    var fiber = createFiber(HostComponent$2, null, NoContext);
    return fiber.type = "DELETED", fiber;
}, createFiberFromCoroutine = function(coroutine, internalContextTag, priorityLevel) {
    var fiber = createFiber(CoroutineComponent, coroutine.key, internalContextTag);
    return fiber.type = coroutine.handler, fiber.pendingProps = coroutine, fiber.pendingWorkPriority = priorityLevel, 
    fiber;
}, createFiberFromYield = function(yieldNode, internalContextTag, priorityLevel) {
    return createFiber(YieldComponent, null, internalContextTag);
}, createFiberFromPortal = function(portal, internalContextTag, priorityLevel) {
    var fiber = createFiber(HostPortal, portal.key, internalContextTag);
    return fiber.pendingProps = portal.children || [], fiber.pendingWorkPriority = priorityLevel, 
    fiber.stateNode = {
        containerInfo: portal.containerInfo,
        implementation: portal.implementation
    }, fiber;
}, largerPriority = function(p1, p2) {
    return p1 !== NoWork$1 && (p2 === NoWork$1 || p2 > p1) ? p1 : p2;
}, ReactFiber = {
    createWorkInProgress: createWorkInProgress,
    createHostRootFiber: createHostRootFiber$1,
    createFiberFromElement: createFiberFromElement,
    createFiberFromFragment: createFiberFromFragment,
    createFiberFromText: createFiberFromText,
    createFiberFromElementType: createFiberFromElementType_1,
    createFiberFromHostInstanceForDeletion: createFiberFromHostInstanceForDeletion,
    createFiberFromCoroutine: createFiberFromCoroutine,
    createFiberFromYield: createFiberFromYield,
    createFiberFromPortal: createFiberFromPortal,
    largerPriority: largerPriority
}, createHostRootFiber = ReactFiber.createHostRootFiber, createFiberRoot$1 = function(containerInfo) {
    // Cyclic construction. This cheats the type system right now because
    // stateNode is any.
    var uninitializedFiber = createHostRootFiber(), root = {
        current: uninitializedFiber,
        containerInfo: containerInfo,
        isScheduled: !1,
        nextScheduledRoot: null,
        context: null,
        pendingContext: null
    };
    return uninitializedFiber.stateNode = root, root;
}, ReactFiberRoot = {
    createFiberRoot: createFiberRoot$1
}, IndeterminateComponent$1 = ReactTypeOfWork.IndeterminateComponent, FunctionalComponent = ReactTypeOfWork.FunctionalComponent, ClassComponent$5 = ReactTypeOfWork.ClassComponent, HostComponent$4 = ReactTypeOfWork.HostComponent;

function describeComponentFrame(name, source, ownerName) {
    return "\n    in " + (name || "Unknown") + (source ? " (at " + source.fileName.replace(/^.*[\\\/]/, "") + ":" + source.lineNumber + ")" : ownerName ? " (created by " + ownerName + ")" : "");
}

function describeFiber(fiber) {
    switch (fiber.tag) {
      case IndeterminateComponent$1:
      case FunctionalComponent:
      case ClassComponent$5:
      case HostComponent$4:
        var owner = fiber._debugOwner, source = fiber._debugSource, name = getComponentName_1(fiber), ownerName = null;
        return owner && (ownerName = getComponentName_1(owner)), describeComponentFrame(name, source, ownerName);

      default:
        return "";
    }
}

// This function can only be called with a work-in-progress fiber and
// only during begin or complete phase. Do not call it under any other
// circumstances.
function getStackAddendumByWorkInProgressFiber$1(workInProgress) {
    var info = "", node = workInProgress;
    do {
        info += describeFiber(node), // Otherwise this return pointer might point to the wrong tree:
        node = node.return;
    } while (node);
    return info;
}

var ReactFiberComponentTreeHook = {
    getStackAddendumByWorkInProgressFiber: getStackAddendumByWorkInProgressFiber$1,
    describeComponentFrame: describeComponentFrame
}, defaultShowDialog = function(capturedError) {
    return !0;
}, showDialog = defaultShowDialog;

function logCapturedError$1(capturedError) {
    // Allow injected showDialog() to prevent default console.error logging.
    // This enables renderers like ReactNative to better manage redbox behavior.
    if (!1 !== showDialog(capturedError)) {
        var _error = capturedError.error;
        console.error("React caught an error thrown by one of your components.\n\n" + _error.stack);
    }
}

var injection = {
    /**
   * Display custom dialog for lifecycle errors.
   * Return false to prevent default behavior of logging to console.error.
   */
    injectDialog: function(fn) {
        invariant(showDialog === defaultShowDialog, "The custom dialog was already injected."), 
        invariant("function" == typeof fn, "Injected showDialog() must be a function."), 
        showDialog = fn;
    }
}, logCapturedError_1 = logCapturedError$1, ReactFiberErrorLogger = {
    injection: injection,
    logCapturedError: logCapturedError_1
}, REACT_COROUTINE_TYPE$1, REACT_YIELD_TYPE$1;

"function" == typeof Symbol && Symbol.for ? (REACT_COROUTINE_TYPE$1 = Symbol.for("react.coroutine"), 
REACT_YIELD_TYPE$1 = Symbol.for("react.yield")) : (REACT_COROUTINE_TYPE$1 = 60104, 
REACT_YIELD_TYPE$1 = 60105);

var createCoroutine = function(children, handler, props) {
    var key = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : null;
    return {
        // This tag allow us to uniquely identify this as a React Coroutine
        $$typeof: REACT_COROUTINE_TYPE$1,
        key: null == key ? null : "" + key,
        children: children,
        handler: handler,
        props: props
    };
}, createYield = function(value) {
    return {
        // This tag allow us to uniquely identify this as a React Yield
        $$typeof: REACT_YIELD_TYPE$1,
        value: value
    };
}, isCoroutine = function(object) {
    return "object" == typeof object && null !== object && object.$$typeof === REACT_COROUTINE_TYPE$1;
}, isYield = function(object) {
    return "object" == typeof object && null !== object && object.$$typeof === REACT_YIELD_TYPE$1;
}, REACT_YIELD_TYPE_1 = REACT_YIELD_TYPE$1, REACT_COROUTINE_TYPE_1 = REACT_COROUTINE_TYPE$1, ReactCoroutine = {
    createCoroutine: createCoroutine,
    createYield: createYield,
    isCoroutine: isCoroutine,
    isYield: isYield,
    REACT_YIELD_TYPE: REACT_YIELD_TYPE_1,
    REACT_COROUTINE_TYPE: REACT_COROUTINE_TYPE_1
}, REACT_PORTAL_TYPE$1 = "function" == typeof Symbol && Symbol.for && Symbol.for("react.portal") || 60106, createPortal = function(children, containerInfo, // TODO: figure out the API for cross-renderer implementation.
implementation) {
    var key = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : null;
    return {
        // This tag allow us to uniquely identify this as a React Portal
        $$typeof: REACT_PORTAL_TYPE$1,
        key: null == key ? null : "" + key,
        children: children,
        containerInfo: containerInfo,
        implementation: implementation
    };
}, isPortal = function(object) {
    return "object" == typeof object && null !== object && object.$$typeof === REACT_PORTAL_TYPE$1;
}, REACT_PORTAL_TYPE_1 = REACT_PORTAL_TYPE$1, ReactPortal = {
    createPortal: createPortal,
    isPortal: isPortal,
    REACT_PORTAL_TYPE: REACT_PORTAL_TYPE_1
}, REACT_COROUTINE_TYPE = ReactCoroutine.REACT_COROUTINE_TYPE, REACT_YIELD_TYPE = ReactCoroutine.REACT_YIELD_TYPE, REACT_PORTAL_TYPE = ReactPortal.REACT_PORTAL_TYPE, ReactFeatureFlags$1 = require("ReactFeatureFlags"), createWorkInProgress$2 = ReactFiber.createWorkInProgress, createFiberFromElement$1 = ReactFiber.createFiberFromElement, createFiberFromFragment$1 = ReactFiber.createFiberFromFragment, createFiberFromText$1 = ReactFiber.createFiberFromText, createFiberFromCoroutine$1 = ReactFiber.createFiberFromCoroutine, createFiberFromYield$1 = ReactFiber.createFiberFromYield, createFiberFromPortal$1 = ReactFiber.createFiberFromPortal, isArray = Array.isArray, FunctionalComponent$2 = ReactTypeOfWork.FunctionalComponent, ClassComponent$7 = ReactTypeOfWork.ClassComponent, HostText$3 = ReactTypeOfWork.HostText, HostPortal$3 = ReactTypeOfWork.HostPortal, CoroutineComponent$2 = ReactTypeOfWork.CoroutineComponent, YieldComponent$2 = ReactTypeOfWork.YieldComponent, Fragment$2 = ReactTypeOfWork.Fragment, NoEffect$2 = ReactTypeOfSideEffect.NoEffect, Placement$3 = ReactTypeOfSideEffect.Placement, Deletion$1 = ReactTypeOfSideEffect.Deletion, ITERATOR_SYMBOL = "function" == typeof Symbol && Symbol.iterator, FAUX_ITERATOR_SYMBOL = "@@iterator", REACT_ELEMENT_TYPE = "function" == typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103;

function getIteratorFn(maybeIterable) {
    if (null === maybeIterable || void 0 === maybeIterable) return null;
    var iteratorFn = ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
    return "function" == typeof iteratorFn ? iteratorFn : null;
}

function coerceRef(current$$1, element) {
    var mixedRef = element.ref;
    if (null !== mixedRef && "function" != typeof mixedRef && element._owner) {
        var owner = element._owner, inst = void 0;
        if (owner) if ("number" == typeof owner.tag) {
            var ownerFiber = owner;
            invariant(ownerFiber.tag === ClassComponent$7, "Stateless function components cannot have refs."), 
            inst = ownerFiber.stateNode;
        } else // Stack
        inst = owner.getPublicInstance();
        invariant(inst, "Missing owner for string ref %s. This error is likely caused by a " + "bug in React. Please file an issue.", mixedRef);
        var stringRef = "" + mixedRef;
        // Check if previous string ref matches new string ref
        if (null !== current$$1 && null !== current$$1.ref && current$$1.ref._stringRef === stringRef) return current$$1.ref;
        var ref = function(value) {
            var refs = inst.refs === emptyObject ? inst.refs = {} : inst.refs;
            null === value ? delete refs[stringRef] : refs[stringRef] = value;
        };
        return ref._stringRef = stringRef, ref;
    }
    return mixedRef;
}

function throwOnInvalidObjectType(returnFiber, newChild) {
    if ("textarea" !== returnFiber.type) {
        invariant(!1, "Objects are not valid as a React child (found: %s).%s", "[object Object]" === Object.prototype.toString.call(newChild) ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : newChild, "");
    }
}

// This wrapper function exists because I expect to clone the code in each path
// to be able to optimize each path individually by branching early. This needs
// a compiler or we can do it manually. Helpers that don't need this branching
// live outside of this function.
function ChildReconciler(shouldClone, shouldTrackSideEffects) {
    function deleteChild(returnFiber, childToDelete) {
        if (shouldTrackSideEffects) {
            if (!shouldClone) {
                // When we're reconciling in place we have a work in progress copy. We
                // actually want the current copy. If there is no current copy, then we
                // don't need to track deletion side-effects.
                if (null === childToDelete.alternate) return;
                childToDelete = childToDelete.alternate;
            }
            // Deletions are added in reversed order so we add it to the front.
            // At this point, the return fiber's effect list is empty except for
            // deletions, so we can just append the deletion to the list. The remaining
            // effects aren't added until the complete phase. Once we implement
            // resuming, this may not be true.
            var last = returnFiber.lastEffect;
            null !== last ? (last.nextEffect = childToDelete, returnFiber.lastEffect = childToDelete) : returnFiber.firstEffect = returnFiber.lastEffect = childToDelete, 
            childToDelete.nextEffect = null, childToDelete.effectTag = Deletion$1;
        }
    }
    function deleteRemainingChildren(returnFiber, currentFirstChild) {
        if (!shouldTrackSideEffects) // Noop.
        return null;
        for (// TODO: For the shouldClone case, this could be micro-optimized a bit by
        // assuming that after the first child we've already added everything.
        var childToDelete = currentFirstChild; null !== childToDelete; ) deleteChild(returnFiber, childToDelete), 
        childToDelete = childToDelete.sibling;
        return null;
    }
    function mapRemainingChildren(returnFiber, currentFirstChild) {
        for (// Add the remaining children to a temporary map so that we can find them by
        // keys quickly. Implicit (null) keys get added to this set with their index
        var existingChildren = new Map(), existingChild = currentFirstChild; null !== existingChild; ) null !== existingChild.key ? existingChildren.set(existingChild.key, existingChild) : existingChildren.set(existingChild.index, existingChild), 
        existingChild = existingChild.sibling;
        return existingChildren;
    }
    function useFiber(fiber, priority) {
        // We currently set sibling to null and index to 0 here because it is easy
        // to forget to do before returning it. E.g. for the single child case.
        if (shouldClone) {
            var clone = createWorkInProgress$2(fiber, priority);
            return clone.index = 0, clone.sibling = null, clone;
        }
        // We override the pending priority even if it is higher, because if
        // we're reconciling at a lower priority that means that this was
        // down-prioritized.
        return fiber.pendingWorkPriority = priority, fiber.effectTag = NoEffect$2, fiber.index = 0, 
        fiber.sibling = null, fiber;
    }
    function placeChild(newFiber, lastPlacedIndex, newIndex) {
        if (newFiber.index = newIndex, !shouldTrackSideEffects) // Noop.
        return lastPlacedIndex;
        var current$$1 = newFiber.alternate;
        if (null !== current$$1) {
            var oldIndex = current$$1.index;
            // This is a move.
            return oldIndex < lastPlacedIndex ? (newFiber.effectTag = Placement$3, lastPlacedIndex) : oldIndex;
        }
        // This is an insertion.
        return newFiber.effectTag = Placement$3, lastPlacedIndex;
    }
    function placeSingleChild(newFiber) {
        // This is simpler for the single child case. We only need to do a
        // placement for inserting new children.
        return shouldTrackSideEffects && null === newFiber.alternate && (newFiber.effectTag = Placement$3), 
        newFiber;
    }
    function updateTextNode(returnFiber, current$$1, textContent, priority) {
        if (null === current$$1 || current$$1.tag !== HostText$3) {
            // Insert
            var created = createFiberFromText$1(textContent, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Update
        var existing = useFiber(current$$1, priority);
        return existing.pendingProps = textContent, existing.return = returnFiber, existing;
    }
    function updateElement(returnFiber, current$$1, element, priority) {
        if (null === current$$1 || current$$1.type !== element.type) {
            // Insert
            var created = createFiberFromElement$1(element, returnFiber.internalContextTag, priority);
            return created.ref = coerceRef(current$$1, element), created.return = returnFiber, 
            created;
        }
        // Move based on index
        var existing = useFiber(current$$1, priority);
        return existing.ref = coerceRef(current$$1, element), existing.pendingProps = element.props, 
        existing.return = returnFiber, existing;
    }
    function updateCoroutine(returnFiber, current$$1, coroutine, priority) {
        // TODO: Should this also compare handler to determine whether to reuse?
        if (null === current$$1 || current$$1.tag !== CoroutineComponent$2) {
            // Insert
            var created = createFiberFromCoroutine$1(coroutine, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Move based on index
        var existing = useFiber(current$$1, priority);
        return existing.pendingProps = coroutine, existing.return = returnFiber, existing;
    }
    function updateYield(returnFiber, current$$1, yieldNode, priority) {
        if (null === current$$1 || current$$1.tag !== YieldComponent$2) {
            // Insert
            var created = createFiberFromYield$1(yieldNode, returnFiber.internalContextTag, priority);
            return created.type = yieldNode.value, created.return = returnFiber, created;
        }
        // Move based on index
        var existing = useFiber(current$$1, priority);
        return existing.type = yieldNode.value, existing.return = returnFiber, existing;
    }
    function updatePortal(returnFiber, current$$1, portal, priority) {
        if (null === current$$1 || current$$1.tag !== HostPortal$3 || current$$1.stateNode.containerInfo !== portal.containerInfo || current$$1.stateNode.implementation !== portal.implementation) {
            // Insert
            var created = createFiberFromPortal$1(portal, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Update
        var existing = useFiber(current$$1, priority);
        return existing.pendingProps = portal.children || [], existing.return = returnFiber, 
        existing;
    }
    function updateFragment(returnFiber, current$$1, fragment, priority) {
        if (null === current$$1 || current$$1.tag !== Fragment$2) {
            // Insert
            var created = createFiberFromFragment$1(fragment, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Update
        var existing = useFiber(current$$1, priority);
        return existing.pendingProps = fragment, existing.return = returnFiber, existing;
    }
    function createChild(returnFiber, newChild, priority) {
        if ("string" == typeof newChild || "number" == typeof newChild) {
            // Text nodes doesn't have keys. If the previous node is implicitly keyed
            // we can continue to replace it without aborting even if it is not a text
            // node.
            var created = createFiberFromText$1("" + newChild, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        if ("object" == typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                var _created = createFiberFromElement$1(newChild, returnFiber.internalContextTag, priority);
                return _created.ref = coerceRef(null, newChild), _created.return = returnFiber, 
                _created;

              case REACT_COROUTINE_TYPE:
                var _created2 = createFiberFromCoroutine$1(newChild, returnFiber.internalContextTag, priority);
                return _created2.return = returnFiber, _created2;

              case REACT_YIELD_TYPE:
                var _created3 = createFiberFromYield$1(newChild, returnFiber.internalContextTag, priority);
                return _created3.type = newChild.value, _created3.return = returnFiber, _created3;

              case REACT_PORTAL_TYPE:
                var _created4 = createFiberFromPortal$1(newChild, returnFiber.internalContextTag, priority);
                return _created4.return = returnFiber, _created4;
            }
            if (isArray(newChild) || getIteratorFn(newChild)) {
                var _created5 = createFiberFromFragment$1(newChild, returnFiber.internalContextTag, priority);
                return _created5.return = returnFiber, _created5;
            }
            throwOnInvalidObjectType(returnFiber, newChild);
        }
        return null;
    }
    function updateSlot(returnFiber, oldFiber, newChild, priority) {
        // Update the fiber if the keys match, otherwise return null.
        var key = null !== oldFiber ? oldFiber.key : null;
        if ("string" == typeof newChild || "number" == typeof newChild) // Text nodes doesn't have keys. If the previous node is implicitly keyed
        // we can continue to replace it without aborting even if it is not a text
        // node.
        // Text nodes doesn't have keys. If the previous node is implicitly keyed
        // we can continue to replace it without aborting even if it is not a text
        // node.
        return null !== key ? null : updateTextNode(returnFiber, oldFiber, "" + newChild, priority);
        if ("object" == typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return newChild.key === key ? updateElement(returnFiber, oldFiber, newChild, priority) : null;

              case REACT_COROUTINE_TYPE:
                return newChild.key === key ? updateCoroutine(returnFiber, oldFiber, newChild, priority) : null;

              case REACT_YIELD_TYPE:
                // Yields doesn't have keys. If the previous node is implicitly keyed
                // we can continue to replace it without aborting even if it is not a
                // yield.
                // Yields doesn't have keys. If the previous node is implicitly keyed
                // we can continue to replace it without aborting even if it is not a
                // yield.
                return null === key ? updateYield(returnFiber, oldFiber, newChild, priority) : null;

              case REACT_PORTAL_TYPE:
                return newChild.key === key ? updatePortal(returnFiber, oldFiber, newChild, priority) : null;
            }
            if (isArray(newChild) || getIteratorFn(newChild)) // Fragments doesn't have keys so if the previous key is implicit we can
            // update it.
            // Fragments doesn't have keys so if the previous key is implicit we can
            // update it.
            return null !== key ? null : updateFragment(returnFiber, oldFiber, newChild, priority);
            throwOnInvalidObjectType(returnFiber, newChild);
        }
        return null;
    }
    function updateFromMap(existingChildren, returnFiber, newIdx, newChild, priority) {
        if ("string" == typeof newChild || "number" == typeof newChild) {
            return updateTextNode(returnFiber, existingChildren.get(newIdx) || null, "" + newChild, priority);
        }
        if ("object" == typeof newChild && null !== newChild) {
            switch (newChild.$$typeof) {
              case REACT_ELEMENT_TYPE:
                return updateElement(returnFiber, existingChildren.get(null === newChild.key ? newIdx : newChild.key) || null, newChild, priority);

              case REACT_COROUTINE_TYPE:
                return updateCoroutine(returnFiber, existingChildren.get(null === newChild.key ? newIdx : newChild.key) || null, newChild, priority);

              case REACT_YIELD_TYPE:
                return updateYield(returnFiber, existingChildren.get(newIdx) || null, newChild, priority);

              case REACT_PORTAL_TYPE:
                return updatePortal(returnFiber, existingChildren.get(null === newChild.key ? newIdx : newChild.key) || null, newChild, priority);
            }
            if (isArray(newChild) || getIteratorFn(newChild)) {
                return updateFragment(returnFiber, existingChildren.get(newIdx) || null, newChild, priority);
            }
            throwOnInvalidObjectType(returnFiber, newChild);
        }
        return null;
    }
    /**
   * Warns if there is a duplicate or missing key
   */
    function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, priority) {
        for (// This algorithm can't optimize by searching from boths ends since we
        // don't have backpointers on fibers. I'm trying to see how far we can get
        // with that model. If it ends up not being worth the tradeoffs, we can
        // add it later.
        // Even with a two ended optimization, we'd want to optimize for the case
        // where there are few changes and brute force the comparison instead of
        // going for the Map. It'd like to explore hitting that path first in
        // forward-only mode and only go for the Map once we notice that we need
        // lots of look ahead. This doesn't handle reversal as well as two ended
        // search but that's unusual. Besides, for the two ended optimization to
        // work on Iterables, we'd need to copy the whole set.
        // In this first iteration, we'll just live with hitting the bad case
        // (adding everything to a Map) in for every insert/move.
        // If you change this code, also update reconcileChildrenIterator() which
        // uses the same algorithm.
        var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, lastPlacedIndex = 0, newIdx = 0, nextOldFiber = null; null !== oldFiber && newIdx < newChildren.length; newIdx++) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], priority);
            if (null === newFiber) {
                // TODO: This breaks on empty slots like null children. That's
                // unfortunate because it triggers the slow path all the time. We need
                // a better way to communicate whether this was a miss or null,
                // boolean, undefined, etc.
                null === oldFiber && (oldFiber = nextOldFiber);
                break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && // We matched the slot, but we didn't reuse the existing fiber, so we
            // need to delete the existing child.
            deleteChild(returnFiber, oldFiber), lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx), 
            null === previousNewFiber ? // TODO: Move out of the loop. This only happens for the first run.
            resultingFirstChild = newFiber : // TODO: Defer siblings if we're not at the right index for this slot.
            // I.e. if we had null values before, then we want to defer this
            // for each null value. However, we also don't want to call updateSlot
            // with the previous one.
            previousNewFiber.sibling = newFiber, previousNewFiber = newFiber, oldFiber = nextOldFiber;
        }
        if (newIdx === newChildren.length) // We've reached the end of the new children. We can delete the rest.
        return deleteRemainingChildren(returnFiber, oldFiber), resultingFirstChild;
        if (null === oldFiber) {
            // If we don't have any more existing children we can choose a fast path
            // since the rest will all be insertions.
            for (;newIdx < newChildren.length; newIdx++) {
                var _newFiber = createChild(returnFiber, newChildren[newIdx], priority);
                _newFiber && (lastPlacedIndex = placeChild(_newFiber, lastPlacedIndex, newIdx), 
                null === previousNewFiber ? // TODO: Move out of the loop. This only happens for the first run.
                resultingFirstChild = _newFiber : previousNewFiber.sibling = _newFiber, previousNewFiber = _newFiber);
            }
            return resultingFirstChild;
        }
        // Keep scanning and use the map to restore deleted items as moves.
        for (// Add all children to a key map for quick lookups.
        var existingChildren = mapRemainingChildren(returnFiber, oldFiber); newIdx < newChildren.length; newIdx++) {
            var _newFiber2 = updateFromMap(existingChildren, returnFiber, newIdx, newChildren[newIdx], priority);
            _newFiber2 && (shouldTrackSideEffects && null !== _newFiber2.alternate && // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren.delete(null === _newFiber2.key ? newIdx : _newFiber2.key), lastPlacedIndex = placeChild(_newFiber2, lastPlacedIndex, newIdx), 
            null === previousNewFiber ? resultingFirstChild = _newFiber2 : previousNewFiber.sibling = _newFiber2, 
            previousNewFiber = _newFiber2);
        }
        // Any existing children that weren't consumed above were deleted. We need
        // to add them to the deletion list.
        return shouldTrackSideEffects && existingChildren.forEach(function(child) {
            return deleteChild(returnFiber, child);
        }), resultingFirstChild;
    }
    function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildrenIterable, priority) {
        // This is the same implementation as reconcileChildrenArray(),
        // but using the iterator instead.
        var iteratorFn = getIteratorFn(newChildrenIterable);
        invariant("function" == typeof iteratorFn, "An object is not an iterable. This error is likely caused by a bug in " + "React. Please file an issue.");
        var newChildren = iteratorFn.call(newChildrenIterable);
        invariant(null != newChildren, "An iterable object provided no iterator.");
        for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, lastPlacedIndex = 0, newIdx = 0, nextOldFiber = null, step = newChildren.next(); null !== oldFiber && !step.done; newIdx++, 
        step = newChildren.next()) {
            oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
            var newFiber = updateSlot(returnFiber, oldFiber, step.value, priority);
            if (null === newFiber) {
                // TODO: This breaks on empty slots like null children. That's
                // unfortunate because it triggers the slow path all the time. We need
                // a better way to communicate whether this was a miss or null,
                // boolean, undefined, etc.
                oldFiber || (oldFiber = nextOldFiber);
                break;
            }
            shouldTrackSideEffects && oldFiber && null === newFiber.alternate && // We matched the slot, but we didn't reuse the existing fiber, so we
            // need to delete the existing child.
            deleteChild(returnFiber, oldFiber), lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx), 
            null === previousNewFiber ? // TODO: Move out of the loop. This only happens for the first run.
            resultingFirstChild = newFiber : // TODO: Defer siblings if we're not at the right index for this slot.
            // I.e. if we had null values before, then we want to defer this
            // for each null value. However, we also don't want to call updateSlot
            // with the previous one.
            previousNewFiber.sibling = newFiber, previousNewFiber = newFiber, oldFiber = nextOldFiber;
        }
        if (step.done) // We've reached the end of the new children. We can delete the rest.
        return deleteRemainingChildren(returnFiber, oldFiber), resultingFirstChild;
        if (null === oldFiber) {
            // If we don't have any more existing children we can choose a fast path
            // since the rest will all be insertions.
            for (;!step.done; newIdx++, step = newChildren.next()) {
                var _newFiber3 = createChild(returnFiber, step.value, priority);
                null !== _newFiber3 && (lastPlacedIndex = placeChild(_newFiber3, lastPlacedIndex, newIdx), 
                null === previousNewFiber ? // TODO: Move out of the loop. This only happens for the first run.
                resultingFirstChild = _newFiber3 : previousNewFiber.sibling = _newFiber3, previousNewFiber = _newFiber3);
            }
            return resultingFirstChild;
        }
        // Keep scanning and use the map to restore deleted items as moves.
        for (// Add all children to a key map for quick lookups.
        var existingChildren = mapRemainingChildren(returnFiber, oldFiber); !step.done; newIdx++, 
        step = newChildren.next()) {
            var _newFiber4 = updateFromMap(existingChildren, returnFiber, newIdx, step.value, priority);
            null !== _newFiber4 && (shouldTrackSideEffects && null !== _newFiber4.alternate && // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren.delete(null === _newFiber4.key ? newIdx : _newFiber4.key), lastPlacedIndex = placeChild(_newFiber4, lastPlacedIndex, newIdx), 
            null === previousNewFiber ? resultingFirstChild = _newFiber4 : previousNewFiber.sibling = _newFiber4, 
            previousNewFiber = _newFiber4);
        }
        // Any existing children that weren't consumed above were deleted. We need
        // to add them to the deletion list.
        return shouldTrackSideEffects && existingChildren.forEach(function(child) {
            return deleteChild(returnFiber, child);
        }), resultingFirstChild;
    }
    function reconcileSingleTextNode(returnFiber, currentFirstChild, textContent, priority) {
        // There's no need to check for keys on text nodes since we don't have a
        // way to define them.
        if (null !== currentFirstChild && currentFirstChild.tag === HostText$3) {
            // We already have an existing node so let's just update it and delete
            // the rest.
            deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
            var existing = useFiber(currentFirstChild, priority);
            return existing.pendingProps = textContent, existing.return = returnFiber, existing;
        }
        // The existing first child is not a text node so we need to create one
        // and delete the existing ones.
        deleteRemainingChildren(returnFiber, currentFirstChild);
        var created = createFiberFromText$1(textContent, returnFiber.internalContextTag, priority);
        return created.return = returnFiber, created;
    }
    function reconcileSingleElement(returnFiber, currentFirstChild, element, priority) {
        for (var key = element.key, child = currentFirstChild; null !== child; ) {
            // TODO: If key === null and child.key === null, then this only applies to
            // the first item in the list.
            if (child.key === key) {
                if (child.type === element.type) {
                    deleteRemainingChildren(returnFiber, child.sibling);
                    var existing = useFiber(child, priority);
                    return existing.ref = coerceRef(child, element), existing.pendingProps = element.props, 
                    existing.return = returnFiber, existing;
                }
                deleteRemainingChildren(returnFiber, child);
                break;
            }
            deleteChild(returnFiber, child), child = child.sibling;
        }
        var created = createFiberFromElement$1(element, returnFiber.internalContextTag, priority);
        return created.ref = coerceRef(currentFirstChild, element), created.return = returnFiber, 
        created;
    }
    function reconcileSingleCoroutine(returnFiber, currentFirstChild, coroutine, priority) {
        for (var key = coroutine.key, child = currentFirstChild; null !== child; ) {
            // TODO: If key === null and child.key === null, then this only applies to
            // the first item in the list.
            if (child.key === key) {
                if (child.tag === CoroutineComponent$2) {
                    deleteRemainingChildren(returnFiber, child.sibling);
                    var existing = useFiber(child, priority);
                    return existing.pendingProps = coroutine, existing.return = returnFiber, existing;
                }
                deleteRemainingChildren(returnFiber, child);
                break;
            }
            deleteChild(returnFiber, child), child = child.sibling;
        }
        var created = createFiberFromCoroutine$1(coroutine, returnFiber.internalContextTag, priority);
        return created.return = returnFiber, created;
    }
    function reconcileSingleYield(returnFiber, currentFirstChild, yieldNode, priority) {
        // There's no need to check for keys on yields since they're stateless.
        var child = currentFirstChild;
        if (null !== child) {
            if (child.tag === YieldComponent$2) {
                deleteRemainingChildren(returnFiber, child.sibling);
                var existing = useFiber(child, priority);
                return existing.type = yieldNode.value, existing.return = returnFiber, existing;
            }
            deleteRemainingChildren(returnFiber, child);
        }
        var created = createFiberFromYield$1(yieldNode, returnFiber.internalContextTag, priority);
        return created.type = yieldNode.value, created.return = returnFiber, created;
    }
    function reconcileSinglePortal(returnFiber, currentFirstChild, portal, priority) {
        for (var key = portal.key, child = currentFirstChild; null !== child; ) {
            // TODO: If key === null and child.key === null, then this only applies to
            // the first item in the list.
            if (child.key === key) {
                if (child.tag === HostPortal$3 && child.stateNode.containerInfo === portal.containerInfo && child.stateNode.implementation === portal.implementation) {
                    deleteRemainingChildren(returnFiber, child.sibling);
                    var existing = useFiber(child, priority);
                    return existing.pendingProps = portal.children || [], existing.return = returnFiber, 
                    existing;
                }
                deleteRemainingChildren(returnFiber, child);
                break;
            }
            deleteChild(returnFiber, child), child = child.sibling;
        }
        var created = createFiberFromPortal$1(portal, returnFiber.internalContextTag, priority);
        return created.return = returnFiber, created;
    }
    // This API will tag the children with the side-effect of the reconciliation
    // itself. They will be added to the side-effect list as we pass through the
    // children and the parent.
    function reconcileChildFibers(returnFiber, currentFirstChild, newChild, priority) {
        // This function is not recursive.
        // If the top level item is an array, we treat it as a set of children,
        // not as a fragment. Nested arrays on the other hand will be treated as
        // fragment nodes. Recursion happens at the normal flow.
        var disableNewFiberFeatures = ReactFeatureFlags$1.disableNewFiberFeatures, isObject = "object" == typeof newChild && null !== newChild;
        if (isObject) // Support only the subset of return types that Stack supports. Treat
        // everything else as empty, but log a warning.
        if (disableNewFiberFeatures) switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            return placeSingleChild(reconcileSingleElement(returnFiber, currentFirstChild, newChild, priority));

          case REACT_PORTAL_TYPE:
            return placeSingleChild(reconcileSinglePortal(returnFiber, currentFirstChild, newChild, priority));
        } else switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            return placeSingleChild(reconcileSingleElement(returnFiber, currentFirstChild, newChild, priority));

          case REACT_COROUTINE_TYPE:
            return placeSingleChild(reconcileSingleCoroutine(returnFiber, currentFirstChild, newChild, priority));

          case REACT_YIELD_TYPE:
            return placeSingleChild(reconcileSingleYield(returnFiber, currentFirstChild, newChild, priority));

          case REACT_PORTAL_TYPE:
            return placeSingleChild(reconcileSinglePortal(returnFiber, currentFirstChild, newChild, priority));
        }
        if (disableNewFiberFeatures) // The new child is not an element. If it's not null or false,
        // and the return fiber is a composite component, throw an error.
        switch (returnFiber.tag) {
          case ClassComponent$7:
            var Component = returnFiber.type;
            invariant(null === newChild || !1 === newChild, "%s.render(): A valid React element (or null) must be returned. " + "You may have returned undefined, an array or some other " + "invalid object.", Component.displayName || Component.name || "Component");
            break;

          case FunctionalComponent$2:
            // Composites accept elements, portals, null, or false
            var _Component = returnFiber.type;
            invariant(null === newChild || !1 === newChild, "%s(...): A valid React element (or null) must be returned. " + "You may have returned undefined, an array or some other " + "invalid object.", _Component.displayName || _Component.name || "Component");
        }
        if ("string" == typeof newChild || "number" == typeof newChild) return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFirstChild, "" + newChild, priority));
        if (isArray(newChild)) return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, priority);
        if (getIteratorFn(newChild)) return reconcileChildrenIterator(returnFiber, currentFirstChild, newChild, priority);
        if (isObject && throwOnInvalidObjectType(returnFiber, newChild), !disableNewFiberFeatures && void 0 === newChild) // If the new child is undefined, and the return fiber is a composite
        // component, throw an error. If Fiber return types are disabled,
        // we already threw above.
        switch (returnFiber.tag) {
          case ClassComponent$7:
          // Intentionally fall through to the next case, which handles both
            // functions and classes
            // eslint-disable-next-lined no-fallthrough
            case FunctionalComponent$2:
            var _Component2 = returnFiber.type;
            invariant(!1, "%s(...): Nothing was returned from render. This usually means a " + "return statement is missing. Or, to render nothing, " + "return null.", _Component2.displayName || _Component2.name || "Component");
        }
        // Remaining cases are all treated as empty.
        return deleteRemainingChildren(returnFiber, currentFirstChild);
    }
    return reconcileChildFibers;
}

var reconcileChildFibers$1 = ChildReconciler(!0, !0), reconcileChildFibersInPlace$1 = ChildReconciler(!1, !0), mountChildFibersInPlace$1 = ChildReconciler(!1, !1), cloneChildFibers$1 = function(current$$1, workInProgress, renderPriority) {
    if (invariant(null === current$$1 || workInProgress.child === current$$1.child, "Resuming work not yet implemented."), 
    null !== workInProgress.child) {
        var currentChild = workInProgress.child, newChild = createWorkInProgress$2(currentChild, renderPriority);
        for (// TODO: Pass this as an argument, since it's easy to forget.
        newChild.pendingProps = currentChild.pendingProps, workInProgress.child = newChild, 
        newChild.return = workInProgress; null !== currentChild.sibling; ) currentChild = currentChild.sibling, 
        newChild = newChild.sibling = createWorkInProgress$2(currentChild, renderPriority), 
        newChild.pendingProps = currentChild.pendingProps, newChild.return = workInProgress;
        newChild.sibling = null;
    }
}, ReactChildFiber = {
    reconcileChildFibers: reconcileChildFibers$1,
    reconcileChildFibersInPlace: reconcileChildFibersInPlace$1,
    mountChildFibersInPlace: mountChildFibersInPlace$1,
    cloneChildFibers: cloneChildFibers$1
}, Update$1 = ReactTypeOfSideEffect.Update, ReactFeatureFlags$2 = require("ReactFeatureFlags"), AsyncUpdates$1 = ReactTypeOfInternalContext.AsyncUpdates, cacheContext$1 = ReactFiberContext.cacheContext, getMaskedContext$2 = ReactFiberContext.getMaskedContext, getUnmaskedContext$2 = ReactFiberContext.getUnmaskedContext, isContextConsumer$1 = ReactFiberContext.isContextConsumer, addUpdate$1 = ReactFiberUpdateQueue.addUpdate, addReplaceUpdate$1 = ReactFiberUpdateQueue.addReplaceUpdate, addForceUpdate$1 = ReactFiberUpdateQueue.addForceUpdate, beginUpdateQueue$2 = ReactFiberUpdateQueue.beginUpdateQueue, _require5$1 = ReactFiberContext, hasContextChanged$2 = _require5$1.hasContextChanged, isMounted$1 = ReactFiberTreeReflection.isMounted, ReactFiberClassComponent = function(scheduleUpdate, getPriorityContext, memoizeProps, memoizeState) {
    // Class component state updater
    var updater = {
        isMounted: isMounted$1,
        enqueueSetState: function(instance, partialState, callback) {
            var fiber = ReactInstanceMap_1.get(instance), priorityLevel = getPriorityContext(fiber, !1);
            callback = void 0 === callback ? null : callback, addUpdate$1(fiber, partialState, callback, priorityLevel), 
            scheduleUpdate(fiber, priorityLevel);
        },
        enqueueReplaceState: function(instance, state, callback) {
            var fiber = ReactInstanceMap_1.get(instance), priorityLevel = getPriorityContext(fiber, !1);
            callback = void 0 === callback ? null : callback, addReplaceUpdate$1(fiber, state, callback, priorityLevel), 
            scheduleUpdate(fiber, priorityLevel);
        },
        enqueueForceUpdate: function(instance, callback) {
            var fiber = ReactInstanceMap_1.get(instance), priorityLevel = getPriorityContext(fiber, !1);
            callback = void 0 === callback ? null : callback, addForceUpdate$1(fiber, callback, priorityLevel), 
            scheduleUpdate(fiber, priorityLevel);
        }
    };
    function checkShouldComponentUpdate(workInProgress, oldProps, newProps, oldState, newState, newContext) {
        if (null === oldProps || null !== workInProgress.updateQueue && workInProgress.updateQueue.hasForceUpdate) // If the workInProgress already has an Update effect, return true
        return !0;
        var instance = workInProgress.stateNode, type = workInProgress.type;
        if ("function" == typeof instance.shouldComponentUpdate) {
            return instance.shouldComponentUpdate(newProps, newState, newContext);
        }
        return !type.prototype || !type.prototype.isPureReactComponent || (!shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState));
    }
    function resetInputPointers(workInProgress, instance) {
        instance.props = workInProgress.memoizedProps, instance.state = workInProgress.memoizedState;
    }
    function adoptClassInstance(workInProgress, instance) {
        instance.updater = updater, workInProgress.stateNode = instance, // The instance needs access to the fiber so that it can schedule updates
        ReactInstanceMap_1.set(instance, workInProgress);
    }
    function constructClassInstance(workInProgress, props) {
        var ctor = workInProgress.type, unmaskedContext = getUnmaskedContext$2(workInProgress), needsContext = isContextConsumer$1(workInProgress), context = needsContext ? getMaskedContext$2(workInProgress, unmaskedContext) : emptyObject, instance = new ctor(props, context);
        // Cache unmasked context so we can avoid recreating masked context unless necessary.
        // ReactFiberContext usually updates this cache but can't for newly-created instances.
        return adoptClassInstance(workInProgress, instance), needsContext && cacheContext$1(workInProgress, unmaskedContext, context), 
        instance;
    }
    function callComponentWillMount(workInProgress, instance) {
        var oldState = instance.state;
        instance.componentWillMount(), oldState !== instance.state && updater.enqueueReplaceState(instance, instance.state, null);
    }
    function callComponentWillReceiveProps(workInProgress, instance, newProps, newContext) {
        var oldState = instance.state;
        instance.componentWillReceiveProps(newProps, newContext), instance.state !== oldState && updater.enqueueReplaceState(instance, instance.state, null);
    }
    // Invokes the mount life-cycles on a previously never rendered instance.
    function mountClassInstance(workInProgress, priorityLevel) {
        var current$$1 = workInProgress.alternate, instance = workInProgress.stateNode, state = instance.state || null, props = workInProgress.pendingProps;
        invariant(props, "There must be pending props for an initial mount. This error is " + "likely caused by a bug in React. Please file an issue.");
        var unmaskedContext = getUnmaskedContext$2(workInProgress);
        if (instance.props = props, instance.state = state, instance.refs = emptyObject, 
        instance.context = getMaskedContext$2(workInProgress, unmaskedContext), ReactFeatureFlags$2.enableAsyncSubtreeAPI && null != workInProgress.type && !0 === workInProgress.type.unstable_asyncUpdates && (workInProgress.internalContextTag |= AsyncUpdates$1), 
        "function" == typeof instance.componentWillMount) {
            callComponentWillMount(workInProgress, instance);
            // If we had additional state updates during this life-cycle, let's
            // process them now.
            var updateQueue = workInProgress.updateQueue;
            null !== updateQueue && (instance.state = beginUpdateQueue$2(current$$1, workInProgress, updateQueue, instance, state, props, priorityLevel));
        }
        "function" == typeof instance.componentDidMount && (workInProgress.effectTag |= Update$1);
    }
    // Called on a preexisting class instance. Returns false if a resumed render
    // could be reused.
    // function resumeMountClassInstance(
    //   workInProgress: Fiber,
    //   priorityLevel: PriorityLevel,
    // ): boolean {
    //   const instance = workInProgress.stateNode;
    //   resetInputPointers(workInProgress, instance);
    //   let newState = workInProgress.memoizedState;
    //   let newProps = workInProgress.pendingProps;
    //   if (!newProps) {
    //     // If there isn't any new props, then we'll reuse the memoized props.
    //     // This could be from already completed work.
    //     newProps = workInProgress.memoizedProps;
    //     invariant(
    //       newProps != null,
    //       'There should always be pending or memoized props. This error is ' +
    //         'likely caused by a bug in React. Please file an issue.',
    //     );
    //   }
    //   const newUnmaskedContext = getUnmaskedContext(workInProgress);
    //   const newContext = getMaskedContext(workInProgress, newUnmaskedContext);
    //   const oldContext = instance.context;
    //   const oldProps = workInProgress.memoizedProps;
    //   if (
    //     typeof instance.componentWillReceiveProps === 'function' &&
    //     (oldProps !== newProps || oldContext !== newContext)
    //   ) {
    //     callComponentWillReceiveProps(
    //       workInProgress,
    //       instance,
    //       newProps,
    //       newContext,
    //     );
    //   }
    //   // Process the update queue before calling shouldComponentUpdate
    //   const updateQueue = workInProgress.updateQueue;
    //   if (updateQueue !== null) {
    //     newState = beginUpdateQueue(
    //       workInProgress,
    //       updateQueue,
    //       instance,
    //       newState,
    //       newProps,
    //       priorityLevel,
    //     );
    //   }
    //   // TODO: Should we deal with a setState that happened after the last
    //   // componentWillMount and before this componentWillMount? Probably
    //   // unsupported anyway.
    //   if (
    //     !checkShouldComponentUpdate(
    //       workInProgress,
    //       workInProgress.memoizedProps,
    //       newProps,
    //       workInProgress.memoizedState,
    //       newState,
    //       newContext,
    //     )
    //   ) {
    //     // Update the existing instance's state, props, and context pointers even
    //     // though we're bailing out.
    //     instance.props = newProps;
    //     instance.state = newState;
    //     instance.context = newContext;
    //     return false;
    //   }
    //   // Update the input pointers now so that they are correct when we call
    //   // componentWillMount
    //   instance.props = newProps;
    //   instance.state = newState;
    //   instance.context = newContext;
    //   if (typeof instance.componentWillMount === 'function') {
    //     callComponentWillMount(workInProgress, instance);
    //     // componentWillMount may have called setState. Process the update queue.
    //     const newUpdateQueue = workInProgress.updateQueue;
    //     if (newUpdateQueue !== null) {
    //       newState = beginUpdateQueue(
    //         workInProgress,
    //         newUpdateQueue,
    //         instance,
    //         newState,
    //         newProps,
    //         priorityLevel,
    //       );
    //     }
    //   }
    //   if (typeof instance.componentDidMount === 'function') {
    //     workInProgress.effectTag |= Update;
    //   }
    //   instance.state = newState;
    //   return true;
    // }
    // Invokes the update life-cycles and returns false if it shouldn't rerender.
    function updateClassInstance(current$$1, workInProgress, priorityLevel) {
        var instance = workInProgress.stateNode;
        resetInputPointers(workInProgress, instance);
        var oldProps = workInProgress.memoizedProps, newProps = workInProgress.pendingProps;
        newProps || (// If there aren't any new props, then we'll reuse the memoized props.
        // This could be from already completed work.
        newProps = oldProps, invariant(null != newProps, "There should always be pending or memoized props. This error is " + "likely caused by a bug in React. Please file an issue."));
        var oldContext = instance.context, newUnmaskedContext = getUnmaskedContext$2(workInProgress), newContext = getMaskedContext$2(workInProgress, newUnmaskedContext);
        // Note: During these life-cycles, instance.props/instance.state are what
        // ever the previously attempted to render - not the "current". However,
        // during componentDidUpdate we pass the "current" props.
        "function" != typeof instance.componentWillReceiveProps || oldProps === newProps && oldContext === newContext || callComponentWillReceiveProps(workInProgress, instance, newProps, newContext);
        // Compute the next state using the memoized state and the update queue.
        var oldState = workInProgress.memoizedState, newState = void 0;
        if (newState = null !== workInProgress.updateQueue ? beginUpdateQueue$2(current$$1, workInProgress, workInProgress.updateQueue, instance, oldState, newProps, priorityLevel) : oldState, 
        !(oldProps !== newProps || oldState !== newState || hasContextChanged$2() || null !== workInProgress.updateQueue && workInProgress.updateQueue.hasForceUpdate)) // If an update was already in progress, we should schedule an Update
        // effect even though we're bailing out, so that cWU/cDU are called.
        return "function" == typeof instance.componentDidUpdate && (oldProps === current$$1.memoizedProps && oldState === current$$1.memoizedState || (workInProgress.effectTag |= Update$1)), 
        !1;
        var shouldUpdate = checkShouldComponentUpdate(workInProgress, oldProps, newProps, oldState, newState, newContext);
        // If an update was already in progress, we should schedule an Update
        // effect even though we're bailing out, so that cWU/cDU are called.
        // If shouldComponentUpdate returned false, we should still update the
        // memoized props/state to indicate that this work can be reused.
        // Update the existing instance's state, props, and context pointers even
        // if shouldComponentUpdate returns false.
        return shouldUpdate ? ("function" == typeof instance.componentWillUpdate && instance.componentWillUpdate(newProps, newState, newContext), 
        "function" == typeof instance.componentDidUpdate && (workInProgress.effectTag |= Update$1)) : ("function" == typeof instance.componentDidUpdate && (oldProps === current$$1.memoizedProps && oldState === current$$1.memoizedState || (workInProgress.effectTag |= Update$1)), 
        memoizeProps(workInProgress, newProps), memoizeState(workInProgress, newState)), 
        instance.props = newProps, instance.state = newState, instance.context = newContext, 
        shouldUpdate;
    }
    return {
        adoptClassInstance: adoptClassInstance,
        constructClassInstance: constructClassInstance,
        mountClassInstance: mountClassInstance,
        // resumeMountClassInstance,
        updateClassInstance: updateClassInstance
    };
}, mountChildFibersInPlace = ReactChildFiber.mountChildFibersInPlace, reconcileChildFibers = ReactChildFiber.reconcileChildFibers, reconcileChildFibersInPlace = ReactChildFiber.reconcileChildFibersInPlace, cloneChildFibers = ReactChildFiber.cloneChildFibers, beginUpdateQueue$1 = ReactFiberUpdateQueue.beginUpdateQueue, getMaskedContext$1 = ReactFiberContext.getMaskedContext, getUnmaskedContext$1 = ReactFiberContext.getUnmaskedContext, hasContextChanged$1 = ReactFiberContext.hasContextChanged, pushContextProvider$1 = ReactFiberContext.pushContextProvider, pushTopLevelContextObject$1 = ReactFiberContext.pushTopLevelContextObject, invalidateContextProvider$1 = ReactFiberContext.invalidateContextProvider, IndeterminateComponent$2 = ReactTypeOfWork.IndeterminateComponent, FunctionalComponent$1 = ReactTypeOfWork.FunctionalComponent, ClassComponent$6 = ReactTypeOfWork.ClassComponent, HostRoot$5 = ReactTypeOfWork.HostRoot, HostComponent$5 = ReactTypeOfWork.HostComponent, HostText$2 = ReactTypeOfWork.HostText, HostPortal$2 = ReactTypeOfWork.HostPortal, CoroutineComponent$1 = ReactTypeOfWork.CoroutineComponent, CoroutineHandlerPhase = ReactTypeOfWork.CoroutineHandlerPhase, YieldComponent$1 = ReactTypeOfWork.YieldComponent, Fragment$1 = ReactTypeOfWork.Fragment, NoWork$3 = ReactPriorityLevel.NoWork, OffscreenPriority$1 = ReactPriorityLevel.OffscreenPriority, PerformedWork$1 = ReactTypeOfSideEffect.PerformedWork, Placement$2 = ReactTypeOfSideEffect.Placement, ContentReset$1 = ReactTypeOfSideEffect.ContentReset, Err$1 = ReactTypeOfSideEffect.Err, Ref$1 = ReactTypeOfSideEffect.Ref, ReactCurrentOwner$2 = ReactGlobalSharedState_1.ReactCurrentOwner, ReactFiberBeginWork = function(config, hostContext, hydrationContext, scheduleUpdate, getPriorityContext) {
    var shouldSetTextContent = config.shouldSetTextContent, useSyncScheduling = config.useSyncScheduling, shouldDeprioritizeSubtree = config.shouldDeprioritizeSubtree, pushHostContext = hostContext.pushHostContext, pushHostContainer = hostContext.pushHostContainer, enterHydrationState = hydrationContext.enterHydrationState, resetHydrationState = hydrationContext.resetHydrationState, tryToClaimNextHydratableInstance = hydrationContext.tryToClaimNextHydratableInstance, _ReactFiberClassCompo = ReactFiberClassComponent(scheduleUpdate, getPriorityContext, memoizeProps, memoizeState), adoptClassInstance = _ReactFiberClassCompo.adoptClassInstance, constructClassInstance = _ReactFiberClassCompo.constructClassInstance, mountClassInstance = _ReactFiberClassCompo.mountClassInstance, updateClassInstance = _ReactFiberClassCompo.updateClassInstance;
    function reconcileChildren(current$$1, workInProgress, nextChildren) {
        reconcileChildrenAtPriority(current$$1, workInProgress, nextChildren, workInProgress.pendingWorkPriority);
    }
    function reconcileChildrenAtPriority(current$$1, workInProgress, nextChildren, priorityLevel) {
        null === current$$1 ? // If this is a fresh new component that hasn't been rendered yet, we
        // won't update its child set by applying minimal side-effects. Instead,
        // we will add them all to the child before it gets rendered. That means
        // we can optimize this reconciliation pass by not tracking side-effects.
        workInProgress.child = mountChildFibersInPlace(workInProgress, workInProgress.child, nextChildren, priorityLevel) : current$$1.child === workInProgress.child ? // If the current child is the same as the work in progress, it means that
        // we haven't yet started any work on these children. Therefore, we use
        // the clone algorithm to create a copy of all the current children.
        // If we had any progressed work already, that is invalid at this point so
        // let's throw it out.
        workInProgress.child = reconcileChildFibers(workInProgress, workInProgress.child, nextChildren, priorityLevel) : // If, on the other hand, it is already using a clone, that means we've
        // already begun some work on this tree and we can continue where we left
        // off by reconciling against the existing children.
        workInProgress.child = reconcileChildFibersInPlace(workInProgress, workInProgress.child, nextChildren, priorityLevel);
    }
    function updateFragment(current$$1, workInProgress) {
        var nextChildren = workInProgress.pendingProps;
        if (hasContextChanged$1()) // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextChildren && (nextChildren = workInProgress.memoizedProps); else if (null === nextChildren || workInProgress.memoizedProps === nextChildren) return bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
        return reconcileChildren(current$$1, workInProgress, nextChildren), memoizeProps(workInProgress, nextChildren), 
        workInProgress.child;
    }
    function markRef(current$$1, workInProgress) {
        var ref = workInProgress.ref;
        null === ref || current$$1 && current$$1.ref === ref || (// Schedule a Ref effect
        workInProgress.effectTag |= Ref$1);
    }
    function updateFunctionalComponent(current$$1, workInProgress) {
        var fn = workInProgress.type, nextProps = workInProgress.pendingProps, memoizedProps = workInProgress.memoizedProps;
        if (hasContextChanged$1()) // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextProps && (nextProps = memoizedProps); else {
            if (null === nextProps || memoizedProps === nextProps) return bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
            // TODO: Disable this before release, since it is not part of the public API
            // I use this for testing to compare the relative overhead of classes.
            if ("function" == typeof fn.shouldComponentUpdate && !fn.shouldComponentUpdate(memoizedProps, nextProps)) // Memoize props even if shouldComponentUpdate returns false
            return memoizeProps(workInProgress, nextProps), bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
        }
        var nextChildren, unmaskedContext = getUnmaskedContext$1(workInProgress), context = getMaskedContext$1(workInProgress, unmaskedContext);
        // React DevTools reads this flag.
        return nextChildren = fn(nextProps, context), workInProgress.effectTag |= PerformedWork$1, 
        reconcileChildren(current$$1, workInProgress, nextChildren), memoizeProps(workInProgress, nextProps), 
        workInProgress.child;
    }
    function updateClassComponent(current$$1, workInProgress, priorityLevel) {
        // Push context providers early to prevent context stack mismatches.
        // During mounting we don't know the child context yet as the instance doesn't exist.
        // We will invalidate the child context in finishClassComponent() right after rendering.
        var hasContext = pushContextProvider$1(workInProgress), shouldUpdate = void 0;
        // In the initial pass we might need to construct the instance.
        return null === current$$1 ? workInProgress.stateNode ? invariant(!1, "Resuming work not yet implemented.") : (constructClassInstance(workInProgress, workInProgress.pendingProps), 
        mountClassInstance(workInProgress, priorityLevel), shouldUpdate = !0) : shouldUpdate = updateClassInstance(current$$1, workInProgress, priorityLevel), 
        finishClassComponent(current$$1, workInProgress, shouldUpdate, hasContext);
    }
    function finishClassComponent(current$$1, workInProgress, shouldUpdate, hasContext) {
        if (// Refs should update even if shouldComponentUpdate returns false
        markRef(current$$1, workInProgress), !shouldUpdate) return bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
        var instance = workInProgress.stateNode;
        // Rerender
        ReactCurrentOwner$2.current = workInProgress;
        var nextChildren = void 0;
        // React DevTools reads this flag.
        // Memoize props and state using the values we just used to render.
        // TODO: Restructure so we never read values from the instance.
        // The context might have changed so we need to recalculate it.
        return nextChildren = instance.render(), workInProgress.effectTag |= PerformedWork$1, 
        reconcileChildren(current$$1, workInProgress, nextChildren), memoizeState(workInProgress, instance.state), 
        memoizeProps(workInProgress, instance.props), hasContext && invalidateContextProvider$1(workInProgress), 
        workInProgress.child;
    }
    function updateHostRoot(current$$1, workInProgress, priorityLevel) {
        var root = workInProgress.stateNode;
        root.pendingContext ? pushTopLevelContextObject$1(workInProgress, root.pendingContext, root.pendingContext !== root.context) : root.context && // Should always be set
        pushTopLevelContextObject$1(workInProgress, root.context, !1), pushHostContainer(workInProgress, root.containerInfo);
        var updateQueue = workInProgress.updateQueue;
        if (null !== updateQueue) {
            var prevState = workInProgress.memoizedState, state = beginUpdateQueue$1(current$$1, workInProgress, updateQueue, null, prevState, null, priorityLevel);
            if (prevState === state) // If the state is the same as before, that's a bailout because we had
            // no work matching this priority.
            return resetHydrationState(), bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
            var element = state.element;
            // Otherwise reset hydration state in case we aborted and resumed another
            // root.
            // If we don't have any current children this might be the first pass.
            // We always try to hydrate. If this isn't a hydration pass there won't
            // be any children to hydrate which is effectively the same thing as
            // not hydrating.
            // This is a bit of a hack. We track the host root as a placement to
            // know that we're currently in a mounting state. That way isMounted
            // works as expected. We must reset this before committing.
            // TODO: Delete this when we delete isMounted and findDOMNode.
            // Ensure that children mount into this root without tracking
            // side-effects. This ensures that we don't store Placement effects on
            // nodes that will be hydrated.
            return null !== current$$1 && null !== current$$1.child || !enterHydrationState(workInProgress) ? (resetHydrationState(), 
            reconcileChildren(current$$1, workInProgress, element)) : (workInProgress.effectTag |= Placement$2, 
            workInProgress.child = mountChildFibersInPlace(workInProgress, workInProgress.child, element, priorityLevel)), 
            memoizeState(workInProgress, state), workInProgress.child;
        }
        // If there is no update queue, that's a bailout because the root has no props.
        return resetHydrationState(), bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
    }
    function updateHostComponent(current$$1, workInProgress, renderPriority) {
        pushHostContext(workInProgress), null === current$$1 && tryToClaimNextHydratableInstance(workInProgress);
        var type = workInProgress.type, memoizedProps = workInProgress.memoizedProps, nextProps = workInProgress.pendingProps;
        null === nextProps && (nextProps = memoizedProps, invariant(null !== nextProps, "We should always have pending or current props. This error is " + "likely caused by a bug in React. Please file an issue."));
        var prevProps = null !== current$$1 ? current$$1.memoizedProps : null;
        if (hasContextChanged$1()) ; else if (null === nextProps || memoizedProps === nextProps) return bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
        var nextChildren = nextProps.children;
        // Check the host config to see if the children are offscreen/hidden.
        // We special case a direct text child of a host node. This is a common
        // case. We won't handle it as a reified child. We will instead handle
        // this in the host environment that also have access to this prop. That
        // avoids allocating another HostText fiber and traversing it.
        // If we're switching from a direct text child to a normal child, or to
        // empty, we need to schedule the text content to be reset.
        // Check the host config to see if the children are offscreen/hidden.
        // Down-prioritize the children.
        return shouldSetTextContent(type, nextProps) ? nextChildren = null : prevProps && shouldSetTextContent(type, prevProps) && (workInProgress.effectTag |= ContentReset$1), 
        markRef(current$$1, workInProgress), renderPriority !== OffscreenPriority$1 && !useSyncScheduling && shouldDeprioritizeSubtree(type, nextProps) ? (workInProgress.pendingWorkPriority = OffscreenPriority$1, 
        null) : (reconcileChildren(current$$1, workInProgress, nextChildren), memoizeProps(workInProgress, nextProps), 
        workInProgress.child);
    }
    function updateHostText(current$$1, workInProgress) {
        null === current$$1 && tryToClaimNextHydratableInstance(workInProgress);
        var nextProps = workInProgress.pendingProps;
        // Nothing to do here. This is terminal. We'll do the completion step
        // immediately after.
        return null === nextProps && (nextProps = workInProgress.memoizedProps), memoizeProps(workInProgress, nextProps), 
        null;
    }
    function mountIndeterminateComponent(current$$1, workInProgress, priorityLevel) {
        invariant(null === current$$1, "An indeterminate component should never have mounted. This error is " + "likely caused by a bug in React. Please file an issue.");
        var value, fn = workInProgress.type, props = workInProgress.pendingProps, unmaskedContext = getUnmaskedContext$1(workInProgress), context = getMaskedContext$1(workInProgress, unmaskedContext);
        if (value = fn(props, context), // React DevTools reads this flag.
        workInProgress.effectTag |= PerformedWork$1, "object" == typeof value && null !== value && "function" == typeof value.render) {
            // Proceed under the assumption that this is a class instance
            workInProgress.tag = ClassComponent$6;
            // Push context providers early to prevent context stack mismatches.
            // During mounting we don't know the child context yet as the instance doesn't exist.
            // We will invalidate the child context in finishClassComponent() right after rendering.
            var hasContext = pushContextProvider$1(workInProgress);
            return adoptClassInstance(workInProgress, value), mountClassInstance(workInProgress, priorityLevel), 
            finishClassComponent(current$$1, workInProgress, !0, hasContext);
        }
        // Proceed under the assumption that this is a functional component
        return workInProgress.tag = FunctionalComponent$1, reconcileChildren(current$$1, workInProgress, value), 
        memoizeProps(workInProgress, props), workInProgress.child;
    }
    function updateCoroutineComponent(current$$1, workInProgress) {
        var nextCoroutine = workInProgress.pendingProps;
        hasContextChanged$1() ? // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextCoroutine && (nextCoroutine = current$$1 && current$$1.memoizedProps, 
        invariant(null !== nextCoroutine, "We should always have pending or current props. This error is " + "likely caused by a bug in React. Please file an issue.")) : null !== nextCoroutine && workInProgress.memoizedProps !== nextCoroutine || (nextCoroutine = workInProgress.memoizedProps);
        var nextChildren = nextCoroutine.children, priorityLevel = workInProgress.pendingWorkPriority;
        // This doesn't take arbitrary time so we could synchronously just begin
        // eagerly do the work of workInProgress.child as an optimization.
        // The following is a fork of reconcileChildrenAtPriority but using
        // stateNode to store the child.
        return null === current$$1 ? workInProgress.stateNode = mountChildFibersInPlace(workInProgress, workInProgress.stateNode, nextChildren, priorityLevel) : current$$1.child === workInProgress.child ? workInProgress.stateNode = reconcileChildFibers(workInProgress, workInProgress.stateNode, nextChildren, priorityLevel) : workInProgress.stateNode = reconcileChildFibersInPlace(workInProgress, workInProgress.stateNode, nextChildren, priorityLevel), 
        memoizeProps(workInProgress, nextCoroutine), workInProgress.stateNode;
    }
    function updatePortalComponent(current$$1, workInProgress) {
        pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
        var priorityLevel = workInProgress.pendingWorkPriority, nextChildren = workInProgress.pendingProps;
        if (hasContextChanged$1()) // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextChildren && (nextChildren = current$$1 && current$$1.memoizedProps, 
        invariant(null != nextChildren, "We should always have pending or current props. This error is " + "likely caused by a bug in React. Please file an issue.")); else if (null === nextChildren || workInProgress.memoizedProps === nextChildren) return bailoutOnAlreadyFinishedWork(current$$1, workInProgress);
        // Portals are special because we don't append the children during mount
        // but at commit. Therefore we need to track insertions which the normal
        // flow doesn't do during mount. This doesn't happen at the root because
        // the root always starts with a "current" with a null child.
        // TODO: Consider unifying this with how the root works.
        return null === current$$1 ? (workInProgress.child = reconcileChildFibersInPlace(workInProgress, workInProgress.child, nextChildren, priorityLevel), 
        memoizeProps(workInProgress, nextChildren)) : (reconcileChildren(current$$1, workInProgress, nextChildren), 
        memoizeProps(workInProgress, nextChildren)), workInProgress.child;
    }
    /*
  function reuseChildrenEffects(returnFiber : Fiber, firstChild : Fiber) {
    let child = firstChild;
    do {
      // Ensure that the first and last effect of the parent corresponds
      // to the children's first and last effect.
      if (!returnFiber.firstEffect) {
        returnFiber.firstEffect = child.firstEffect;
      }
      if (child.lastEffect) {
        if (returnFiber.lastEffect) {
          returnFiber.lastEffect.nextEffect = child.firstEffect;
        }
        returnFiber.lastEffect = child.lastEffect;
      }
    } while (child = child.sibling);
  }
  */
    function bailoutOnAlreadyFinishedWork(current$$1, workInProgress) {
        var renderPriority = workInProgress.pendingWorkPriority;
        return cloneChildFibers(current$$1, workInProgress, renderPriority), workInProgress.child;
    }
    function bailoutOnLowPriority(current$$1, workInProgress) {
        switch (workInProgress.tag) {
          case ClassComponent$6:
            pushContextProvider$1(workInProgress);
            break;

          case HostPortal$2:
            pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
        }
        // TODO: What if this is currently in progress?
        // How can that happen? How is this not being cloned?
        return null;
    }
    // TODO: Delete memoizeProps/State and move to reconcile/bailout instead
    function memoizeProps(workInProgress, nextProps) {
        workInProgress.memoizedProps = nextProps;
    }
    function memoizeState(workInProgress, nextState) {
        workInProgress.memoizedState = nextState;
    }
    function beginWork(current$$1, workInProgress, priorityLevel) {
        if (workInProgress.pendingWorkPriority === NoWork$3 || workInProgress.pendingWorkPriority > priorityLevel) return bailoutOnLowPriority(current$$1, workInProgress);
        switch (workInProgress.tag) {
          case IndeterminateComponent$2:
            return mountIndeterminateComponent(current$$1, workInProgress, priorityLevel);

          case FunctionalComponent$1:
            return updateFunctionalComponent(current$$1, workInProgress);

          case ClassComponent$6:
            return updateClassComponent(current$$1, workInProgress, priorityLevel);

          case HostRoot$5:
            return updateHostRoot(current$$1, workInProgress, priorityLevel);

          case HostComponent$5:
            return updateHostComponent(current$$1, workInProgress, priorityLevel);

          case HostText$2:
            return updateHostText(current$$1, workInProgress);

          case CoroutineHandlerPhase:
            // This is a restart. Reset the tag to the initial phase.
            workInProgress.tag = CoroutineComponent$1;

          // Intentionally fall through since this is now the same.
            case CoroutineComponent$1:
            return updateCoroutineComponent(current$$1, workInProgress);

          case YieldComponent$1:
            // A yield component is just a placeholder, we can just run through the
            // next one immediately.
            return null;

          case HostPortal$2:
            return updatePortalComponent(current$$1, workInProgress);

          case Fragment$1:
            return updateFragment(current$$1, workInProgress);

          default:
            invariant(!1, "Unknown unit of work tag. This error is likely caused by a bug in " + "React. Please file an issue.");
        }
    }
    function beginFailedWork(current$$1, workInProgress, priorityLevel) {
        if (invariant(workInProgress.tag === ClassComponent$6 || workInProgress.tag === HostRoot$5, "Invalid type of work. This error is likely caused by a bug in React. " + "Please file an issue."), 
        // Add an error effect so we can handle the error during the commit phase
        workInProgress.effectTag |= Err$1, // This is a weird case where we do "resume" work — work that failed on
        // our first attempt. Because we no longer have a notion of "progressed
        // deletions," reset the child to the current child to make sure we delete
        // it again. TODO: Find a better way to handle this, perhaps during a more
        // general overhaul of error handling.
        null === current$$1 ? workInProgress.child = null : workInProgress.child !== current$$1.child && (workInProgress.child = current$$1.child), 
        workInProgress.pendingWorkPriority === NoWork$3 || workInProgress.pendingWorkPriority > priorityLevel) return bailoutOnLowPriority(current$$1, workInProgress);
        if (// If we don't bail out, we're going be recomputing our children so we need
        // to drop our effect list.
        workInProgress.firstEffect = null, workInProgress.lastEffect = null, reconcileChildrenAtPriority(current$$1, workInProgress, null, priorityLevel), 
        workInProgress.tag === ClassComponent$6) {
            var instance = workInProgress.stateNode;
            workInProgress.memoizedProps = instance.props, workInProgress.memoizedState = instance.state;
        }
        return workInProgress.child;
    }
    return {
        beginWork: beginWork,
        beginFailedWork: beginFailedWork
    };
}, reconcileChildFibers$2 = ReactChildFiber.reconcileChildFibers, popContextProvider$2 = ReactFiberContext.popContextProvider, IndeterminateComponent$3 = ReactTypeOfWork.IndeterminateComponent, FunctionalComponent$3 = ReactTypeOfWork.FunctionalComponent, ClassComponent$8 = ReactTypeOfWork.ClassComponent, HostRoot$6 = ReactTypeOfWork.HostRoot, HostComponent$6 = ReactTypeOfWork.HostComponent, HostText$4 = ReactTypeOfWork.HostText, HostPortal$4 = ReactTypeOfWork.HostPortal, CoroutineComponent$3 = ReactTypeOfWork.CoroutineComponent, CoroutineHandlerPhase$1 = ReactTypeOfWork.CoroutineHandlerPhase, YieldComponent$3 = ReactTypeOfWork.YieldComponent, Fragment$3 = ReactTypeOfWork.Fragment, Placement$4 = ReactTypeOfSideEffect.Placement, Ref$2 = ReactTypeOfSideEffect.Ref, Update$2 = ReactTypeOfSideEffect.Update, OffscreenPriority$2 = ReactPriorityLevel.OffscreenPriority, ReactFiberCompleteWork = function(config, hostContext, hydrationContext) {
    var createInstance = config.createInstance, createTextInstance = config.createTextInstance, appendInitialChild = config.appendInitialChild, finalizeInitialChildren = config.finalizeInitialChildren, prepareUpdate = config.prepareUpdate, getRootHostContainer = hostContext.getRootHostContainer, popHostContext = hostContext.popHostContext, getHostContext = hostContext.getHostContext, popHostContainer = hostContext.popHostContainer, prepareToHydrateHostInstance = hydrationContext.prepareToHydrateHostInstance, prepareToHydrateHostTextInstance = hydrationContext.prepareToHydrateHostTextInstance, popHydrationState = hydrationContext.popHydrationState;
    function markUpdate(workInProgress) {
        // Tag the fiber with an update effect. This turns a Placement into
        // an UpdateAndPlacement.
        workInProgress.effectTag |= Update$2;
    }
    function markRef(workInProgress) {
        workInProgress.effectTag |= Ref$2;
    }
    function appendAllYields(yields, workInProgress) {
        var node = workInProgress.stateNode;
        for (node && (node.return = workInProgress); null !== node; ) {
            if (node.tag === HostComponent$6 || node.tag === HostText$4 || node.tag === HostPortal$4) invariant(!1, "A coroutine cannot have host component children."); else if (node.tag === YieldComponent$3) yields.push(node.type); else if (null !== node.child) {
                node.child.return = node, node = node.child;
                continue;
            }
            for (;null === node.sibling; ) {
                if (null === node.return || node.return === workInProgress) return;
                node = node.return;
            }
            node.sibling.return = node.return, node = node.sibling;
        }
    }
    function moveCoroutineToHandlerPhase(current$$1, workInProgress) {
        var coroutine = workInProgress.memoizedProps;
        invariant(coroutine, "Should be resolved by now. This error is likely caused by a bug in " + "React. Please file an issue."), 
        // First step of the coroutine has completed. Now we need to do the second.
        // TODO: It would be nice to have a multi stage coroutine represented by a
        // single component, or at least tail call optimize nested ones. Currently
        // that requires additional fields that we don't want to add to the fiber.
        // So this requires nested handlers.
        // Note: This doesn't mutate the alternate node. I don't think it needs to
        // since this stage is reset for every pass.
        workInProgress.tag = CoroutineHandlerPhase$1;
        // Build up the yields.
        // TODO: Compare this to a generator or opaque helpers like Children.
        var yields = [];
        appendAllYields(yields, workInProgress);
        var fn = coroutine.handler, props = coroutine.props, nextChildren = fn(props, yields), currentFirstChild = null !== current$$1 ? current$$1.child : null, priority = workInProgress.pendingWorkPriority;
        return workInProgress.child = reconcileChildFibers$2(workInProgress, currentFirstChild, nextChildren, priority), 
        workInProgress.child;
    }
    function appendAllChildren(parent, workInProgress) {
        for (// We only have the top Fiber that was created but we need recurse down its
        // children to find all the terminal nodes.
        var node = workInProgress.child; null !== node; ) {
            if (node.tag === HostComponent$6 || node.tag === HostText$4) appendInitialChild(parent, node.stateNode); else if (node.tag === HostPortal$4) ; else if (null !== node.child) {
                node = node.child;
                continue;
            }
            if (node === workInProgress) return;
            for (;null === node.sibling; ) {
                if (null === node.return || node.return === workInProgress) return;
                node = node.return;
            }
            node = node.sibling;
        }
    }
    function completeWork(current$$1, workInProgress, renderPriority) {
        var newProps = workInProgress.pendingProps;
        switch (null === newProps ? newProps = workInProgress.memoizedProps : workInProgress.pendingWorkPriority === OffscreenPriority$2 && renderPriority !== OffscreenPriority$2 || (// Reset the pending props, unless this was a down-prioritization.
        workInProgress.pendingProps = null), workInProgress.tag) {
          case FunctionalComponent$3:
            return null;

          case ClassComponent$8:
            // We are leaving this subtree, so pop context if any.
            return popContextProvider$2(workInProgress), null;

          case HostRoot$6:
            // TODO: Pop the host container after #8607 lands.
            var fiberRoot = workInProgress.stateNode;
            // If we hydrated, pop so that we can delete any remaining children
            // that weren't hydrated.
            // This resets the hacky state to fix isMounted before committing.
            // TODO: Delete this when we delete isMounted and findDOMNode.
            return fiberRoot.pendingContext && (fiberRoot.context = fiberRoot.pendingContext, 
            fiberRoot.pendingContext = null), null !== current$$1 && null !== current$$1.child || (popHydrationState(workInProgress), 
            workInProgress.effectTag &= ~Placement$4), null;

          case HostComponent$6:
            popHostContext(workInProgress);
            var rootContainerInstance = getRootHostContainer(), type = workInProgress.type;
            if (null !== current$$1 && null != workInProgress.stateNode) {
                // If we have an alternate, that means this is an update and we need to
                // schedule a side-effect to do the updates.
                var oldProps = current$$1.memoizedProps, instance = workInProgress.stateNode, currentHostContext = getHostContext(), updatePayload = prepareUpdate(instance, type, oldProps, newProps, rootContainerInstance, currentHostContext);
                // TODO: Type this specific to this type of component.
                workInProgress.updateQueue = updatePayload, // If the update payload indicates that there is a change or if there
                // is a new ref we mark this as an update.
                updatePayload && markUpdate(workInProgress), current$$1.ref !== workInProgress.ref && markRef(workInProgress);
            } else {
                if (!newProps) // This can happen when we abort work.
                return invariant(null !== workInProgress.stateNode, "We must have new props for new mounts. This error is likely " + "caused by a bug in React. Please file an issue."), 
                null;
                var _currentHostContext = getHostContext();
                if (popHydrationState(workInProgress)) // TOOD: Move this and createInstance step into the beginPhase
                // to consolidate.
                prepareToHydrateHostInstance(workInProgress, rootContainerInstance) && // If changes to the hydrated node needs to be applied at the
                // commit-phase we mark this as such.
                markUpdate(workInProgress); else {
                    var _instance = createInstance(type, newProps, rootContainerInstance, _currentHostContext, workInProgress);
                    appendAllChildren(_instance, workInProgress), // Certain renderers require commit-time effects for initial mount.
                    // (eg DOM renderer supports auto-focus for certain elements).
                    // Make sure such renderers get scheduled for later work.
                    finalizeInitialChildren(_instance, type, newProps, rootContainerInstance) && markUpdate(workInProgress), 
                    workInProgress.stateNode = _instance;
                }
                null !== workInProgress.ref && // If there is a ref on a host node we need to schedule a callback
                markRef(workInProgress);
            }
            return null;

          case HostText$4:
            var newText = newProps;
            if (current$$1 && null != workInProgress.stateNode) {
                // If we have an alternate, that means this is an update and we need
                // to schedule a side-effect to do the updates.
                current$$1.memoizedProps !== newText && markUpdate(workInProgress);
            } else {
                if ("string" != typeof newText) // This can happen when we abort work.
                return invariant(null !== workInProgress.stateNode, "We must have new props for new mounts. This error is likely " + "caused by a bug in React. Please file an issue."), 
                null;
                var _rootContainerInstance = getRootHostContainer(), _currentHostContext2 = getHostContext();
                popHydrationState(workInProgress) ? prepareToHydrateHostTextInstance(workInProgress) && markUpdate(workInProgress) : workInProgress.stateNode = createTextInstance(newText, _rootContainerInstance, _currentHostContext2, workInProgress);
            }
            return null;

          case CoroutineComponent$3:
            return moveCoroutineToHandlerPhase(current$$1, workInProgress);

          case CoroutineHandlerPhase$1:
            // Reset the tag to now be a first phase coroutine.
            return workInProgress.tag = CoroutineComponent$3, null;

          case YieldComponent$3:
          case Fragment$3:
            return null;

          case HostPortal$4:
            // TODO: Only mark this as an update if we have any pending callbacks.
            return markUpdate(workInProgress), popHostContainer(workInProgress), null;

          // Error cases
            case IndeterminateComponent$3:
            invariant(!1, "An indeterminate component should have become determinate before " + "completing. This error is likely caused by a bug in React. Please " + "file an issue.");

          // eslint-disable-next-line no-fallthrough
            default:
            invariant(!1, "Unknown unit of work tag. This error is likely caused by a bug in " + "React. Please file an issue.");
        }
    }
    return {
        completeWork: completeWork
    };
}, rendererID = null, injectInternals = null, onCommitRoot$1 = null, onCommitUnmount$1 = null;

if ("undefined" != typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && __REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber) {
    var inject = __REACT_DEVTOOLS_GLOBAL_HOOK__.inject, onCommitFiberRoot = __REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot, onCommitFiberUnmount = __REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberUnmount;
    injectInternals = function(internals) {
        warning(null == rendererID, "Cannot inject into DevTools twice."), rendererID = inject(internals);
    }, onCommitRoot$1 = function(root) {
        if (null != rendererID) try {
            onCommitFiberRoot(rendererID, root);
        } catch (err) {}
    }, onCommitUnmount$1 = function(fiber) {
        if (null != rendererID) try {
            onCommitFiberUnmount(rendererID, fiber);
        } catch (err) {}
    };
}

var injectInternals_1 = injectInternals, onCommitRoot_1 = onCommitRoot$1, onCommitUnmount_1 = onCommitUnmount$1, ReactFiberDevToolsHook = {
    injectInternals: injectInternals_1,
    onCommitRoot: onCommitRoot_1,
    onCommitUnmount: onCommitUnmount_1
}, ClassComponent$9 = ReactTypeOfWork.ClassComponent, HostRoot$7 = ReactTypeOfWork.HostRoot, HostComponent$7 = ReactTypeOfWork.HostComponent, HostText$5 = ReactTypeOfWork.HostText, HostPortal$5 = ReactTypeOfWork.HostPortal, CoroutineComponent$4 = ReactTypeOfWork.CoroutineComponent, commitCallbacks$1 = ReactFiberUpdateQueue.commitCallbacks, onCommitUnmount = ReactFiberDevToolsHook.onCommitUnmount, Placement$5 = ReactTypeOfSideEffect.Placement, Update$3 = ReactTypeOfSideEffect.Update, Callback$1 = ReactTypeOfSideEffect.Callback, ContentReset$2 = ReactTypeOfSideEffect.ContentReset, ReactFiberCommitWork = function(config, captureError) {
    var commitMount = config.commitMount, commitUpdate = config.commitUpdate, resetTextContent = config.resetTextContent, commitTextUpdate = config.commitTextUpdate, appendChild = config.appendChild, appendChildToContainer = config.appendChildToContainer, insertBefore = config.insertBefore, insertInContainerBefore = config.insertInContainerBefore, removeChild = config.removeChild, removeChildFromContainer = config.removeChildFromContainer, getPublicInstance = config.getPublicInstance;
    function safelyCallComponentWillUnmount(current$$1, instance) {
        try {
            instance.componentWillUnmount();
        } catch (unmountError) {
            captureError(current$$1, unmountError);
        }
    }
    function safelyDetachRef(current$$1) {
        var ref = current$$1.ref;
        if (null !== ref) {
            try {
                ref(null);
            } catch (refError) {
                captureError(current$$1, refError);
            }
        }
    }
    function getHostParentFiber(fiber) {
        for (var parent = fiber.return; null !== parent; ) {
            if (isHostParent(parent)) return parent;
            parent = parent.return;
        }
        invariant(!1, "Expected to find a host parent. This error is likely caused by a bug " + "in React. Please file an issue.");
    }
    function isHostParent(fiber) {
        return fiber.tag === HostComponent$7 || fiber.tag === HostRoot$7 || fiber.tag === HostPortal$5;
    }
    function getHostSibling(fiber) {
        // We're going to search forward into the tree until we find a sibling host
        // node. Unfortunately, if multiple insertions are done in a row we have to
        // search past them. This leads to exponential search for the next sibling.
        var node = fiber;
        siblings: for (;!0; ) {
            // If we didn't find anything, let's try the next sibling.
            for (;null === node.sibling; ) {
                if (null === node.return || isHostParent(node.return)) // If we pop out of the root or hit the parent the fiber we are the
                // last sibling.
                return null;
                node = node.return;
            }
            for (node.sibling.return = node.return, node = node.sibling; node.tag !== HostComponent$7 && node.tag !== HostText$5; ) {
                // If it is not host node and, we might have a host node inside it.
                // Try to search down until we find one.
                if (node.effectTag & Placement$5) // If we don't have a child, try the siblings instead.
                continue siblings;
                // If we don't have a child, try the siblings instead.
                // We also skip portals because they are not part of this host tree.
                if (null === node.child || node.tag === HostPortal$5) continue siblings;
                node.child.return = node, node = node.child;
            }
            // Check if this host node is stable or about to be placed.
            if (!(node.effectTag & Placement$5)) // Found it!
            return node.stateNode;
        }
    }
    function commitPlacement(finishedWork) {
        // Recursively insert all host nodes into the parent.
        var parentFiber = getHostParentFiber(finishedWork), parent = void 0, isContainer = void 0;
        switch (parentFiber.tag) {
          case HostComponent$7:
            parent = parentFiber.stateNode, isContainer = !1;
            break;

          case HostRoot$7:
          case HostPortal$5:
            parent = parentFiber.stateNode.containerInfo, isContainer = !0;
            break;

          default:
            invariant(!1, "Invalid host parent fiber. This error is likely caused by a bug " + "in React. Please file an issue.");
        }
        parentFiber.effectTag & ContentReset$2 && (// Reset the text content of the parent before doing any insertions
        resetTextContent(parent), // Clear ContentReset from the effect tag
        parentFiber.effectTag &= ~ContentReset$2);
        for (var before = getHostSibling(finishedWork), node = finishedWork; !0; ) {
            if (node.tag === HostComponent$7 || node.tag === HostText$5) before ? isContainer ? insertInContainerBefore(parent, node.stateNode, before) : insertBefore(parent, node.stateNode, before) : isContainer ? appendChildToContainer(parent, node.stateNode) : appendChild(parent, node.stateNode); else if (node.tag === HostPortal$5) ; else if (null !== node.child) {
                node.child.return = node, node = node.child;
                continue;
            }
            if (node === finishedWork) return;
            for (;null === node.sibling; ) {
                if (null === node.return || node.return === finishedWork) return;
                node = node.return;
            }
            node.sibling.return = node.return, node = node.sibling;
        }
    }
    function commitNestedUnmounts(root) {
        for (// While we're inside a removed host node we don't want to call
        // removeChild on the inner nodes because they're removed by the top
        // call anyway. We also want to call componentWillUnmount on all
        // composites before this host node is removed from the tree. Therefore
        var node = root; !0; ) // Visit children because they may contain more composite or host nodes.
        // Skip portals because commitUnmount() currently visits them recursively.
        if (commitUnmount(node), null === node.child || node.tag === HostPortal$5) {
            if (node === root) return;
            for (;null === node.sibling; ) {
                if (null === node.return || node.return === root) return;
                node = node.return;
            }
            node.sibling.return = node.return, node = node.sibling;
        } else node.child.return = node, node = node.child;
    }
    function unmountHostComponents(current$$1) {
        for (// We only have the top Fiber that was inserted but we need recurse down its
        var node = current$$1, currentParentIsValid = !1, currentParent = void 0, currentParentIsContainer = void 0; !0; ) {
            if (!currentParentIsValid) {
                var parent = node.return;
                findParent: for (;!0; ) {
                    switch (invariant(null !== parent, "Expected to find a host parent. This error is likely caused by " + "a bug in React. Please file an issue."), 
                    parent.tag) {
                      case HostComponent$7:
                        currentParent = parent.stateNode, currentParentIsContainer = !1;
                        break findParent;

                      case HostRoot$7:
                      case HostPortal$5:
                        currentParent = parent.stateNode.containerInfo, currentParentIsContainer = !0;
                        break findParent;
                    }
                    parent = parent.return;
                }
                currentParentIsValid = !0;
            }
            if (node.tag === HostComponent$7 || node.tag === HostText$5) commitNestedUnmounts(node), 
            // After all the children have unmounted, it is now safe to remove the
            // node from the tree.
            currentParentIsContainer ? removeChildFromContainer(currentParent, node.stateNode) : removeChild(currentParent, node.stateNode); else if (node.tag === HostPortal$5) {
                // Visit children because portals might contain host components.
                if (// When we go into a portal, it becomes the parent to remove from.
                // We will reassign it back when we pop the portal on the way up.
                currentParent = node.stateNode.containerInfo, null !== node.child) {
                    node.child.return = node, node = node.child;
                    continue;
                }
            } else // Visit children because we may find more host components below.
            if (commitUnmount(node), null !== node.child) {
                node.child.return = node, node = node.child;
                continue;
            }
            if (node === current$$1) return;
            for (;null === node.sibling; ) {
                if (null === node.return || node.return === current$$1) return;
                node = node.return, node.tag === HostPortal$5 && (// When we go out of the portal, we need to restore the parent.
                // Since we don't keep a stack of them, we will search for it.
                currentParentIsValid = !1);
            }
            node.sibling.return = node.return, node = node.sibling;
        }
    }
    function commitDeletion(current$$1) {
        // Recursively delete all host nodes from the parent.
        // Detach refs and call componentWillUnmount() on the whole subtree.
        unmountHostComponents(current$$1), // Cut off the return pointers to disconnect it from the tree. Ideally, we
        // should clear the child pointer of the parent alternate to let this
        // get GC:ed but we don't know which for sure which parent is the current
        // one so we'll settle for GC:ing the subtree of this child. This child
        // itself will be GC:ed when the parent updates the next time.
        current$$1.return = null, current$$1.child = null, current$$1.alternate && (current$$1.alternate.child = null, 
        current$$1.alternate.return = null);
    }
    // User-originating errors (lifecycles and refs) should not interrupt
    // deletion, so don't let them throw. Host-originating errors should
    // interrupt deletion, so it's okay
    function commitUnmount(current$$1) {
        switch ("function" == typeof onCommitUnmount && onCommitUnmount(current$$1), current$$1.tag) {
          case ClassComponent$9:
            safelyDetachRef(current$$1);
            var instance = current$$1.stateNode;
            return void ("function" == typeof instance.componentWillUnmount && safelyCallComponentWillUnmount(current$$1, instance));

          case HostComponent$7:
            return void safelyDetachRef(current$$1);

          case CoroutineComponent$4:
            return void commitNestedUnmounts(current$$1.stateNode);

          case HostPortal$5:
            // TODO: this is recursive.
            // We are also not using this parent because
            // the portal will get pushed immediately.
            return void unmountHostComponents(current$$1);
        }
    }
    function commitWork(current$$1, finishedWork) {
        switch (finishedWork.tag) {
          case ClassComponent$9:
            return;

          case HostComponent$7:
            var instance = finishedWork.stateNode;
            if (null != instance) {
                // Commit the work prepared earlier.
                var newProps = finishedWork.memoizedProps, oldProps = null !== current$$1 ? current$$1.memoizedProps : newProps, type = finishedWork.type, updatePayload = finishedWork.updateQueue;
                finishedWork.updateQueue = null, null !== updatePayload && commitUpdate(instance, updatePayload, type, oldProps, newProps, finishedWork);
            }
            return;

          case HostText$5:
            invariant(null !== finishedWork.stateNode, "This should have a text node initialized. This error is likely " + "caused by a bug in React. Please file an issue.");
            var textInstance = finishedWork.stateNode, newText = finishedWork.memoizedProps, oldText = null !== current$$1 ? current$$1.memoizedProps : newText;
            return void commitTextUpdate(textInstance, oldText, newText);

          case HostRoot$7:
          case HostPortal$5:
            return;

          default:
            invariant(!1, "This unit of work tag should not have side-effects. This error is " + "likely caused by a bug in React. Please file an issue.");
        }
    }
    function commitLifeCycles(current$$1, finishedWork) {
        switch (finishedWork.tag) {
          case ClassComponent$9:
            var instance = finishedWork.stateNode;
            if (finishedWork.effectTag & Update$3) if (null === current$$1) instance.componentDidMount(); else {
                var prevProps = current$$1.memoizedProps, prevState = current$$1.memoizedState;
                instance.componentDidUpdate(prevProps, prevState);
            }
            return void (finishedWork.effectTag & Callback$1 && null !== finishedWork.updateQueue && commitCallbacks$1(finishedWork, finishedWork.updateQueue, instance));

          case HostRoot$7:
            var updateQueue = finishedWork.updateQueue;
            if (null !== updateQueue) {
                var _instance = finishedWork.child && finishedWork.child.stateNode;
                commitCallbacks$1(finishedWork, updateQueue, _instance);
            }
            return;

          case HostComponent$7:
            var _instance2 = finishedWork.stateNode;
            // Renderers may schedule work to be done after host components are mounted
            // (eg DOM renderer may schedule auto-focus for inputs and form controls).
            // These effects should only be committed when components are first mounted,
            // aka when there is no current/alternate.
            if (null === current$$1 && finishedWork.effectTag & Update$3) {
                var type = finishedWork.type, props = finishedWork.memoizedProps;
                commitMount(_instance2, type, props, finishedWork);
            }
            return;

          case HostText$5:
          case HostPortal$5:
            // We have no life-cycles associated with portals.
            return;

          default:
            invariant(!1, "This unit of work tag should not have side-effects. This error is " + "likely caused by a bug in React. Please file an issue.");
        }
    }
    function commitAttachRef(finishedWork) {
        var ref = finishedWork.ref;
        if (null !== ref) {
            var instance = finishedWork.stateNode;
            switch (finishedWork.tag) {
              case HostComponent$7:
                ref(getPublicInstance(instance));
                break;

              default:
                ref(instance);
            }
        }
    }
    function commitDetachRef(current$$1) {
        var currentRef = current$$1.ref;
        null !== currentRef && currentRef(null);
    }
    return {
        commitPlacement: commitPlacement,
        commitDeletion: commitDeletion,
        commitWork: commitWork,
        commitLifeCycles: commitLifeCycles,
        commitAttachRef: commitAttachRef,
        commitDetachRef: commitDetachRef
    };
}, createCursor$2 = ReactFiberStack.createCursor, pop$2 = ReactFiberStack.pop, push$2 = ReactFiberStack.push, NO_CONTEXT = {}, ReactFiberHostContext = function(config) {
    var getChildHostContext = config.getChildHostContext, getRootHostContext = config.getRootHostContext, contextStackCursor = createCursor$2(NO_CONTEXT), contextFiberStackCursor = createCursor$2(NO_CONTEXT), rootInstanceStackCursor = createCursor$2(NO_CONTEXT);
    function requiredContext(c) {
        return invariant(c !== NO_CONTEXT, "Expected host context to exist. This error is likely caused by a bug " + "in React. Please file an issue."), 
        c;
    }
    function getRootHostContainer() {
        return requiredContext(rootInstanceStackCursor.current);
    }
    function pushHostContainer(fiber, nextRootInstance) {
        // Push current root instance onto the stack;
        // This allows us to reset root when portals are popped.
        push$2(rootInstanceStackCursor, nextRootInstance, fiber);
        var nextRootContext = getRootHostContext(nextRootInstance);
        // Track the context and the Fiber that provided it.
        // This enables us to pop only Fibers that provide unique contexts.
        push$2(contextFiberStackCursor, fiber, fiber), push$2(contextStackCursor, nextRootContext, fiber);
    }
    function popHostContainer(fiber) {
        pop$2(contextStackCursor, fiber), pop$2(contextFiberStackCursor, fiber), pop$2(rootInstanceStackCursor, fiber);
    }
    function getHostContext() {
        return requiredContext(contextStackCursor.current);
    }
    function pushHostContext(fiber) {
        var rootInstance = requiredContext(rootInstanceStackCursor.current), context = requiredContext(contextStackCursor.current), nextContext = getChildHostContext(context, fiber.type, rootInstance);
        // Don't push this Fiber's context unless it's unique.
        context !== nextContext && (// Track the context and the Fiber that provided it.
        // This enables us to pop only Fibers that provide unique contexts.
        push$2(contextFiberStackCursor, fiber, fiber), push$2(contextStackCursor, nextContext, fiber));
    }
    function popHostContext(fiber) {
        // Do not pop unless this Fiber provided the current context.
        // pushHostContext() only pushes Fibers that provide unique contexts.
        contextFiberStackCursor.current === fiber && (pop$2(contextStackCursor, fiber), 
        pop$2(contextFiberStackCursor, fiber));
    }
    function resetHostContainer() {
        contextStackCursor.current = NO_CONTEXT, rootInstanceStackCursor.current = NO_CONTEXT;
    }
    return {
        getHostContext: getHostContext,
        getRootHostContainer: getRootHostContainer,
        popHostContainer: popHostContainer,
        popHostContext: popHostContext,
        pushHostContainer: pushHostContainer,
        pushHostContext: pushHostContext,
        resetHostContainer: resetHostContainer
    };
}, HostComponent$8 = ReactTypeOfWork.HostComponent, HostText$6 = ReactTypeOfWork.HostText, HostRoot$8 = ReactTypeOfWork.HostRoot, Deletion$2 = ReactTypeOfSideEffect.Deletion, Placement$6 = ReactTypeOfSideEffect.Placement, createFiberFromHostInstanceForDeletion$1 = ReactFiber.createFiberFromHostInstanceForDeletion, ReactFiberHydrationContext = function(config) {
    var shouldSetTextContent = config.shouldSetTextContent, canHydrateInstance = config.canHydrateInstance, canHydrateTextInstance = config.canHydrateTextInstance, getNextHydratableSibling = config.getNextHydratableSibling, getFirstHydratableChild = config.getFirstHydratableChild, hydrateInstance = config.hydrateInstance, hydrateTextInstance = config.hydrateTextInstance, didNotHydrateInstance = config.didNotHydrateInstance, didNotFindHydratableInstance = config.didNotFindHydratableInstance, didNotFindHydratableTextInstance = config.didNotFindHydratableTextInstance;
    // If this doesn't have hydration mode.
    if (!(canHydrateInstance && canHydrateTextInstance && getNextHydratableSibling && getFirstHydratableChild && hydrateInstance && hydrateTextInstance && didNotHydrateInstance && didNotFindHydratableInstance && didNotFindHydratableTextInstance)) return {
        enterHydrationState: function() {
            return !1;
        },
        resetHydrationState: function() {},
        tryToClaimNextHydratableInstance: function() {},
        prepareToHydrateHostInstance: function() {
            invariant(!1, "React bug.");
        },
        prepareToHydrateHostTextInstance: function() {
            invariant(!1, "React bug.");
        },
        popHydrationState: function(fiber) {
            return !1;
        }
    };
    // The deepest Fiber on the stack involved in a hydration context.
    // This may have been an insertion or a hydration.
    var hydrationParentFiber = null, nextHydratableInstance = null, isHydrating = !1;
    function enterHydrationState(fiber) {
        var parentInstance = fiber.stateNode.containerInfo;
        return nextHydratableInstance = getFirstHydratableChild(parentInstance), hydrationParentFiber = fiber, 
        isHydrating = !0, !0;
    }
    function deleteHydratableInstance(returnFiber, instance) {
        var childToDelete = createFiberFromHostInstanceForDeletion$1();
        childToDelete.stateNode = instance, childToDelete.return = returnFiber, childToDelete.effectTag = Deletion$2, 
        // This might seem like it belongs on progressedFirstDeletion. However,
        // these children are not part of the reconciliation list of children.
        // Even if we abort and rereconcile the children, that will try to hydrate
        // again and the nodes are still in the host tree so these will be
        // recreated.
        null !== returnFiber.lastEffect ? (returnFiber.lastEffect.nextEffect = childToDelete, 
        returnFiber.lastEffect = childToDelete) : returnFiber.firstEffect = returnFiber.lastEffect = childToDelete;
    }
    function insertNonHydratedInstance(returnFiber, fiber) {
        fiber.effectTag |= Placement$6;
    }
    function canHydrate(fiber, nextInstance) {
        switch (fiber.tag) {
          case HostComponent$8:
            var type = fiber.type, props = fiber.pendingProps;
            return canHydrateInstance(nextInstance, type, props);

          case HostText$6:
            var text = fiber.pendingProps;
            return canHydrateTextInstance(nextInstance, text);

          default:
            return !1;
        }
    }
    function tryToClaimNextHydratableInstance(fiber) {
        if (isHydrating) {
            var nextInstance = nextHydratableInstance;
            if (!nextInstance) // Nothing to hydrate. Make it an insertion.
            return insertNonHydratedInstance(hydrationParentFiber, fiber), isHydrating = !1, 
            void (hydrationParentFiber = fiber);
            if (!canHydrate(fiber, nextInstance)) {
                if (!(// If we can't hydrate this instance let's try the next one.
                // We use this as a heuristic. It's based on intuition and not data so it
                // might be flawed or unnecessary.
                nextInstance = getNextHydratableSibling(nextInstance)) || !canHydrate(fiber, nextInstance)) // Nothing to hydrate. Make it an insertion.
                return insertNonHydratedInstance(hydrationParentFiber, fiber), isHydrating = !1, 
                void (hydrationParentFiber = fiber);
                // We matched the next one, we'll now assume that the first one was
                // superfluous and we'll delete it. Since we can't eagerly delete it
                // we'll have to schedule a deletion. To do that, this node needs a dummy
                // fiber associated with it.
                deleteHydratableInstance(hydrationParentFiber, nextHydratableInstance);
            }
            fiber.stateNode = nextInstance, hydrationParentFiber = fiber, nextHydratableInstance = getFirstHydratableChild(nextInstance);
        }
    }
    function prepareToHydrateHostInstance(fiber, rootContainerInstance) {
        var instance = fiber.stateNode, updatePayload = hydrateInstance(instance, fiber.type, fiber.memoizedProps, rootContainerInstance, fiber);
        // If the update payload indicates that there is a change or if there
        // is a new ref we mark this as an update.
        // TODO: Type this specific to this type of component.
        return fiber.updateQueue = updatePayload, null !== updatePayload;
    }
    function prepareToHydrateHostTextInstance(fiber) {
        var textInstance = fiber.stateNode;
        return hydrateTextInstance(textInstance, fiber.memoizedProps, fiber);
    }
    function popToNextHostParent(fiber) {
        for (var parent = fiber.return; null !== parent && parent.tag !== HostComponent$8 && parent.tag !== HostRoot$8; ) parent = parent.return;
        hydrationParentFiber = parent;
    }
    function popHydrationState(fiber) {
        if (fiber !== hydrationParentFiber) // We're deeper than the current hydration context, inside an inserted
        // tree.
        return !1;
        if (!isHydrating) // If we're not currently hydrating but we're in a hydration context, then
        // we were an insertion and now need to pop up reenter hydration of our
        // siblings.
        return popToNextHostParent(fiber), isHydrating = !0, !1;
        var type = fiber.type;
        // If we have any remaining hydratable nodes, we need to delete them now.
        // We only do this deeper than head and body since they tend to have random
        // other nodes in them. We also ignore components with pure text content in
        // side of them.
        // TODO: Better heuristic.
        if (fiber.tag !== HostComponent$8 || "head" !== type && "body" !== type && !shouldSetTextContent(type, fiber.memoizedProps)) for (var nextInstance = nextHydratableInstance; nextInstance; ) deleteHydratableInstance(fiber, nextInstance), 
        nextInstance = getNextHydratableSibling(nextInstance);
        return popToNextHostParent(fiber), nextHydratableInstance = hydrationParentFiber ? getNextHydratableSibling(fiber.stateNode) : null, 
        !0;
    }
    function resetHydrationState() {
        hydrationParentFiber = null, nextHydratableInstance = null, isHydrating = !1;
    }
    return {
        enterHydrationState: enterHydrationState,
        resetHydrationState: resetHydrationState,
        tryToClaimNextHydratableInstance: tryToClaimNextHydratableInstance,
        prepareToHydrateHostInstance: prepareToHydrateHostInstance,
        prepareToHydrateHostTextInstance: prepareToHydrateHostTextInstance,
        popHydrationState: popHydrationState
    };
}, popContextProvider$1 = ReactFiberContext.popContextProvider, reset$1 = ReactFiberStack.reset, getStackAddendumByWorkInProgressFiber = ReactFiberComponentTreeHook.getStackAddendumByWorkInProgressFiber, logCapturedError = ReactFiberErrorLogger.logCapturedError, ReactCurrentOwner$1 = ReactGlobalSharedState_1.ReactCurrentOwner, createWorkInProgress$1 = ReactFiber.createWorkInProgress, largerPriority$1 = ReactFiber.largerPriority, onCommitRoot = ReactFiberDevToolsHook.onCommitRoot, NoWork$2 = ReactPriorityLevel.NoWork, SynchronousPriority$1 = ReactPriorityLevel.SynchronousPriority, TaskPriority$1 = ReactPriorityLevel.TaskPriority, HighPriority = ReactPriorityLevel.HighPriority, LowPriority = ReactPriorityLevel.LowPriority, OffscreenPriority = ReactPriorityLevel.OffscreenPriority, AsyncUpdates = ReactTypeOfInternalContext.AsyncUpdates, PerformedWork = ReactTypeOfSideEffect.PerformedWork, Placement$1 = ReactTypeOfSideEffect.Placement, Update = ReactTypeOfSideEffect.Update, PlacementAndUpdate = ReactTypeOfSideEffect.PlacementAndUpdate, Deletion = ReactTypeOfSideEffect.Deletion, ContentReset = ReactTypeOfSideEffect.ContentReset, Callback = ReactTypeOfSideEffect.Callback, Err = ReactTypeOfSideEffect.Err, Ref = ReactTypeOfSideEffect.Ref, HostRoot$4 = ReactTypeOfWork.HostRoot, HostComponent$3 = ReactTypeOfWork.HostComponent, HostPortal$1 = ReactTypeOfWork.HostPortal, ClassComponent$4 = ReactTypeOfWork.ClassComponent, getUpdatePriority$1 = ReactFiberUpdateQueue.getUpdatePriority, _require14 = ReactFiberContext, resetContext$1 = _require14.resetContext, ReactFiberInstrumentation$1, timeHeuristicForUnitOfWork = 1, ReactFiberScheduler = function(config) {
    var hostContext = ReactFiberHostContext(config), hydrationContext = ReactFiberHydrationContext(config), popHostContainer = hostContext.popHostContainer, popHostContext = hostContext.popHostContext, resetHostContainer = hostContext.resetHostContainer, _ReactFiberBeginWork = ReactFiberBeginWork(config, hostContext, hydrationContext, scheduleUpdate, getPriorityContext), beginWork = _ReactFiberBeginWork.beginWork, beginFailedWork = _ReactFiberBeginWork.beginFailedWork, _ReactFiberCompleteWo = ReactFiberCompleteWork(config, hostContext, hydrationContext), completeWork = _ReactFiberCompleteWo.completeWork, _ReactFiberCommitWork = ReactFiberCommitWork(config, captureError), commitPlacement = _ReactFiberCommitWork.commitPlacement, commitDeletion = _ReactFiberCommitWork.commitDeletion, commitWork = _ReactFiberCommitWork.commitWork, commitLifeCycles = _ReactFiberCommitWork.commitLifeCycles, commitAttachRef = _ReactFiberCommitWork.commitAttachRef, commitDetachRef = _ReactFiberCommitWork.commitDetachRef, scheduleDeferredCallback = config.scheduleDeferredCallback, useSyncScheduling = config.useSyncScheduling, prepareForCommit = config.prepareForCommit, resetAfterCommit = config.resetAfterCommit, priorityContext = NoWork$2, priorityContextBeforeReconciliation = NoWork$2, isPerformingWork = !1, deadlineHasExpired = !1, isBatchingUpdates = !1, isUnbatchingUpdates = !1, nextUnitOfWork = null, nextPriorityLevel = NoWork$2, nextEffect = null, pendingCommit = null, nextScheduledRoot = null, lastScheduledRoot = null, isCallbackScheduled = !1, capturedErrors = null, failedBoundaries = null, commitPhaseBoundaries = null, firstUncaughtError = null, fatalError = null, isCommitting = !1, isUnmounting = !1;
    function resetContextStack() {
        // Reset the stack
        reset$1(), // Reset the cursors
        resetContext$1(), resetHostContainer();
    }
    // findNextUnitOfWork mutates the current priority context. It is reset after
    // after the workLoop exits, so never call findNextUnitOfWork from outside
    // the work loop.
    function findNextUnitOfWork() {
        // Clear out roots with no more work on them, or if they have uncaught errors
        for (;null !== nextScheduledRoot && nextScheduledRoot.current.pendingWorkPriority === NoWork$2; ) {
            // Unschedule this root.
            nextScheduledRoot.isScheduled = !1;
            // Read the next pointer now.
            // We need to clear it in case this root gets scheduled again later.
            var next = nextScheduledRoot.nextScheduledRoot;
            // Exit if we cleared all the roots and there's no work to do.
            if (nextScheduledRoot.nextScheduledRoot = null, nextScheduledRoot === lastScheduledRoot) return nextScheduledRoot = null, 
            lastScheduledRoot = null, nextPriorityLevel = NoWork$2, null;
            // Continue with the next root.
            // If there's no work on it, it will get unscheduled too.
            nextScheduledRoot = next;
        }
        for (var root = nextScheduledRoot, highestPriorityRoot = null, highestPriorityLevel = NoWork$2; null !== root; ) root.current.pendingWorkPriority !== NoWork$2 && (highestPriorityLevel === NoWork$2 || highestPriorityLevel > root.current.pendingWorkPriority) && (highestPriorityLevel = root.current.pendingWorkPriority, 
        highestPriorityRoot = root), // We didn't find anything to do in this root, so let's try the next one.
        root = root.nextScheduledRoot;
        // Before we start any new work, let's make sure that we have a fresh
        // stack to work from.
        // TODO: This call is buried a bit too deep. It would be nice to have
        // a single point which happens right before any new work and
        // unfortunately this is it.
        return null !== highestPriorityRoot ? (nextPriorityLevel = highestPriorityLevel, 
        priorityContext = nextPriorityLevel, resetContextStack(), createWorkInProgress$1(highestPriorityRoot.current, highestPriorityLevel)) : (nextPriorityLevel = NoWork$2, 
        null);
    }
    function commitAllHostEffects() {
        for (;null !== nextEffect; ) {
            var effectTag = nextEffect.effectTag;
            if (effectTag & ContentReset && config.resetTextContent(nextEffect.stateNode), effectTag & Ref) {
                var current$$1 = nextEffect.alternate;
                null !== current$$1 && commitDetachRef(current$$1);
            }
            switch (effectTag & ~(Callback | Err | ContentReset | Ref | PerformedWork)) {
              case Placement$1:
                commitPlacement(nextEffect), // Clear the "placement" from effect tag so that we know that this is inserted, before
                // any life-cycles like componentDidMount gets called.
                // TODO: findDOMNode doesn't rely on this any more but isMounted
                // does and isMounted is deprecated anyway so we should be able
                // to kill this.
                nextEffect.effectTag &= ~Placement$1;
                break;

              case PlacementAndUpdate:
                // Placement
                commitPlacement(nextEffect), // Clear the "placement" from effect tag so that we know that this is inserted, before
                // any life-cycles like componentDidMount gets called.
                nextEffect.effectTag &= ~Placement$1;
                // Update
                var _current = nextEffect.alternate;
                commitWork(_current, nextEffect);
                break;

              case Update:
                var _current2 = nextEffect.alternate;
                commitWork(_current2, nextEffect);
                break;

              case Deletion:
                isUnmounting = !0, commitDeletion(nextEffect), isUnmounting = !1;
            }
            nextEffect = nextEffect.nextEffect;
        }
    }
    function commitAllLifeCycles() {
        for (;null !== nextEffect; ) {
            var effectTag = nextEffect.effectTag;
            // Use Task priority for lifecycle updates
            if (effectTag & (Update | Callback)) {
                var current$$1 = nextEffect.alternate;
                commitLifeCycles(current$$1, nextEffect);
            }
            effectTag & Ref && commitAttachRef(nextEffect), effectTag & Err && commitErrorHandling(nextEffect);
            var next = nextEffect.nextEffect;
            // Ensure that we clean these up so that we don't accidentally keep them.
            // I'm not actually sure this matters because we can't reset firstEffect
            // and lastEffect since they're on every node, not just the effectful
            // ones. So we have to clean everything as we reuse nodes anyway.
            nextEffect.nextEffect = null, // Ensure that we reset the effectTag here so that we can rely on effect
            // tags to reason about the current life-cycle.
            nextEffect = next;
        }
    }
    function commitAllWork(finishedWork) {
        // We keep track of this so that captureError can collect any boundaries
        // that capture an error during the commit phase. The reason these aren't
        // local to this function is because errors that occur during cWU are
        // captured elsewhere, to prevent the unmount from being interrupted.
        isCommitting = !0, pendingCommit = null;
        var root = finishedWork.stateNode;
        invariant(root.current !== finishedWork, "Cannot commit the same tree as before. This is probably a bug " + "related to the return field. This error is likely caused by a bug " + "in React. Please file an issue."), 
        // Reset this to null before calling lifecycles
        ReactCurrentOwner$1.current = null;
        // Updates that occur during the commit phase should have Task priority
        var previousPriorityContext = priorityContext;
        priorityContext = TaskPriority$1;
        var firstEffect = void 0;
        for (finishedWork.effectTag > PerformedWork ? // A fiber's effect list consists only of its children, not itself. So if
        // the root has an effect, we need to add it to the end of the list. The
        // resulting list is the set that would belong to the root's parent, if
        // it had one; that is, all the effects in the tree including the root.
        null !== finishedWork.lastEffect ? (finishedWork.lastEffect.nextEffect = finishedWork, 
        firstEffect = finishedWork.firstEffect) : firstEffect = finishedWork : // There is no effect on the root.
        firstEffect = finishedWork.firstEffect, prepareForCommit(), // Commit all the side-effects within a tree. We'll do this in two passes.
        // The first pass performs all the host insertions, updates, deletions and
        // ref unmounts.
        nextEffect = firstEffect; null !== nextEffect; ) {
            var _error = null;
            try {
                commitAllHostEffects();
            } catch (e) {
                _error = e;
            }
            null !== _error && (invariant(null !== nextEffect, "Should have next effect. This error is likely caused by a bug " + "in React. Please file an issue."), 
            captureError(nextEffect, _error), // Clean-up
            null !== nextEffect && (nextEffect = nextEffect.nextEffect));
        }
        for (resetAfterCommit(), // The work-in-progress tree is now the current tree. This must come after
        // the first pass of the commit phase, so that the previous tree is still
        // current during componentWillUnmount, but before the second pass, so that
        // the finished work is current during componentDidMount/Update.
        root.current = finishedWork, // In the second pass we'll perform all life-cycles and ref callbacks.
        // Life-cycles happen as a separate pass so that all placements, updates,
        // and deletions in the entire tree have already been invoked.
        // This pass also triggers any renderer-specific initial effects.
        nextEffect = firstEffect; null !== nextEffect; ) {
            var _error2 = null;
            try {
                commitAllLifeCycles();
            } catch (e) {
                _error2 = e;
            }
            null !== _error2 && (invariant(null !== nextEffect, "Should have next effect. This error is likely caused by a bug " + "in React. Please file an issue."), 
            captureError(nextEffect, _error2), null !== nextEffect && (nextEffect = nextEffect.nextEffect));
        }
        isCommitting = !1, "function" == typeof onCommitRoot && onCommitRoot(finishedWork.stateNode), 
        !1 && ReactFiberInstrumentation$1.debugTool && ReactFiberInstrumentation$1.debugTool.onCommitWork(finishedWork), 
        // If we caught any errors during this commit, schedule their boundaries
        // to update.
        commitPhaseBoundaries && (commitPhaseBoundaries.forEach(scheduleErrorRecovery), 
        commitPhaseBoundaries = null), priorityContext = previousPriorityContext;
    }
    function resetWorkPriority(workInProgress, renderPriority) {
        if (!(workInProgress.pendingWorkPriority !== NoWork$2 && workInProgress.pendingWorkPriority > renderPriority)) {
            for (// Check for pending update priority.
            var newPriority = getUpdatePriority$1(workInProgress), child = workInProgress.child; null !== child; ) // Ensure that remaining work priority bubbles up.
            newPriority = largerPriority$1(newPriority, child.pendingWorkPriority), child = child.sibling;
            workInProgress.pendingWorkPriority = newPriority;
        }
    }
    function completeUnitOfWork(workInProgress) {
        for (;!0; ) {
            // The current, flushed, state of this fiber is the alternate.
            // Ideally nothing should rely on this, but relying on it here
            // means that we don't need an additional field on the work in
            // progress.
            var current$$1 = workInProgress.alternate, next = completeWork(current$$1, workInProgress, nextPriorityLevel), returnFiber = workInProgress.return, siblingFiber = workInProgress.sibling;
            if (resetWorkPriority(workInProgress, nextPriorityLevel), null !== next) // If completing this work spawned new work, do that next. We'll come
            // back here again.
            return !1 && ReactFiberInstrumentation$1.debugTool && ReactFiberInstrumentation$1.debugTool.onCompleteWork(workInProgress), 
            next;
            if (null !== returnFiber) {
                // Append all the effects of the subtree and this fiber onto the effect
                // list of the parent. The completion order of the children affects the
                // side-effect order.
                null === returnFiber.firstEffect && (returnFiber.firstEffect = workInProgress.firstEffect), 
                null !== workInProgress.lastEffect && (null !== returnFiber.lastEffect && (returnFiber.lastEffect.nextEffect = workInProgress.firstEffect), 
                returnFiber.lastEffect = workInProgress.lastEffect);
                // Skip both NoWork and PerformedWork tags when creating the effect list.
                // PerformedWork effect is read by React DevTools but shouldn't be committed.
                workInProgress.effectTag > PerformedWork && (null !== returnFiber.lastEffect ? returnFiber.lastEffect.nextEffect = workInProgress : returnFiber.firstEffect = workInProgress, 
                returnFiber.lastEffect = workInProgress);
            }
            if (!1 && ReactFiberInstrumentation$1.debugTool && ReactFiberInstrumentation$1.debugTool.onCompleteWork(workInProgress), 
            null !== siblingFiber) // If there is more work to do in this returnFiber, do that next.
            return siblingFiber;
            if (null === returnFiber) // We've reached the root. Unless we're current performing deferred
            // work, we should commit the completed work immediately. If we are
            // performing deferred work, returning null indicates to the caller
            // that we just completed the root so they can handle that case correctly.
            // Otherwise, we should commit immediately.
            return nextPriorityLevel < HighPriority ? commitAllWork(workInProgress) : pendingCommit = workInProgress, 
            null;
            // If there's no more work in this returnFiber. Complete the returnFiber.
            workInProgress = returnFiber;
        }
        // Without this explicit null return Flow complains of invalid return type
        // TODO Remove the above while(true) loop
        // eslint-disable-next-line no-unreachable
        return null;
    }
    function performUnitOfWork(workInProgress) {
        // The current, flushed, state of this fiber is the alternate.
        // Ideally nothing should rely on this, but relying on it here
        // means that we don't need an additional field on the work in
        // progress.
        var current$$1 = workInProgress.alternate, next = beginWork(current$$1, workInProgress, nextPriorityLevel);
        // If this doesn't spawn new work, complete the current work.
        return !1 && ReactFiberInstrumentation$1.debugTool && ReactFiberInstrumentation$1.debugTool.onBeginWork(workInProgress), 
        null === next && (next = completeUnitOfWork(workInProgress)), ReactCurrentOwner$1.current = null, 
        next;
    }
    function performFailedUnitOfWork(workInProgress) {
        // The current, flushed, state of this fiber is the alternate.
        // Ideally nothing should rely on this, but relying on it here
        // means that we don't need an additional field on the work in
        // progress.
        var current$$1 = workInProgress.alternate, next = beginFailedWork(current$$1, workInProgress, nextPriorityLevel);
        // If this doesn't spawn new work, complete the current work.
        return !1 && ReactFiberInstrumentation$1.debugTool && ReactFiberInstrumentation$1.debugTool.onBeginWork(workInProgress), 
        null === next && (next = completeUnitOfWork(workInProgress)), ReactCurrentOwner$1.current = null, 
        next;
    }
    function clearErrors() {
        // Keep performing work until there are no more errors
        for (null === nextUnitOfWork && (nextUnitOfWork = findNextUnitOfWork()); null !== capturedErrors && capturedErrors.size && null !== nextUnitOfWork && nextPriorityLevel !== NoWork$2 && nextPriorityLevel <= TaskPriority$1; ) null === (// Use a forked version of performUnitOfWork
        nextUnitOfWork = hasCapturedError(nextUnitOfWork) ? performFailedUnitOfWork(nextUnitOfWork) : performUnitOfWork(nextUnitOfWork)) && (// If performUnitOfWork returns null, that means we just committed
        // a root. Normally we'd need to clear any errors that were scheduled
        // during the commit phase. But we're already clearing errors, so
        // we can continue.
        nextUnitOfWork = findNextUnitOfWork());
    }
    function workLoopAsync(minPriorityLevel, deadline) {
        // Flush asynchronous work until the deadline expires.
        for (;null !== nextUnitOfWork && !deadlineHasExpired; ) if (deadline.timeRemaining() > timeHeuristicForUnitOfWork) {
            // In a deferred work batch, iff nextUnitOfWork returns null, we just
            // completed a root and a pendingCommit exists. Logically, we could
            // omit either of the checks in the following condition, but we need
            // both to satisfy Flow.
            if (null === (nextUnitOfWork = performUnitOfWork(nextUnitOfWork)) && null !== pendingCommit) // If we have time, we should commit the work now.
            if (deadline.timeRemaining() > timeHeuristicForUnitOfWork) {
                // The priority level may have changed. Check again.
                if (commitAllWork(pendingCommit), nextUnitOfWork = findNextUnitOfWork(), // Clear any errors that were scheduled during the commit phase.
                clearErrors(), nextPriorityLevel === NoWork$2 || nextPriorityLevel > minPriorityLevel || nextPriorityLevel < HighPriority) // The priority level does not match.
                break;
            } else deadlineHasExpired = !0;
        } else deadlineHasExpired = !0;
    }
    function workLoopSync(minPriorityLevel) {
        // Flush all synchronous and task work.
        for (;null !== nextUnitOfWork && !(null === (nextUnitOfWork = performUnitOfWork(nextUnitOfWork)) && (nextUnitOfWork = findNextUnitOfWork(), 
        // performUnitOfWork returned null, which means we just committed a
        // root. Clear any errors that were scheduled during the commit phase.
        clearErrors(), nextPriorityLevel === NoWork$2 || nextPriorityLevel > minPriorityLevel || nextPriorityLevel > TaskPriority$1)); ) ;
    }
    function workLoop(minPriorityLevel, deadline) {
        // Clear any errors.
        clearErrors(), null === nextUnitOfWork && (nextUnitOfWork = findNextUnitOfWork()), 
        nextPriorityLevel !== NoWork$2 && nextPriorityLevel <= minPriorityLevel && (nextPriorityLevel <= TaskPriority$1 ? workLoopSync(minPriorityLevel) : null !== deadline && workLoopAsync(minPriorityLevel, deadline));
    }
    function performDeferredWork(deadline) {
        performWork(OffscreenPriority, deadline);
    }
    function performWork(minPriorityLevel, deadline) {
        invariant(!isPerformingWork, "performWork was called recursively. This error is likely caused " + "by a bug in React. Please file an issue."), 
        isPerformingWork = !0;
        // This outer loop exists so that we can restart the work loop after
        // catching an error. It also lets us flush Task work at the end of a
        // deferred batch.
        for (var hasRemainingAsyncWork = !1; null === fatalError; ) {
            // Before starting any work, check to see if there are any pending
            // commits from the previous frame.
            // TODO: Only commit asynchronous priority at beginning or end of a frame.
            // Task work can be committed whenever.
            null === pendingCommit || deadlineHasExpired || // Safe to call this outside the work loop because the commit phase has
            // its own try-catch.
            commitAllWork(pendingCommit), // Nothing in performWork should be allowed to throw. All unsafe
            // operations must happen within workLoop, which is extracted to a
            // separate function so that it can be optimized by the JS engine.
            priorityContextBeforeReconciliation = priorityContext;
            var _error3 = null;
            try {
                workLoop(minPriorityLevel, deadline);
            } catch (e) {
                _error3 = e;
            }
            if (// Reset the priority context to its value before reconcilation.
            priorityContext = priorityContextBeforeReconciliation, null === _error3) {
                // There might be work left. Depending on the priority, we should
                // either perform it now or schedule a callback to perform it later.
                switch (nextPriorityLevel) {
                  case SynchronousPriority$1:
                  case TaskPriority$1:
                    // We have remaining synchronous or task work. Keep performing it,
                    // regardless of whether we're inside a callback.
                    if (nextPriorityLevel <= minPriorityLevel) continue;
                    break;

                  case HighPriority:
                  case LowPriority:
                  case OffscreenPriority:
                    // We have remaining async work.
                    if (null === deadline) // We're not inside a callback. Exit and perform the work during
                    // the next callback.
                    hasRemainingAsyncWork = !0; else {
                        // We are inside a callback.
                        if (!deadlineHasExpired && nextPriorityLevel <= minPriorityLevel) // We still have time. Keep working.
                        continue;
                        // We've run out of time. Exit.
                        hasRemainingAsyncWork = !0;
                    }
                    break;

                  case NoWork$2:
                    // No work left. We can exit.
                    break;

                  default:
                    invariant(!1, "Switch statement should be exhuastive.");
                }
                // Exit the loop.
                break;
            }
            // We caught an error during either the begin or complete phases.
            var failedWork = nextUnitOfWork;
            if (null === failedWork) null === fatalError && (// There is no current unit of work. This is a worst-case scenario
            // and should only be possible if there's a bug in the renderer, e.g.
            // inside resetAfterCommit.
            fatalError = _error3); else {
                // "Capture" the error by finding the nearest boundary. If there is no
                // error boundary, the nearest host container acts as one. If
                // captureError returns null, the error was intentionally ignored.
                var maybeBoundary = captureError(failedWork, _error3);
                if (null !== maybeBoundary) {
                    var boundary = maybeBoundary;
                    // Complete the boundary as if it rendered null. This will unmount
                    // the failed tree.
                    beginFailedWork(boundary.alternate, boundary, nextPriorityLevel), // The next unit of work is now the boundary that captured the error.
                    // Conceptually, we're unwinding the stack. We need to unwind the
                    // context stack, too, from the failed work to the boundary that
                    // captured the error.
                    // TODO: If we set the memoized props in beginWork instead of
                    // completeWork, rather than unwind the stack, we can just restart
                    // from the root. Can't do that until then because without memoized
                    // props, the nodes higher up in the tree will rerender unnecessarily.
                    unwindContexts(failedWork, boundary), nextUnitOfWork = completeUnitOfWork(boundary);
                }
            }
        }
        // If we're inside a callback, set this to false, since we just flushed it.
        null !== deadline && (isCallbackScheduled = !1), // If there's remaining async work, make sure we schedule another callback.
        hasRemainingAsyncWork && !isCallbackScheduled && (scheduleDeferredCallback(performDeferredWork), 
        isCallbackScheduled = !0);
        var errorToThrow = null !== fatalError ? fatalError : firstUncaughtError;
        if (// We're done performing work. Time to clean up.
        isPerformingWork = !1, deadlineHasExpired = !1, fatalError = null, firstUncaughtError = null, 
        capturedErrors = null, failedBoundaries = null, null !== errorToThrow) throw errorToThrow;
    }
    // Returns the boundary that captured the error, or null if the error is ignored
    function captureError(failedWork, error) {
        // It is no longer valid because we exited the user code.
        ReactCurrentOwner$1.current = null, nextUnitOfWork = null;
        // Search for the nearest error boundary.
        var boundary = null, errorBoundaryFound = !1, willRetry = !1, errorBoundaryName = null;
        // Host containers are a special case. If the failed work itself is a host
        // container, then it acts as its own boundary. In all other cases, we
        // ignore the work itself and only search through the parents.
        if (failedWork.tag === HostRoot$4) boundary = failedWork, isFailedBoundary(failedWork) && (// If this root already failed, there must have been an error when
        // attempting to unmount it. This is a worst-case scenario and
        // should only be possible if there's a bug in the renderer.
        fatalError = error); else for (var node = failedWork.return; null !== node && null === boundary; ) {
            if (node.tag === ClassComponent$4) {
                var instance = node.stateNode;
                "function" == typeof instance.unstable_handleError && (errorBoundaryFound = !0, 
                errorBoundaryName = getComponentName_1(node), // Found an error boundary!
                boundary = node, willRetry = !0);
            } else node.tag === HostRoot$4 && (// Treat the root like a no-op error boundary.
            boundary = node);
            if (isFailedBoundary(node)) {
                // This boundary is already in a failed state.
                // If we're currently unmounting, that means this error was
                // thrown while unmounting a failed subtree. We should ignore
                // the error.
                if (isUnmounting) return null;
                // If we're in the commit phase, we should check to see if
                // this boundary already captured an error during this commit.
                // This case exists because multiple errors can be thrown during
                // a single commit without interruption.
                if (null !== commitPhaseBoundaries && (commitPhaseBoundaries.has(node) || null !== node.alternate && commitPhaseBoundaries.has(node.alternate))) // If so, we should ignore this error.
                return null;
                // The error should propagate to the next boundary -— we keep looking.
                boundary = null, willRetry = !1;
            }
            node = node.return;
        }
        if (null !== boundary) {
            // Add to the collection of failed boundaries. This lets us know that
            // subsequent errors in this subtree should propagate to the next boundary.
            null === failedBoundaries && (failedBoundaries = new Set()), failedBoundaries.add(boundary);
            // This method is unsafe outside of the begin and complete phases.
            // We might be in the commit phase when an error is captured.
            // The risk is that the return path from this Fiber may not be accurate.
            // That risk is acceptable given the benefit of providing users more context.
            var _componentStack = getStackAddendumByWorkInProgressFiber(failedWork), _componentName = getComponentName_1(failedWork);
            // Add to the collection of captured errors. This is stored as a global
            // map of errors and their component stack location keyed by the boundaries
            // that capture them. We mostly use this Map as a Set; it's a Map only to
            // avoid adding a field to Fiber to store the error.
            // If we're in the commit phase, defer scheduling an update on the
            // boundary until after the commit is complete
            // Otherwise, schedule an update now.
            return null === capturedErrors && (capturedErrors = new Map()), capturedErrors.set(boundary, {
                componentName: _componentName,
                componentStack: _componentStack,
                error: error,
                errorBoundary: errorBoundaryFound ? boundary.stateNode : null,
                errorBoundaryFound: errorBoundaryFound,
                errorBoundaryName: errorBoundaryName,
                willRetry: willRetry
            }), isCommitting ? (null === commitPhaseBoundaries && (commitPhaseBoundaries = new Set()), 
            commitPhaseBoundaries.add(boundary)) : scheduleErrorRecovery(boundary), boundary;
        }
        // If no boundary is found, we'll need to throw the error
        return null === firstUncaughtError && (firstUncaughtError = error), null;
    }
    function hasCapturedError(fiber) {
        // TODO: capturedErrors should store the boundary instance, to avoid needing
        // to check the alternate.
        return null !== capturedErrors && (capturedErrors.has(fiber) || null !== fiber.alternate && capturedErrors.has(fiber.alternate));
    }
    function isFailedBoundary(fiber) {
        // TODO: failedBoundaries should store the boundary instance, to avoid
        // needing to check the alternate.
        return null !== failedBoundaries && (failedBoundaries.has(fiber) || null !== fiber.alternate && failedBoundaries.has(fiber.alternate));
    }
    function commitErrorHandling(effectfulFiber) {
        var capturedError = void 0;
        null !== capturedErrors && (capturedError = capturedErrors.get(effectfulFiber), 
        capturedErrors.delete(effectfulFiber), null == capturedError && null !== effectfulFiber.alternate && (effectfulFiber = effectfulFiber.alternate, 
        capturedError = capturedErrors.get(effectfulFiber), capturedErrors.delete(effectfulFiber))), 
        invariant(null != capturedError, "No error for given unit of work. This error is likely caused by a " + "bug in React. Please file an issue.");
        var error = capturedError.error;
        try {
            logCapturedError(capturedError);
        } catch (e) {
            // Prevent cycle if logCapturedError() throws.
            // A cycle may still occur if logCapturedError renders a component that throws.
            console.error(e);
        }
        switch (effectfulFiber.tag) {
          case ClassComponent$4:
            var instance = effectfulFiber.stateNode, info = {
                componentStack: capturedError.componentStack
            };
            // Allow the boundary to handle the error, usually by scheduling
            // an update to itself
            return void instance.unstable_handleError(error, info);

          case HostRoot$4:
            // If this is the host container, we treat it as a no-op error
            // boundary. We'll throw the first uncaught error once it's safe to
            // do so, at the end of the batch.
            return void (null === firstUncaughtError && (firstUncaughtError = error));

          default:
            invariant(!1, "Invalid type of work. This error is likely caused by a bug in " + "React. Please file an issue.");
        }
    }
    function unwindContexts(from, to) {
        for (var node = from; null !== node && node !== to && node.alternate !== to; ) {
            switch (node.tag) {
              case ClassComponent$4:
                popContextProvider$1(node);
                break;

              case HostComponent$3:
                popHostContext(node);
                break;

              case HostRoot$4:
              case HostPortal$1:
                popHostContainer(node);
            }
            node = node.return;
        }
    }
    function scheduleRoot(root, priorityLevel) {
        priorityLevel !== NoWork$2 && (root.isScheduled || (root.isScheduled = !0, lastScheduledRoot ? (// Schedule ourselves to the end.
        lastScheduledRoot.nextScheduledRoot = root, lastScheduledRoot = root) : (// We're the only work scheduled.
        nextScheduledRoot = root, lastScheduledRoot = root)));
    }
    function scheduleUpdate(fiber, priorityLevel) {
        priorityLevel <= nextPriorityLevel && (// We must reset the current unit of work pointer so that we restart the
        // search from the root during the next tick, in case there is now higher
        // priority work somewhere earlier than before.
        nextUnitOfWork = null);
        for (var node = fiber, shouldContinue = !0; null !== node && shouldContinue; ) {
            if (// Walk the parent path to the root and update each node's priority. Once
            // we reach a node whose priority matches (and whose alternate's priority
            // matches) we can exit safely knowing that the rest of the path is correct.
            shouldContinue = !1, (node.pendingWorkPriority === NoWork$2 || node.pendingWorkPriority > priorityLevel) && (// Priority did not match. Update and keep going.
            shouldContinue = !0, node.pendingWorkPriority = priorityLevel), null !== node.alternate && (node.alternate.pendingWorkPriority === NoWork$2 || node.alternate.pendingWorkPriority > priorityLevel) && (// Priority did not match. Update and keep going.
            shouldContinue = !0, node.alternate.pendingWorkPriority = priorityLevel), null === node.return) {
                if (node.tag !== HostRoot$4) return;
                if (scheduleRoot(node.stateNode, priorityLevel), !isPerformingWork) switch (priorityLevel) {
                  case SynchronousPriority$1:
                    // Perform this update now.
                    isUnbatchingUpdates ? // We're inside unbatchedUpdates, which is inside either
                    // batchedUpdates or a lifecycle. We should only flush
                    // synchronous work, not task work.
                    performWork(SynchronousPriority$1, null) : // Flush both synchronous and task work.
                    performWork(TaskPriority$1, null);
                    break;

                  case TaskPriority$1:
                    invariant(isBatchingUpdates, "Task updates can only be scheduled as a nested update or " + "inside batchedUpdates.");
                    break;

                  default:
                    // Schedule a callback to perform the work later.
                    isCallbackScheduled || (scheduleDeferredCallback(performDeferredWork), isCallbackScheduled = !0);
                }
            }
            node = node.return;
        }
    }
    function getPriorityContext(fiber, forceAsync) {
        var priorityLevel = priorityContext;
        // If we're in a batch, or if we're already performing work, downgrade sync
        // priority to task priority
        // If we're in a batch, or if we're already performing work, downgrade sync
        // priority to task priority
        return priorityLevel === NoWork$2 && (priorityLevel = !useSyncScheduling || fiber.internalContextTag & AsyncUpdates || forceAsync ? LowPriority : SynchronousPriority$1), 
        priorityLevel === SynchronousPriority$1 && (isPerformingWork || isBatchingUpdates) ? TaskPriority$1 : priorityLevel;
    }
    function scheduleErrorRecovery(fiber) {
        scheduleUpdate(fiber, TaskPriority$1);
    }
    function performWithPriority(priorityLevel, fn) {
        var previousPriorityContext = priorityContext;
        priorityContext = priorityLevel;
        try {
            fn();
        } finally {
            priorityContext = previousPriorityContext;
        }
    }
    function batchedUpdates(fn, a) {
        var previousIsBatchingUpdates = isBatchingUpdates;
        isBatchingUpdates = !0;
        try {
            return fn(a);
        } finally {
            isBatchingUpdates = previousIsBatchingUpdates, // If we're not already inside a batch, we need to flush any task work
            // that was created by the user-provided function.
            isPerformingWork || isBatchingUpdates || performWork(TaskPriority$1, null);
        }
    }
    function unbatchedUpdates(fn) {
        var previousIsUnbatchingUpdates = isUnbatchingUpdates, previousIsBatchingUpdates = isBatchingUpdates;
        // This is only true if we're nested inside batchedUpdates.
        isUnbatchingUpdates = isBatchingUpdates, isBatchingUpdates = !1;
        try {
            return fn();
        } finally {
            isBatchingUpdates = previousIsBatchingUpdates, isUnbatchingUpdates = previousIsUnbatchingUpdates;
        }
    }
    function syncUpdates(fn) {
        var previousPriorityContext = priorityContext;
        priorityContext = SynchronousPriority$1;
        try {
            return fn();
        } finally {
            priorityContext = previousPriorityContext;
        }
    }
    function deferredUpdates(fn) {
        var previousPriorityContext = priorityContext;
        priorityContext = LowPriority;
        try {
            return fn();
        } finally {
            priorityContext = previousPriorityContext;
        }
    }
    return {
        scheduleUpdate: scheduleUpdate,
        getPriorityContext: getPriorityContext,
        performWithPriority: performWithPriority,
        batchedUpdates: batchedUpdates,
        unbatchedUpdates: unbatchedUpdates,
        syncUpdates: syncUpdates,
        deferredUpdates: deferredUpdates
    };
}, getContextFiber = function(arg) {
    invariant(!1, "Missing injection for fiber getContextForSubtree");
};

function getContextForSubtree(parentComponent) {
    if (!parentComponent) return emptyObject;
    var instance = ReactInstanceMap_1.get(parentComponent);
    return "number" == typeof instance.tag ? getContextFiber(instance) : instance._processChildContext(instance._context);
}

getContextForSubtree._injectFiber = function(fn) {
    getContextFiber = fn;
};

var getContextForSubtree_1 = getContextForSubtree, ReactFeatureFlags = require("ReactFeatureFlags"), addTopLevelUpdate = ReactFiberUpdateQueue.addTopLevelUpdate, findCurrentUnmaskedContext = ReactFiberContext.findCurrentUnmaskedContext, isContextProvider = ReactFiberContext.isContextProvider, processChildContext = ReactFiberContext.processChildContext, createFiberRoot = ReactFiberRoot.createFiberRoot, HostComponent = ReactTypeOfWork.HostComponent, findCurrentHostFiber = ReactFiberTreeReflection.findCurrentHostFiber;

getContextForSubtree_1._injectFiber(function(fiber) {
    var parentContext = findCurrentUnmaskedContext(fiber);
    return isContextProvider(fiber) ? processChildContext(fiber, parentContext, !1) : parentContext;
});

var ReactFiberReconciler = function(config) {
    var getPublicInstance = config.getPublicInstance, _ReactFiberScheduler = ReactFiberScheduler(config), scheduleUpdate = _ReactFiberScheduler.scheduleUpdate, getPriorityContext = _ReactFiberScheduler.getPriorityContext, performWithPriority = _ReactFiberScheduler.performWithPriority, batchedUpdates = _ReactFiberScheduler.batchedUpdates, unbatchedUpdates = _ReactFiberScheduler.unbatchedUpdates, syncUpdates = _ReactFiberScheduler.syncUpdates, deferredUpdates = _ReactFiberScheduler.deferredUpdates;
    function scheduleTopLevelUpdate(current$$1, element, callback) {
        var forceAsync = ReactFeatureFlags.enableAsyncSubtreeAPI && null != element && null != element.type && !0 === element.type.unstable_asyncUpdates, priorityLevel = getPriorityContext(current$$1, forceAsync), nextState = {
            element: element
        };
        callback = void 0 === callback ? null : callback, addTopLevelUpdate(current$$1, nextState, callback, priorityLevel), 
        scheduleUpdate(current$$1, priorityLevel);
    }
    return {
        createContainer: function(containerInfo) {
            return createFiberRoot(containerInfo);
        },
        updateContainer: function(element, container, parentComponent, callback) {
            // TODO: If this is a nested container, this won't be the root.
            var current$$1 = container.current, context = getContextForSubtree_1(parentComponent);
            null === container.context ? container.context = context : container.pendingContext = context, 
            scheduleTopLevelUpdate(current$$1, element, callback);
        },
        performWithPriority: performWithPriority,
        batchedUpdates: batchedUpdates,
        unbatchedUpdates: unbatchedUpdates,
        syncUpdates: syncUpdates,
        deferredUpdates: deferredUpdates,
        getPublicRootInstance: function(container) {
            var containerFiber = container.current;
            if (!containerFiber.child) return null;
            switch (containerFiber.child.tag) {
              case HostComponent:
                return getPublicInstance(containerFiber.child.stateNode);

              default:
                return containerFiber.child.stateNode;
            }
        },
        findHostInstance: function(fiber) {
            var hostFiber = findCurrentHostFiber(fiber);
            return null === hostFiber ? null : hostFiber.stateNode;
        }
    };
}, rAF = void 0, rIC = void 0;

if (ExecutionEnvironment.canUseDOM) if ("function" != typeof requestAnimationFrame) invariant(!1, "React depends on requestAnimationFrame. Make sure that you load a " + "polyfill in older browsers."); else if ("function" != typeof requestIdleCallback) {
    // Wrap requestAnimationFrame and polyfill requestIdleCallback.
    var scheduledRAFCallback = null, scheduledRICCallback = null, isIdleScheduled = !1, isAnimationFrameScheduled = !1, frameDeadline = 0, previousFrameTime = 33, activeFrameTime = 33, frameDeadlineObject = {
        timeRemaining: "object" == typeof performance && "function" == typeof performance.now ? function() {
            // We assume that if we have a performance timer that the rAF callback
            // gets a performance timer value. Not sure if this is always true.
            return frameDeadline - performance.now();
        } : function() {
            // As a fallback we use Date.now.
            return frameDeadline - Date.now();
        }
    }, messageKey = "__reactIdleCallback$" + Math.random().toString(36).slice(2), idleTick = function(event) {
        if (event.source === window && event.data === messageKey) {
            isIdleScheduled = !1;
            var callback = scheduledRICCallback;
            scheduledRICCallback = null, callback && callback(frameDeadlineObject);
        }
    };
    // Assumes that we have addEventListener in this environment. Might need
    // something better for old IE.
    window.addEventListener("message", idleTick, !1);
    var animationTick = function(rafTime) {
        isAnimationFrameScheduled = !1;
        var nextFrameTime = rafTime - frameDeadline + activeFrameTime;
        nextFrameTime < activeFrameTime && previousFrameTime < activeFrameTime ? (nextFrameTime < 8 && (// Defensive coding. We don't support higher frame rates than 120hz.
        // If we get lower than that, it is probably a bug.
        nextFrameTime = 8), // If one frame goes long, then the next one can be short to catch up.
        // If two frames are short in a row, then that's an indication that we
        // actually have a higher frame rate than what we're currently optimizing.
        // We adjust our heuristic dynamically accordingly. For example, if we're
        // running on 120hz display or 90hz VR display.
        // Take the max of the two in case one of them was an anomaly due to
        // missed frame deadlines.
        activeFrameTime = nextFrameTime < previousFrameTime ? previousFrameTime : nextFrameTime) : previousFrameTime = nextFrameTime, 
        frameDeadline = rafTime + activeFrameTime, isIdleScheduled || (isIdleScheduled = !0, 
        window.postMessage(messageKey, "*"));
        var callback = scheduledRAFCallback;
        scheduledRAFCallback = null, callback && callback(rafTime);
    };
    rAF = function(callback) {
        // This assumes that we only schedule one callback at a time because that's
        // how Fiber uses it.
        // If rIC didn't already schedule one, we need to schedule a frame.
        return scheduledRAFCallback = callback, isAnimationFrameScheduled || (isAnimationFrameScheduled = !0, 
        requestAnimationFrame(animationTick)), 0;
    }, rIC = function(callback) {
        // This assumes that we only schedule one callback at a time because that's
        // how Fiber uses it.
        // If rAF didn't already schedule one, we need to schedule a frame.
        // TODO: If this rAF doesn't materialize because the browser throttles, we
        // might want to still have setTimeout trigger rIC as a backup to ensure
        // that we keep performing work.
        return scheduledRICCallback = callback, isAnimationFrameScheduled || (isAnimationFrameScheduled = !0, 
        requestAnimationFrame(animationTick)), 0;
    };
} else rAF = requestAnimationFrame, rIC = requestIdleCallback; else rAF = function(frameCallback) {
    return setTimeout(frameCallback, 16), 0;
}, rIC = function(frameCallback) {
    return setTimeout(function() {
        frameCallback({
            timeRemaining: function() {
                return 1 / 0;
            }
        });
    }), 0;
};

var rAF_1 = rAF, rIC_1 = rIC, ReactDOMFrameScheduling = {
    rAF: rAF_1,
    rIC: rIC_1
}, _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) Object.prototype.hasOwnProperty.call(source, key) && (target[key] = source[key]);
    }
    return target;
};

function _possibleConstructorReturn(self, call) {
    if (!self) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return !call || "object" != typeof call && "function" != typeof call ? self : call;
}

function _inherits(subClass, superClass) {
    if ("function" != typeof superClass && null !== superClass) throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            enumerable: !1,
            writable: !0,
            configurable: !0
        }
    }), superClass && (Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass);
}

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}

current.setCurrent(// Change to 'art/modes/dom' for easier debugging via SVG
fastNoSideEffects);

var Mode = current, Component = React.Component, pooledTransform = new transform$1(), EVENT_TYPES = {
    onClick: "click",
    onMouseMove: "mousemove",
    onMouseOver: "mouseover",
    onMouseOut: "mouseout",
    onMouseUp: "mouseup",
    onMouseDown: "mousedown"
}, TYPES = {
    CLIPPING_RECTANGLE: "ClippingRectangle",
    GROUP: "Group",
    SHAPE: "Shape",
    TEXT: "Text"
}, UPDATE_SIGNAL = {};

/** Helper Methods */
function addEventListeners(instance, type, listener) {
    // We need to explicitly unregister before unmount.
    // For this reason we need to track subscriptions.
    instance._listeners || (instance._listeners = {}, instance._subscriptions = {}), 
    instance._listeners[type] = listener, listener ? instance._subscriptions[type] || (instance._subscriptions[type] = instance.subscribe(type, createEventHandler(instance), instance)) : instance._subscriptions[type] && (instance._subscriptions[type](), 
    delete instance._subscriptions[type]);
}

function childrenAsString(children) {
    return children ? "string" == typeof children ? children : children.length ? children.join("") : "" : "";
}

function createEventHandler(instance) {
    return function(event) {
        var listener = instance._listeners[event.type];
        listener && ("function" == typeof listener ? listener.call(instance, event) : listener.handleEvent && listener.handleEvent(event));
    };
}

function destroyEventListeners(instance) {
    if (instance._subscriptions) for (var type in instance._subscriptions) instance._subscriptions[type]();
    instance._subscriptions = null, instance._listeners = null;
}

function getScaleX(props) {
    return null != props.scaleX ? props.scaleX : null != props.scale ? props.scale : 1;
}

function getScaleY(props) {
    return null != props.scaleY ? props.scaleY : null != props.scale ? props.scale : 1;
}

function isSameFont(oldFont, newFont) {
    return oldFont === newFont || "string" != typeof newFont && "string" != typeof oldFont && (newFont.fontSize === oldFont.fontSize && newFont.fontStyle === oldFont.fontStyle && newFont.fontVariant === oldFont.fontVariant && newFont.fontWeight === oldFont.fontWeight && newFont.fontFamily === oldFont.fontFamily);
}

/** Render Methods */
function applyClippingRectangleProps(instance, props) {
    applyNodeProps(instance, props, arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}), 
    instance.width = props.width, instance.height = props.height;
}

function applyGroupProps(instance, props) {
    applyNodeProps(instance, props, arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}), 
    instance.width = props.width, instance.height = props.height;
}

function applyNodeProps(instance, props) {
    var prevProps = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}, scaleX = getScaleX(props), scaleY = getScaleY(props);
    pooledTransform.transformTo(1, 0, 0, 1, 0, 0).move(props.x || 0, props.y || 0).rotate(props.rotation || 0, props.originX, props.originY).scale(scaleX, scaleY, props.originX, props.originY), 
    null != props.transform && pooledTransform.transform(props.transform), instance.xx === pooledTransform.xx && instance.yx === pooledTransform.yx && instance.xy === pooledTransform.xy && instance.yy === pooledTransform.yy && instance.x === pooledTransform.x && instance.y === pooledTransform.y || instance.transformTo(pooledTransform), 
    props.cursor === prevProps.cursor && props.title === prevProps.title || instance.indicate(props.cursor, props.title), 
    instance.blend && props.opacity !== prevProps.opacity && instance.blend(null == props.opacity ? 1 : props.opacity), 
    props.visible !== prevProps.visible && (null == props.visible || props.visible ? instance.show() : instance.hide());
    for (var type in EVENT_TYPES) addEventListeners(instance, EVENT_TYPES[type], props[type]);
}

function applyRenderableNodeProps(instance, props) {
    var prevProps = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
    applyNodeProps(instance, props, prevProps), prevProps.fill !== props.fill && (props.fill && props.fill.applyFill ? props.fill.applyFill(instance) : instance.fill(props.fill)), 
    prevProps.stroke === props.stroke && prevProps.strokeWidth === props.strokeWidth && prevProps.strokeCap === props.strokeCap && prevProps.strokeJoin === props.strokeJoin && // TODO: Consider deep check of stokeDash; may benefit VML in IE.
    prevProps.strokeDash === props.strokeDash || instance.stroke(props.stroke, props.strokeWidth, props.strokeCap, props.strokeJoin, props.strokeDash);
}

function applyShapeProps(instance, props) {
    var prevProps = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
    applyRenderableNodeProps(instance, props, prevProps);
    var path = props.d || childrenAsString(props.children), prevDelta = instance._prevDelta;
    path === instance._prevPath && path.delta === prevDelta && prevProps.height === props.height && prevProps.width === props.width || (instance.draw(path, props.width, props.height), 
    instance._prevDelta = path.delta, instance._prevPath = path);
}

function applyTextProps(instance, props) {
    var prevProps = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
    applyRenderableNodeProps(instance, props, prevProps);
    var string = props.children;
    instance._currentString === string && isSameFont(props.font, prevProps.font) && props.alignment === prevProps.alignment && props.path === prevProps.path || (instance.draw(string, props.font, props.alignment, props.path), 
    instance._currentString = string);
}

/** Declarative fill-type objects; API design not finalized */
var slice = Array.prototype.slice, LinearGradient = function() {
    function LinearGradient(stops, x1, y1, x2, y2) {
        _classCallCheck(this, LinearGradient), this._args = slice.call(arguments);
    }
    return LinearGradient.prototype.applyFill = function(node) {
        node.fillLinear.apply(node, this._args);
    }, LinearGradient;
}(), RadialGradient = function() {
    function RadialGradient(stops, fx, fy, rx, ry, cx, cy) {
        _classCallCheck(this, RadialGradient), this._args = slice.call(arguments);
    }
    return RadialGradient.prototype.applyFill = function(node) {
        node.fillRadial.apply(node, this._args);
    }, RadialGradient;
}(), Pattern = function() {
    function Pattern(url, width, height, left, top) {
        _classCallCheck(this, Pattern), this._args = slice.call(arguments);
    }
    return Pattern.prototype.applyFill = function(node) {
        node.fillImage.apply(node, this._args);
    }, Pattern;
}(), Surface = function(_Component) {
    _inherits(Surface, _Component);
    function Surface() {
        return _classCallCheck(this, Surface), _possibleConstructorReturn(this, _Component.apply(this, arguments));
    }
    return Surface.prototype.componentDidMount = function() {
        var _props = this.props, height = _props.height, width = _props.width;
        this._surface = Mode.Surface(+width, +height, this._tagRef), this._mountNode = ARTRenderer.createContainer(this._surface), 
        ARTRenderer.updateContainer(this.props.children, this._mountNode, this);
    }, Surface.prototype.componentDidUpdate = function(prevProps, prevState) {
        var props = this.props;
        props.height === prevProps.height && props.width === prevProps.width || this._surface.resize(+props.width, +props.height), 
        ARTRenderer.updateContainer(this.props.children, this._mountNode, this), this._surface.render && this._surface.render();
    }, Surface.prototype.componentWillUnmount = function() {
        ARTRenderer.updateContainer(null, this._mountNode, this);
    }, Surface.prototype.render = function() {
        var _this2 = this, props = this.props, Tag = Mode.Surface.tagName;
        return React.createElement(Tag, {
            ref: function(ref) {
                return _this2._tagRef = ref;
            },
            accessKey: props.accessKey,
            className: props.className,
            draggable: props.draggable,
            role: props.role,
            style: props.style,
            tabIndex: props.tabIndex,
            title: props.title
        });
    }, Surface;
}(Component), Text = function(_React$Component) {
    _inherits(Text, _React$Component);
    function Text(props) {
        _classCallCheck(this, Text);
        // We allow reading these props. Ideally we could expose the Text node as
        // ref directly.
        var _this3 = _possibleConstructorReturn(this, _React$Component.call(this, props));
        return [ "height", "width", "x", "y" ].forEach(function(key) {
            Object.defineProperty(_this3, key, {
                get: function() {
                    return this._text ? this._text[key] : void 0;
                }
            });
        }), _this3;
    }
    return Text.prototype.render = function() {
        var _this4 = this, T = TYPES.TEXT;
        return React.createElement(T, _extends({}, this.props, {
            ref: function(t) {
                return _this4._text = t;
            }
        }), childrenAsString(this.props.children));
    }, Text;
}(React.Component), ARTRenderer = ReactFiberReconciler({
    appendChild: function(parentInstance, child) {
        child.parentNode === parentInstance && child.eject(), child.inject(parentInstance);
    },
    appendChildToContainer: function(parentInstance, child) {
        child.parentNode === parentInstance && child.eject(), child.inject(parentInstance);
    },
    appendInitialChild: function(parentInstance, child) {
        if ("string" == typeof child) // Noop for string children of Text (eg <Text>{'foo'}{'bar'}</Text>)
        return void invariant(!1, "Text children should already be flattened.");
        child.inject(parentInstance);
    },
    commitTextUpdate: function(textInstance, oldText, newText) {},
    commitMount: function(instance, type, newProps) {},
    commitUpdate: function(instance, updatePayload, type, oldProps, newProps) {
        instance._applyProps(instance, newProps, oldProps);
    },
    createInstance: function(type, props, internalInstanceHandle) {
        var instance = void 0;
        switch (type) {
          case TYPES.CLIPPING_RECTANGLE:
            instance = Mode.ClippingRectangle(), instance._applyProps = applyClippingRectangleProps;
            break;

          case TYPES.GROUP:
            instance = Mode.Group(), instance._applyProps = applyGroupProps;
            break;

          case TYPES.SHAPE:
            instance = Mode.Shape(), instance._applyProps = applyShapeProps;
            break;

          case TYPES.TEXT:
            instance = Mode.Text(props.children, props.font, props.alignment, props.path), instance._applyProps = applyTextProps;
        }
        return invariant(instance, 'ReactART does not support the type "%s"', type), instance._applyProps(instance, props), 
        instance;
    },
    createTextInstance: function(text, rootContainerInstance, internalInstanceHandle) {
        return text;
    },
    finalizeInitialChildren: function(domElement, type, props) {
        return !1;
    },
    getPublicInstance: function(instance) {
        return instance;
    },
    insertBefore: function(parentInstance, child, beforeChild) {
        invariant(child !== beforeChild, "ReactART: Can not insert node before itself"), 
        child.injectBefore(beforeChild);
    },
    insertInContainerBefore: function(parentInstance, child, beforeChild) {
        invariant(child !== beforeChild, "ReactART: Can not insert node before itself"), 
        child.injectBefore(beforeChild);
    },
    prepareForCommit: function() {},
    prepareUpdate: function(domElement, type, oldProps, newProps) {
        return UPDATE_SIGNAL;
    },
    removeChild: function(parentInstance, child) {
        destroyEventListeners(child), child.eject();
    },
    removeChildFromContainer: function(parentInstance, child) {
        destroyEventListeners(child), child.eject();
    },
    resetAfterCommit: function() {},
    resetTextContent: function(domElement) {},
    shouldDeprioritizeSubtree: function(type, props) {
        return !1;
    },
    getRootHostContext: function() {
        return emptyObject;
    },
    getChildHostContext: function() {
        return emptyObject;
    },
    scheduleDeferredCallback: ReactDOMFrameScheduling.rIC,
    shouldSetTextContent: function(type, props) {
        return "string" == typeof props.children || "number" == typeof props.children;
    },
    useSyncScheduling: !0
}), ReactARTFiberEntry = {
    ClippingRectangle: TYPES.CLIPPING_RECTANGLE,
    Group: TYPES.GROUP,
    LinearGradient: LinearGradient,
    Path: Mode.Path,
    Pattern: Pattern,
    RadialGradient: RadialGradient,
    Shape: TYPES.SHAPE,
    Surface: Surface,
    Text: Text,
    Transform: transform$1
};

module.exports = ReactARTFiberEntry;
