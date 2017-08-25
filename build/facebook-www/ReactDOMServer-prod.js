/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @providesModule ReactDOMServer-prod
 */
"use strict";

var invariant = require("fbjs/lib/invariant"), warning = require("fbjs/lib/warning"), ExecutionEnvironment = require("fbjs/lib/ExecutionEnvironment"), emptyFunction = require("fbjs/lib/emptyFunction"), EventListener = require("fbjs/lib/EventListener"), React = require("React"), containsNode = require("fbjs/lib/containsNode"), focusNode = require("fbjs/lib/focusNode"), getActiveElement = require("fbjs/lib/getActiveElement"), shallowEqual = require("fbjs/lib/shallowEqual");

require("fbjs/lib/camelizeStyleName");

var hyphenateStyleName = require("fbjs/lib/hyphenateStyleName"), memoizeStringOnly = require("fbjs/lib/memoizeStringOnly");

require("prop-types"), require("prop-types/checkPropTypes");

var emptyObject = require("fbjs/lib/emptyObject"), ARIADOMPropertyConfig = {
    Properties: {
        // Global States and Properties
        "aria-current": 0,
        // state
        "aria-details": 0,
        "aria-disabled": 0,
        // state
        "aria-hidden": 0,
        // state
        "aria-invalid": 0,
        // state
        "aria-keyshortcuts": 0,
        "aria-label": 0,
        "aria-roledescription": 0,
        // Widget Attributes
        "aria-autocomplete": 0,
        "aria-checked": 0,
        "aria-expanded": 0,
        "aria-haspopup": 0,
        "aria-level": 0,
        "aria-modal": 0,
        "aria-multiline": 0,
        "aria-multiselectable": 0,
        "aria-orientation": 0,
        "aria-placeholder": 0,
        "aria-pressed": 0,
        "aria-readonly": 0,
        "aria-required": 0,
        "aria-selected": 0,
        "aria-sort": 0,
        "aria-valuemax": 0,
        "aria-valuemin": 0,
        "aria-valuenow": 0,
        "aria-valuetext": 0,
        // Live Region Attributes
        "aria-atomic": 0,
        "aria-busy": 0,
        "aria-live": 0,
        "aria-relevant": 0,
        // Drag-and-Drop Attributes
        "aria-dropeffect": 0,
        "aria-grabbed": 0,
        // Relationship Attributes
        "aria-activedescendant": 0,
        "aria-colcount": 0,
        "aria-colindex": 0,
        "aria-colspan": 0,
        "aria-controls": 0,
        "aria-describedby": 0,
        "aria-errormessage": 0,
        "aria-flowto": 0,
        "aria-labelledby": 0,
        "aria-owns": 0,
        "aria-posinset": 0,
        "aria-rowcount": 0,
        "aria-rowindex": 0,
        "aria-rowspan": 0,
        "aria-setsize": 0
    },
    DOMAttributeNames: {},
    DOMPropertyNames: {}
}, ARIADOMPropertyConfig_1 = ARIADOMPropertyConfig, eventPluginOrder = null, namesToPlugins = {};

/**
 * Recomputes the plugin list using the injected plugins and plugin ordering.
 *
 * @private
 */
function recomputePluginOrdering() {
    if (eventPluginOrder) for (var pluginName in namesToPlugins) {
        var pluginModule = namesToPlugins[pluginName], pluginIndex = eventPluginOrder.indexOf(pluginName);
        if (invariant(pluginIndex > -1, "EventPluginRegistry: Cannot inject event plugins that do not exist in " + "the plugin ordering, `%s`.", pluginName), 
        !EventPluginRegistry.plugins[pluginIndex]) {
            invariant(pluginModule.extractEvents, "EventPluginRegistry: Event plugins must implement an `extractEvents` " + "method, but `%s` does not.", pluginName), 
            EventPluginRegistry.plugins[pluginIndex] = pluginModule;
            var publishedEvents = pluginModule.eventTypes;
            for (var eventName in publishedEvents) invariant(publishEventForPlugin(publishedEvents[eventName], pluginModule, eventName), "EventPluginRegistry: Failed to publish event `%s` for plugin `%s`.", eventName, pluginName);
        }
    }
}

/**
 * Publishes an event so that it can be dispatched by the supplied plugin.
 *
 * @param {object} dispatchConfig Dispatch configuration for the event.
 * @param {object} PluginModule Plugin publishing the event.
 * @return {boolean} True if the event was successfully published.
 * @private
 */
function publishEventForPlugin(dispatchConfig, pluginModule, eventName) {
    invariant(!EventPluginRegistry.eventNameDispatchConfigs.hasOwnProperty(eventName), "EventPluginHub: More than one plugin attempted to publish the same " + "event name, `%s`.", eventName), 
    EventPluginRegistry.eventNameDispatchConfigs[eventName] = dispatchConfig;
    var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
    if (phasedRegistrationNames) {
        for (var phaseName in phasedRegistrationNames) if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
            var phasedRegistrationName = phasedRegistrationNames[phaseName];
            publishRegistrationName(phasedRegistrationName, pluginModule, eventName);
        }
        return !0;
    }
    return !!dispatchConfig.registrationName && (publishRegistrationName(dispatchConfig.registrationName, pluginModule, eventName), 
    !0);
}

/**
 * Publishes a registration name that is used to identify dispatched events.
 *
 * @param {string} registrationName Registration name to add.
 * @param {object} PluginModule Plugin publishing the event.
 * @private
 */
function publishRegistrationName(registrationName, pluginModule, eventName) {
    invariant(!EventPluginRegistry.registrationNameModules[registrationName], "EventPluginHub: More than one plugin attempted to publish the same " + "registration name, `%s`.", registrationName), 
    EventPluginRegistry.registrationNameModules[registrationName] = pluginModule, EventPluginRegistry.registrationNameDependencies[registrationName] = pluginModule.eventTypes[eventName].dependencies;
}

/**
 * Registers plugins so that they can extract and dispatch events.
 *
 * @see {EventPluginHub}
 */
var EventPluginRegistry = {
    /**
   * Ordered list of injected plugins.
   */
    plugins: [],
    /**
   * Mapping from event name to dispatch config
   */
    eventNameDispatchConfigs: {},
    /**
   * Mapping from registration name to plugin module
   */
    registrationNameModules: {},
    /**
   * Mapping from registration name to event name
   */
    registrationNameDependencies: {},
    /**
   * Mapping from lowercase registration names to the properly cased version,
   * used to warn in the case of missing event handlers. Available
   * only in false.
   * @type {Object}
   */
    possibleRegistrationNames: null,
    // Trust the developer to only use possibleRegistrationNames in false
    /**
   * Injects an ordering of plugins (by plugin name). This allows the ordering
   * to be decoupled from injection of the actual plugins so that ordering is
   * always deterministic regardless of packaging, on-the-fly injection, etc.
   *
   * @param {array} InjectedEventPluginOrder
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginOrder}
   */
    injectEventPluginOrder: function(injectedEventPluginOrder) {
        invariant(!eventPluginOrder, "EventPluginRegistry: Cannot inject event plugin ordering more than " + "once. You are likely trying to load more than one copy of React."), 
        // Clone the ordering so it cannot be dynamically mutated.
        eventPluginOrder = Array.prototype.slice.call(injectedEventPluginOrder), recomputePluginOrdering();
    },
    /**
   * Injects plugins to be used by `EventPluginHub`. The plugin names must be
   * in the ordering injected by `injectEventPluginOrder`.
   *
   * Plugins can be injected as part of page initialization or on-the-fly.
   *
   * @param {object} injectedNamesToPlugins Map from names to plugin modules.
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginsByName}
   */
    injectEventPluginsByName: function(injectedNamesToPlugins) {
        var isOrderingDirty = !1;
        for (var pluginName in injectedNamesToPlugins) if (injectedNamesToPlugins.hasOwnProperty(pluginName)) {
            var pluginModule = injectedNamesToPlugins[pluginName];
            namesToPlugins.hasOwnProperty(pluginName) && namesToPlugins[pluginName] === pluginModule || (invariant(!namesToPlugins[pluginName], "EventPluginRegistry: Cannot inject two different event plugins " + "using the same name, `%s`.", pluginName), 
            namesToPlugins[pluginName] = pluginModule, isOrderingDirty = !0);
        }
        isOrderingDirty && recomputePluginOrdering();
    }
}, EventPluginRegistry_1 = EventPluginRegistry, caughtError = null, invokeGuardedCallback = function(name, func, context, a, b, c, d, e, f) {
    var funcArgs = Array.prototype.slice.call(arguments, 3);
    try {
        func.apply(context, funcArgs);
    } catch (error) {
        return error;
    }
    return null;
}, rethrowCaughtError = function() {
    if (caughtError) {
        var error = caughtError;
        throw caughtError = null, error;
    }
}, ReactErrorUtils = {
    injection: {
        injectErrorUtils: function(injectedErrorUtils) {
            invariant("function" == typeof injectedErrorUtils.invokeGuardedCallback, "Injected invokeGuardedCallback() must be a function."), 
            invokeGuardedCallback = injectedErrorUtils.invokeGuardedCallback;
        }
    },
    /**
   * Call a function while guarding against errors that happens within it.
   * Returns an error if it throws, otherwise null.
   *
   * @param {String} name of the guard to use for logging or debugging
   * @param {Function} func The function to invoke
   * @param {*} context The context to use when calling the function
   * @param {...*} args Arguments for function
   */
    invokeGuardedCallback: function(name, func, context, a, b, c, d, e, f) {
        return invokeGuardedCallback.apply(this, arguments);
    },
    /**
   * Same as invokeGuardedCallback, but instead of returning an error, it stores
   * it in a global so it can be rethrown by `rethrowCaughtError` later.
   *
   * @param {String} name of the guard to use for logging or debugging
   * @param {Function} func The function to invoke
   * @param {*} context The context to use when calling the function
   * @param {...*} args Arguments for function
   */
    invokeGuardedCallbackAndCatchFirstError: function(name, func, context, a, b, c, d, e, f) {
        var error = ReactErrorUtils.invokeGuardedCallback.apply(this, arguments);
        null !== error && null === caughtError && (caughtError = error);
    },
    /**
   * During execution of guarded functions we will capture the first error which
   * we will rethrow to be handled by the top level error handler.
   */
    rethrowCaughtError: function() {
        return rethrowCaughtError.apply(this, arguments);
    }
}, ReactErrorUtils_1 = ReactErrorUtils, ComponentTree, injection = {
    injectComponentTree: function(Injected) {
        ComponentTree = Injected;
    }
};

function isEndish(topLevelType) {
    return "topMouseUp" === topLevelType || "topTouchEnd" === topLevelType || "topTouchCancel" === topLevelType;
}

function isMoveish(topLevelType) {
    return "topMouseMove" === topLevelType || "topTouchMove" === topLevelType;
}

function isStartish(topLevelType) {
    return "topMouseDown" === topLevelType || "topTouchStart" === topLevelType;
}

/**
 * Dispatch the event to the listener.
 * @param {SyntheticEvent} event SyntheticEvent to handle
 * @param {boolean} simulated If the event is simulated (changes exn behavior)
 * @param {function} listener Application-level callback
 * @param {*} inst Internal component instance
 */
function executeDispatch(event, simulated, listener, inst) {
    var type = event.type || "unknown-event";
    event.currentTarget = EventPluginUtils.getNodeFromInstance(inst), ReactErrorUtils_1.invokeGuardedCallbackAndCatchFirstError(type, listener, void 0, event), 
    event.currentTarget = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches.
 */
function executeDispatchesInOrder(event, simulated) {
    var dispatchListeners = event._dispatchListeners, dispatchInstances = event._dispatchInstances;
    if (Array.isArray(dispatchListeners)) for (var i = 0; i < dispatchListeners.length && !event.isPropagationStopped(); i++) // Listeners and Instances are two parallel arrays that are always in sync.
    executeDispatch(event, simulated, dispatchListeners[i], dispatchInstances[i]); else dispatchListeners && executeDispatch(event, simulated, dispatchListeners, dispatchInstances);
    event._dispatchListeners = null, event._dispatchInstances = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches, but stops
 * at the first dispatch execution returning true, and returns that id.
 *
 * @return {?string} id of the first dispatch execution who's listener returns
 * true, or null if no listener returned true.
 */
function executeDispatchesInOrderStopAtTrueImpl(event) {
    var dispatchListeners = event._dispatchListeners, dispatchInstances = event._dispatchInstances;
    if (Array.isArray(dispatchListeners)) {
        for (var i = 0; i < dispatchListeners.length && !event.isPropagationStopped(); i++) // Listeners and Instances are two parallel arrays that are always in sync.
        if (dispatchListeners[i](event, dispatchInstances[i])) return dispatchInstances[i];
    } else if (dispatchListeners && dispatchListeners(event, dispatchInstances)) return dispatchInstances;
    return null;
}

/**
 * @see executeDispatchesInOrderStopAtTrueImpl
 */
function executeDispatchesInOrderStopAtTrue(event) {
    var ret = executeDispatchesInOrderStopAtTrueImpl(event);
    return event._dispatchInstances = null, event._dispatchListeners = null, ret;
}

/**
 * Execution of a "direct" dispatch - there must be at most one dispatch
 * accumulated on the event or it is considered an error. It doesn't really make
 * sense for an event with multiple dispatches (bubbled) to keep track of the
 * return values at each dispatch execution, but it does tend to make sense when
 * dealing with "direct" dispatches.
 *
 * @return {*} The return value of executing the single dispatch.
 */
function executeDirectDispatch(event) {
    var dispatchListener = event._dispatchListeners, dispatchInstance = event._dispatchInstances;
    invariant(!Array.isArray(dispatchListener), "executeDirectDispatch(...): Invalid `event`."), 
    event.currentTarget = dispatchListener ? EventPluginUtils.getNodeFromInstance(dispatchInstance) : null;
    var res = dispatchListener ? dispatchListener(event) : null;
    return event.currentTarget = null, event._dispatchListeners = null, event._dispatchInstances = null, 
    res;
}

/**
 * @param {SyntheticEvent} event
 * @return {boolean} True iff number of dispatches accumulated is greater than 0.
 */
function hasDispatches(event) {
    return !!event._dispatchListeners;
}

/**
 * General utilities that are useful in creating custom Event Plugins.
 */
var EventPluginUtils = {
    isEndish: isEndish,
    isMoveish: isMoveish,
    isStartish: isStartish,
    executeDirectDispatch: executeDirectDispatch,
    executeDispatchesInOrder: executeDispatchesInOrder,
    executeDispatchesInOrderStopAtTrue: executeDispatchesInOrderStopAtTrue,
    hasDispatches: hasDispatches,
    getFiberCurrentPropsFromNode: function(node) {
        return ComponentTree.getFiberCurrentPropsFromNode(node);
    },
    getInstanceFromNode: function(node) {
        return ComponentTree.getInstanceFromNode(node);
    },
    getNodeFromInstance: function(node) {
        return ComponentTree.getNodeFromInstance(node);
    },
    injection: injection
}, EventPluginUtils_1 = EventPluginUtils;

/**
 * Accumulates items that must not be null or undefined into the first one. This
 * is used to conserve memory by avoiding array allocations, and thus sacrifices
 * API cleanness. Since `current` can be null before being passed in and not
 * null after this function, make sure to assign it back to `current`:
 *
 * `a = accumulateInto(a, b);`
 *
 * This API should be sparingly used. Try `accumulate` for something cleaner.
 *
 * @return {*|array<*>} An accumulation of items.
 */
function accumulateInto(current, next) {
    // Both are not empty. Warning: Never call x.concat(y) when you are not
    // certain that x is an Array (x could be a string with concat method).
    return invariant(null != next, "accumulateInto(...): Accumulated items must not be null or undefined."), 
    null == current ? next : Array.isArray(current) ? Array.isArray(next) ? (current.push.apply(current, next), 
    current) : (current.push(next), current) : Array.isArray(next) ? [ current ].concat(next) : [ current, next ];
}

var accumulateInto_1 = accumulateInto;

/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule forEachAccumulated
 * 
 */
/**
 * @param {array} arr an "accumulation" of items which is either an Array or
 * a single item. Useful when paired with the `accumulate` module. This is a
 * simple utility that allows us to reason about a collection of items, but
 * handling the case when there is exactly one item (and we do not need to
 * allocate an array).
 * @param {function} cb Callback invoked with each element or a collection.
 * @param {?} [scope] Scope used as `this` in a callback.
 */
function forEachAccumulated(arr, cb, scope) {
    Array.isArray(arr) ? arr.forEach(cb, scope) : arr && cb.call(scope, arr);
}

var forEachAccumulated_1 = forEachAccumulated, eventQueue = null, executeDispatchesAndRelease = function(event, simulated) {
    event && (EventPluginUtils_1.executeDispatchesInOrder(event, simulated), event.isPersistent() || event.constructor.release(event));
}, executeDispatchesAndReleaseSimulated = function(e) {
    return executeDispatchesAndRelease(e, !0);
}, executeDispatchesAndReleaseTopLevel = function(e) {
    return executeDispatchesAndRelease(e, !1);
};

function isInteractive(tag) {
    return "button" === tag || "input" === tag || "select" === tag || "textarea" === tag;
}

function shouldPreventMouseEvent(name, type, props) {
    switch (name) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
        return !(!props.disabled || !isInteractive(type));

      default:
        return !1;
    }
}

/**
 * This is a unified interface for event plugins to be installed and configured.
 *
 * Event plugins can implement the following properties:
 *
 *   `extractEvents` {function(string, DOMEventTarget, string, object): *}
 *     Required. When a top-level event is fired, this method is expected to
 *     extract synthetic events that will in turn be queued and dispatched.
 *
 *   `eventTypes` {object}
 *     Optional, plugins that fire events must publish a mapping of registration
 *     names that are used to register listeners. Values of this mapping must
 *     be objects that contain `registrationName` or `phasedRegistrationNames`.
 *
 *   `executeDispatch` {function(object, function, string)}
 *     Optional, allows plugins to override how an event gets dispatched. By
 *     default, the listener is simply invoked.
 *
 * Each plugin that is injected into `EventsPluginHub` is immediately operable.
 *
 * @public
 */
var EventPluginHub = {
    /**
   * Methods for injecting dependencies.
   */
    injection: {
        /**
     * @param {array} InjectedEventPluginOrder
     * @public
     */
        injectEventPluginOrder: EventPluginRegistry_1.injectEventPluginOrder,
        /**
     * @param {object} injectedNamesToPlugins Map from names to plugin modules.
     */
        injectEventPluginsByName: EventPluginRegistry_1.injectEventPluginsByName
    },
    /**
   * @param {object} inst The instance, which is the source of events.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @return {?function} The stored callback.
   */
    getListener: function(inst, registrationName) {
        var listener;
        // TODO: shouldPreventMouseEvent is DOM-specific and definitely should not
        // live here; needs to be moved to a better place soon
        if ("number" == typeof inst.tag) {
            var stateNode = inst.stateNode;
            if (!stateNode) // Work in progress (ex: onload events in incremental mode).
            return null;
            var props = EventPluginUtils_1.getFiberCurrentPropsFromNode(stateNode);
            if (!props) // Work in progress.
            return null;
            if (listener = props[registrationName], shouldPreventMouseEvent(registrationName, inst.type, props)) return null;
        } else {
            var currentElement = inst._currentElement;
            if ("string" == typeof currentElement || "number" == typeof currentElement) // Text node, let it bubble through.
            return null;
            if (!inst._rootNodeID) // If the instance is already unmounted, we have no listeners.
            return null;
            var _props = currentElement.props;
            if (listener = _props[registrationName], shouldPreventMouseEvent(registrationName, currentElement.type, _props)) return null;
        }
        return invariant(!listener || "function" == typeof listener, "Expected %s listener to be a function, instead got type %s", registrationName, typeof listener), 
        listener;
    },
    /**
   * Allows registered plugins an opportunity to extract events from top-level
   * native browser events.
   *
   * @return {*} An accumulation of synthetic events.
   * @internal
   */
    extractEvents: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
        for (var events, plugins = EventPluginRegistry_1.plugins, i = 0; i < plugins.length; i++) {
            // Not every plugin in the ordering may be loaded at runtime.
            var possiblePlugin = plugins[i];
            if (possiblePlugin) {
                var extractedEvents = possiblePlugin.extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget);
                extractedEvents && (events = accumulateInto_1(events, extractedEvents));
            }
        }
        return events;
    },
    /**
   * Enqueues a synthetic event that should be dispatched when
   * `processEventQueue` is invoked.
   *
   * @param {*} events An accumulation of synthetic events.
   * @internal
   */
    enqueueEvents: function(events) {
        events && (eventQueue = accumulateInto_1(eventQueue, events));
    },
    /**
   * Dispatches all synthetic events on the event queue.
   *
   * @internal
   */
    processEventQueue: function(simulated) {
        // Set `eventQueue` to null before processing it so that we can tell if more
        // events get enqueued while processing.
        var processingEventQueue = eventQueue;
        eventQueue = null, simulated ? forEachAccumulated_1(processingEventQueue, executeDispatchesAndReleaseSimulated) : forEachAccumulated_1(processingEventQueue, executeDispatchesAndReleaseTopLevel), 
        invariant(!eventQueue, "processEventQueue(): Additional events were enqueued while processing " + "an event queue. Support for this has not yet been implemented."), 
        // This would be a good time to rethrow if any of the event handlers threw.
        ReactErrorUtils_1.rethrowCaughtError();
    }
}, EventPluginHub_1 = EventPluginHub, ReactTypeOfWork = {
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
}, HostComponent = ReactTypeOfWork.HostComponent;

function getParent(inst) {
    if (void 0 !== inst._hostParent) return inst._hostParent;
    if ("number" == typeof inst.tag) {
        do {
            inst = inst.return;
        } while (inst && inst.tag !== HostComponent);
        if (inst) return inst;
    }
    return null;
}

/**
 * Return the lowest common ancestor of A and B, or null if they are in
 * different trees.
 */
function getLowestCommonAncestor(instA, instB) {
    for (var depthA = 0, tempA = instA; tempA; tempA = getParent(tempA)) depthA++;
    for (var depthB = 0, tempB = instB; tempB; tempB = getParent(tempB)) depthB++;
    // If A is deeper, crawl up.
    for (;depthA - depthB > 0; ) instA = getParent(instA), depthA--;
    // If B is deeper, crawl up.
    for (;depthB - depthA > 0; ) instB = getParent(instB), depthB--;
    for (// Walk in lockstep until we find a match.
    var depth = depthA; depth--; ) {
        if (instA === instB || instA === instB.alternate) return instA;
        instA = getParent(instA), instB = getParent(instB);
    }
    return null;
}

/**
 * Return if A is an ancestor of B.
 */
function isAncestor(instA, instB) {
    for (;instB; ) {
        if (instA === instB || instA === instB.alternate) return !0;
        instB = getParent(instB);
    }
    return !1;
}

/**
 * Return the parent instance of the passed-in instance.
 */
function getParentInstance(inst) {
    return getParent(inst);
}

/**
 * Simulates the traversal of a two-phase, capture/bubble event dispatch.
 */
function traverseTwoPhase(inst, fn, arg) {
    for (var path = []; inst; ) path.push(inst), inst = getParent(inst);
    var i;
    for (i = path.length; i-- > 0; ) fn(path[i], "captured", arg);
    for (i = 0; i < path.length; i++) fn(path[i], "bubbled", arg);
}

/**
 * Traverses the ID hierarchy and invokes the supplied `cb` on any IDs that
 * should would receive a `mouseEnter` or `mouseLeave` event.
 *
 * Does not invoke the callback on the nearest common ancestor because nothing
 * "entered" or "left" that element.
 */
function traverseEnterLeave(from, to, fn, argFrom, argTo) {
    for (var common = from && to ? getLowestCommonAncestor(from, to) : null, pathFrom = []; from && from !== common; ) pathFrom.push(from), 
    from = getParent(from);
    for (var pathTo = []; to && to !== common; ) pathTo.push(to), to = getParent(to);
    var i;
    for (i = 0; i < pathFrom.length; i++) fn(pathFrom[i], "bubbled", argFrom);
    for (i = pathTo.length; i-- > 0; ) fn(pathTo[i], "captured", argTo);
}

var ReactTreeTraversal = {
    isAncestor: isAncestor,
    getLowestCommonAncestor: getLowestCommonAncestor,
    getParentInstance: getParentInstance,
    traverseTwoPhase: traverseTwoPhase,
    traverseEnterLeave: traverseEnterLeave
}, getListener = EventPluginHub_1.getListener;

/**
 * Some event types have a notion of different registration names for different
 * "phases" of propagation. This finds listeners by a given phase.
 */
function listenerAtPhase(inst, event, propagationPhase) {
    var registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
    return getListener(inst, registrationName);
}

/**
 * Tags a `SyntheticEvent` with dispatched listeners. Creating this function
 * here, allows us to not have to bind or create functions for each event.
 * Mutating the event's members allows us to not have to create a wrapping
 * "dispatch" object that pairs the event with the listener.
 */
function accumulateDirectionalDispatches(inst, phase, event) {
    var listener = listenerAtPhase(inst, event, phase);
    listener && (event._dispatchListeners = accumulateInto_1(event._dispatchListeners, listener), 
    event._dispatchInstances = accumulateInto_1(event._dispatchInstances, inst));
}

/**
 * Collect dispatches (must be entirely collected before dispatching - see unit
 * tests). Lazily allocate the array to conserve memory.  We must loop through
 * each event and perform the traversal for each one. We cannot perform a
 * single traversal for the entire collection of events because each event may
 * have a different target.
 */
function accumulateTwoPhaseDispatchesSingle(event) {
    event && event.dispatchConfig.phasedRegistrationNames && ReactTreeTraversal.traverseTwoPhase(event._targetInst, accumulateDirectionalDispatches, event);
}

/**
 * Same as `accumulateTwoPhaseDispatchesSingle`, but skips over the targetID.
 */
function accumulateTwoPhaseDispatchesSingleSkipTarget(event) {
    if (event && event.dispatchConfig.phasedRegistrationNames) {
        var targetInst = event._targetInst, parentInst = targetInst ? ReactTreeTraversal.getParentInstance(targetInst) : null;
        ReactTreeTraversal.traverseTwoPhase(parentInst, accumulateDirectionalDispatches, event);
    }
}

/**
 * Accumulates without regard to direction, does not look for phased
 * registration names. Same as `accumulateDirectDispatchesSingle` but without
 * requiring that the `dispatchMarker` be the same as the dispatched ID.
 */
function accumulateDispatches(inst, ignoredDirection, event) {
    if (inst && event && event.dispatchConfig.registrationName) {
        var registrationName = event.dispatchConfig.registrationName, listener = getListener(inst, registrationName);
        listener && (event._dispatchListeners = accumulateInto_1(event._dispatchListeners, listener), 
        event._dispatchInstances = accumulateInto_1(event._dispatchInstances, inst));
    }
}

/**
 * Accumulates dispatches on an `SyntheticEvent`, but only for the
 * `dispatchMarker`.
 * @param {SyntheticEvent} event
 */
function accumulateDirectDispatchesSingle(event) {
    event && event.dispatchConfig.registrationName && accumulateDispatches(event._targetInst, null, event);
}

function accumulateTwoPhaseDispatches(events) {
    forEachAccumulated_1(events, accumulateTwoPhaseDispatchesSingle);
}

function accumulateTwoPhaseDispatchesSkipTarget(events) {
    forEachAccumulated_1(events, accumulateTwoPhaseDispatchesSingleSkipTarget);
}

function accumulateEnterLeaveDispatches(leave, enter, from, to) {
    ReactTreeTraversal.traverseEnterLeave(from, to, accumulateDispatches, leave, enter);
}

function accumulateDirectDispatches(events) {
    forEachAccumulated_1(events, accumulateDirectDispatchesSingle);
}

/**
 * A small set of propagation patterns, each of which will accept a small amount
 * of information, and generate a set of "dispatch ready event objects" - which
 * are sets of events that have already been annotated with a set of dispatched
 * listener functions/ids. The API is designed this way to discourage these
 * propagation strategies from actually executing the dispatches, since we
 * always want to collect the entire set of dispatches before executing even a
 * single one.
 *
 * @constructor EventPropagators
 */
var EventPropagators = {
    accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
    accumulateTwoPhaseDispatchesSkipTarget: accumulateTwoPhaseDispatchesSkipTarget,
    accumulateDirectDispatches: accumulateDirectDispatches,
    accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches
}, EventPropagators_1 = EventPropagators, oneArgumentPooler = function(copyFieldsFrom) {
    var Klass = this;
    if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        return Klass.call(instance, copyFieldsFrom), instance;
    }
    return new Klass(copyFieldsFrom);
}, twoArgumentPooler = function(a1, a2) {
    var Klass = this;
    if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        return Klass.call(instance, a1, a2), instance;
    }
    return new Klass(a1, a2);
}, threeArgumentPooler = function(a1, a2, a3) {
    var Klass = this;
    if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        return Klass.call(instance, a1, a2, a3), instance;
    }
    return new Klass(a1, a2, a3);
}, fourArgumentPooler = function(a1, a2, a3, a4) {
    var Klass = this;
    if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        return Klass.call(instance, a1, a2, a3, a4), instance;
    }
    return new Klass(a1, a2, a3, a4);
}, standardReleaser = function(instance) {
    var Klass = this;
    invariant(instance instanceof Klass, "Trying to release an instance into a pool of a different type."), 
    instance.destructor(), Klass.instancePool.length < Klass.poolSize && Klass.instancePool.push(instance);
}, DEFAULT_POOL_SIZE = 10, DEFAULT_POOLER = oneArgumentPooler, addPoolingTo = function(CopyConstructor, pooler) {
    // Casting as any so that flow ignores the actual implementation and trusts
    // it to match the type we declared
    var NewKlass = CopyConstructor;
    return NewKlass.instancePool = [], NewKlass.getPooled = pooler || DEFAULT_POOLER, 
    NewKlass.poolSize || (NewKlass.poolSize = DEFAULT_POOL_SIZE), NewKlass.release = standardReleaser, 
    NewKlass;
}, PooledClass = {
    addPoolingTo: addPoolingTo,
    oneArgumentPooler: oneArgumentPooler,
    twoArgumentPooler: twoArgumentPooler,
    threeArgumentPooler: threeArgumentPooler,
    fourArgumentPooler: fourArgumentPooler
}, PooledClass_1 = PooledClass, contentKey = null;

/**
 * Gets the key used to access text content on a DOM node.
 *
 * @return {?string} Key used to access text content.
 * @internal
 */
function getTextContentAccessor() {
    // Prefer textContent to innerText because many browsers support both but
    // SVG <text> elements don't support innerText even when <div> does.
    return !contentKey && ExecutionEnvironment.canUseDOM && (contentKey = "textContent" in document.documentElement ? "textContent" : "innerText"), 
    contentKey;
}

var getTextContentAccessor_1 = getTextContentAccessor;

/**
 * This helper class stores information about text content of a target node,
 * allowing comparison of content before and after a given event.
 *
 * Identify the node where selection currently begins, then observe
 * both its text content and its current position in the DOM. Since the
 * browser may natively replace the target node during composition, we can
 * use its position to find its replacement.
 *
 * @param {DOMEventTarget} root
 */
function FallbackCompositionState(root) {
    this._root = root, this._startText = this.getText(), this._fallbackText = null;
}

Object.assign(FallbackCompositionState.prototype, {
    destructor: function() {
        this._root = null, this._startText = null, this._fallbackText = null;
    },
    /**
   * Get current text of input.
   *
   * @return {string}
   */
    getText: function() {
        return "value" in this._root ? this._root.value : this._root[getTextContentAccessor_1()];
    },
    /**
   * Determine the differing substring between the initially stored
   * text content and the current content.
   *
   * @return {string}
   */
    getData: function() {
        if (this._fallbackText) return this._fallbackText;
        var start, end, startValue = this._startText, startLength = startValue.length, endValue = this.getText(), endLength = endValue.length;
        for (start = 0; start < startLength && startValue[start] === endValue[start]; start++) ;
        var minEnd = startLength - start;
        for (end = 1; end <= minEnd && startValue[startLength - end] === endValue[endLength - end]; end++) ;
        var sliceTail = end > 1 ? 1 - end : void 0;
        return this._fallbackText = endValue.slice(start, sliceTail), this._fallbackText;
    }
}), PooledClass_1.addPoolingTo(FallbackCompositionState);

var FallbackCompositionState_1 = FallbackCompositionState, shouldBeReleasedProperties = [ "dispatchConfig", "_targetInst", "nativeEvent", "isDefaultPrevented", "isPropagationStopped", "_dispatchListeners", "_dispatchInstances" ], EventInterface = {
    type: null,
    target: null,
    // currentTarget is set when dispatching; no use in copying it here
    currentTarget: emptyFunction.thatReturnsNull,
    eventPhase: null,
    bubbles: null,
    cancelable: null,
    timeStamp: function(event) {
        return event.timeStamp || Date.now();
    },
    defaultPrevented: null,
    isTrusted: null
};

/**
 * Synthetic events are dispatched by event plugins, typically in response to a
 * top-level event delegation handler.
 *
 * These systems should generally use pooling to reduce the frequency of garbage
 * collection. The system should check `isPersistent` to determine whether the
 * event should be released into the pool after being dispatched. Users that
 * need a persisted event should invoke `persist`.
 *
 * Synthetic events (and subclasses) implement the DOM Level 3 Events API by
 * normalizing browser quirks. Subclasses do not necessarily have to implement a
 * DOM interface; custom application-specific events can also subclass this.
 *
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {*} targetInst Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @param {DOMEventTarget} nativeEventTarget Target node.
 */
function SyntheticEvent(dispatchConfig, targetInst, nativeEvent, nativeEventTarget) {
    this.dispatchConfig = dispatchConfig, this._targetInst = targetInst, this.nativeEvent = nativeEvent;
    var Interface = this.constructor.Interface;
    for (var propName in Interface) if (Interface.hasOwnProperty(propName)) {
        var normalize = Interface[propName];
        normalize ? this[propName] = normalize(nativeEvent) : "target" === propName ? this.target = nativeEventTarget : this[propName] = nativeEvent[propName];
    }
    var defaultPrevented = null != nativeEvent.defaultPrevented ? nativeEvent.defaultPrevented : !1 === nativeEvent.returnValue;
    return this.isDefaultPrevented = defaultPrevented ? emptyFunction.thatReturnsTrue : emptyFunction.thatReturnsFalse, 
    this.isPropagationStopped = emptyFunction.thatReturnsFalse, this;
}

Object.assign(SyntheticEvent.prototype, {
    preventDefault: function() {
        this.defaultPrevented = !0;
        var event = this.nativeEvent;
        event && (event.preventDefault ? event.preventDefault() : "unknown" != typeof event.returnValue && (event.returnValue = !1), 
        this.isDefaultPrevented = emptyFunction.thatReturnsTrue);
    },
    stopPropagation: function() {
        var event = this.nativeEvent;
        event && (event.stopPropagation ? event.stopPropagation() : "unknown" != typeof event.cancelBubble && (// The ChangeEventPlugin registers a "propertychange" event for
        // IE. This event does not support bubbling or cancelling, and
        // any references to cancelBubble throw "Member not found".  A
        // typeof check of "unknown" circumvents this issue (and is also
        // IE specific).
        event.cancelBubble = !0), this.isPropagationStopped = emptyFunction.thatReturnsTrue);
    },
    /**
   * We release all dispatched `SyntheticEvent`s after each event loop, adding
   * them back into the pool. This allows a way to hold onto a reference that
   * won't be added back into the pool.
   */
    persist: function() {
        this.isPersistent = emptyFunction.thatReturnsTrue;
    },
    /**
   * Checks if this event should be released back into the pool.
   *
   * @return {boolean} True if this should not be released, false otherwise.
   */
    isPersistent: emptyFunction.thatReturnsFalse,
    /**
   * `PooledClass` looks for `destructor` on each instance it releases.
   */
    destructor: function() {
        var Interface = this.constructor.Interface;
        for (var propName in Interface) this[propName] = null;
        for (var i = 0; i < shouldBeReleasedProperties.length; i++) this[shouldBeReleasedProperties[i]] = null;
    }
}), SyntheticEvent.Interface = EventInterface, /**
 * Helper to reduce boilerplate when creating subclasses.
 *
 * @param {function} Class
 * @param {?object} Interface
 */
SyntheticEvent.augmentClass = function(Class, Interface) {
    var Super = this, E = function() {};
    E.prototype = Super.prototype;
    var prototype = new E();
    Object.assign(prototype, Class.prototype), Class.prototype = prototype, Class.prototype.constructor = Class, 
    Class.Interface = Object.assign({}, Super.Interface, Interface), Class.augmentClass = Super.augmentClass, 
    PooledClass_1.addPoolingTo(Class, PooledClass_1.fourArgumentPooler);
}, PooledClass_1.addPoolingTo(SyntheticEvent, PooledClass_1.fourArgumentPooler);

var SyntheticEvent_1 = SyntheticEvent, CompositionEventInterface = {
    data: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticCompositionEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent_1.augmentClass(SyntheticCompositionEvent, CompositionEventInterface);

var SyntheticCompositionEvent_1 = SyntheticCompositionEvent, InputEventInterface = {
    data: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticInputEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent_1.augmentClass(SyntheticInputEvent, InputEventInterface);

var SyntheticInputEvent_1 = SyntheticInputEvent, END_KEYCODES = [ 9, 13, 27, 32 ], START_KEYCODE = 229, canUseCompositionEvent = ExecutionEnvironment.canUseDOM && "CompositionEvent" in window, documentMode = null;

ExecutionEnvironment.canUseDOM && "documentMode" in document && (documentMode = document.documentMode);

// Webkit offers a very useful `textInput` event that can be used to
// directly represent `beforeInput`. The IE `textinput` event is not as
// useful, so we don't use it.
var canUseTextInputEvent = ExecutionEnvironment.canUseDOM && "TextEvent" in window && !documentMode && !isPresto(), useFallbackCompositionData = ExecutionEnvironment.canUseDOM && (!canUseCompositionEvent || documentMode && documentMode > 8 && documentMode <= 11);

/**
 * Opera <= 12 includes TextEvent in window, but does not fire
 * text input events. Rely on keypress instead.
 */
function isPresto() {
    var opera = window.opera;
    return "object" == typeof opera && "function" == typeof opera.version && parseInt(opera.version(), 10) <= 12;
}

var SPACEBAR_CODE = 32, SPACEBAR_CHAR = String.fromCharCode(SPACEBAR_CODE), eventTypes = {
    beforeInput: {
        phasedRegistrationNames: {
            bubbled: "onBeforeInput",
            captured: "onBeforeInputCapture"
        },
        dependencies: [ "topCompositionEnd", "topKeyPress", "topTextInput", "topPaste" ]
    },
    compositionEnd: {
        phasedRegistrationNames: {
            bubbled: "onCompositionEnd",
            captured: "onCompositionEndCapture"
        },
        dependencies: [ "topBlur", "topCompositionEnd", "topKeyDown", "topKeyPress", "topKeyUp", "topMouseDown" ]
    },
    compositionStart: {
        phasedRegistrationNames: {
            bubbled: "onCompositionStart",
            captured: "onCompositionStartCapture"
        },
        dependencies: [ "topBlur", "topCompositionStart", "topKeyDown", "topKeyPress", "topKeyUp", "topMouseDown" ]
    },
    compositionUpdate: {
        phasedRegistrationNames: {
            bubbled: "onCompositionUpdate",
            captured: "onCompositionUpdateCapture"
        },
        dependencies: [ "topBlur", "topCompositionUpdate", "topKeyDown", "topKeyPress", "topKeyUp", "topMouseDown" ]
    }
}, hasSpaceKeypress = !1;

/**
 * Return whether a native keypress event is assumed to be a command.
 * This is required because Firefox fires `keypress` events for key commands
 * (cut, copy, select-all, etc.) even though no character is inserted.
 */
function isKeypressCommand(nativeEvent) {
    // ctrlKey && altKey is equivalent to AltGr, and is not a command.
    return (nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) && !(nativeEvent.ctrlKey && nativeEvent.altKey);
}

/**
 * Translate native top level events into event types.
 *
 * @param {string} topLevelType
 * @return {object}
 */
function getCompositionEventType(topLevelType) {
    switch (topLevelType) {
      case "topCompositionStart":
        return eventTypes.compositionStart;

      case "topCompositionEnd":
        return eventTypes.compositionEnd;

      case "topCompositionUpdate":
        return eventTypes.compositionUpdate;
    }
}

/**
 * Does our fallback best-guess model think this event signifies that
 * composition has begun?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackCompositionStart(topLevelType, nativeEvent) {
    return "topKeyDown" === topLevelType && nativeEvent.keyCode === START_KEYCODE;
}

/**
 * Does our fallback mode think that this event is the end of composition?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackCompositionEnd(topLevelType, nativeEvent) {
    switch (topLevelType) {
      case "topKeyUp":
        // Command keys insert or clear IME input.
        return -1 !== END_KEYCODES.indexOf(nativeEvent.keyCode);

      case "topKeyDown":
        // Expect IME keyCode on each keydown. If we get any other
        // code we must have exited earlier.
        return nativeEvent.keyCode !== START_KEYCODE;

      case "topKeyPress":
      case "topMouseDown":
      case "topBlur":
        // Events are not possible without cancelling IME.
        return !0;

      default:
        return !1;
    }
}

/**
 * Google Input Tools provides composition data via a CustomEvent,
 * with the `data` property populated in the `detail` object. If this
 * is available on the event object, use it. If not, this is a plain
 * composition event and we have nothing special to extract.
 *
 * @param {object} nativeEvent
 * @return {?string}
 */
function getDataFromCustomEvent(nativeEvent) {
    var detail = nativeEvent.detail;
    return "object" == typeof detail && "data" in detail ? detail.data : null;
}

// Track the current IME composition fallback object, if any.
var currentComposition = null;

/**
 * @return {?object} A SyntheticCompositionEvent.
 */
function extractCompositionEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
    var eventType, fallbackData;
    if (canUseCompositionEvent ? eventType = getCompositionEventType(topLevelType) : currentComposition ? isFallbackCompositionEnd(topLevelType, nativeEvent) && (eventType = eventTypes.compositionEnd) : isFallbackCompositionStart(topLevelType, nativeEvent) && (eventType = eventTypes.compositionStart), 
    !eventType) return null;
    useFallbackCompositionData && (// The current composition is stored statically and must not be
    // overwritten while composition continues.
    currentComposition || eventType !== eventTypes.compositionStart ? eventType === eventTypes.compositionEnd && currentComposition && (fallbackData = currentComposition.getData()) : currentComposition = FallbackCompositionState_1.getPooled(nativeEventTarget));
    var event = SyntheticCompositionEvent_1.getPooled(eventType, targetInst, nativeEvent, nativeEventTarget);
    if (fallbackData) // Inject data generated from fallback path into the synthetic event.
    // This matches the property of native CompositionEventInterface.
    event.data = fallbackData; else {
        var customData = getDataFromCustomEvent(nativeEvent);
        null !== customData && (event.data = customData);
    }
    return EventPropagators_1.accumulateTwoPhaseDispatches(event), event;
}

/**
 * @param {string} topLevelType Record from `BrowserEventConstants`.
 * @param {object} nativeEvent Native browser event.
 * @return {?string} The string corresponding to this `beforeInput` event.
 */
function getNativeBeforeInputChars(topLevelType, nativeEvent) {
    switch (topLevelType) {
      case "topCompositionEnd":
        return getDataFromCustomEvent(nativeEvent);

      case "topKeyPress":
        return nativeEvent.which !== SPACEBAR_CODE ? null : (hasSpaceKeypress = !0, SPACEBAR_CHAR);

      case "topTextInput":
        // Record the characters to be added to the DOM.
        var chars = nativeEvent.data;
        // If it's a spacebar character, assume that we have already handled
        // it at the keypress level and bail immediately. Android Chrome
        // doesn't give us keycodes, so we need to blacklist it.
        // If it's a spacebar character, assume that we have already handled
        // it at the keypress level and bail immediately. Android Chrome
        // doesn't give us keycodes, so we need to blacklist it.
        return chars === SPACEBAR_CHAR && hasSpaceKeypress ? null : chars;

      default:
        // For other native event types, do nothing.
        return null;
    }
}

/**
 * For browsers that do not provide the `textInput` event, extract the
 * appropriate string to use for SyntheticInputEvent.
 *
 * @param {string} topLevelType Record from `BrowserEventConstants`.
 * @param {object} nativeEvent Native browser event.
 * @return {?string} The fallback string for this `beforeInput` event.
 */
function getFallbackBeforeInputChars(topLevelType, nativeEvent) {
    // If we are currently composing (IME) and using a fallback to do so,
    // try to extract the composed characters from the fallback object.
    // If composition event is available, we extract a string only at
    // compositionevent, otherwise extract it at fallback events.
    if (currentComposition) {
        if ("topCompositionEnd" === topLevelType || !canUseCompositionEvent && isFallbackCompositionEnd(topLevelType, nativeEvent)) {
            var chars = currentComposition.getData();
            return FallbackCompositionState_1.release(currentComposition), currentComposition = null, 
            chars;
        }
        return null;
    }
    switch (topLevelType) {
      case "topPaste":
        // If a paste event occurs after a keypress, throw out the input
        // chars. Paste events should not lead to BeforeInput events.
        return null;

      case "topKeyPress":
        /**
       * As of v27, Firefox may fire keypress events even when no character
       * will be inserted. A few possibilities:
       *
       * - `which` is `0`. Arrow keys, Esc key, etc.
       *
       * - `which` is the pressed key code, but no char is available.
       *   Ex: 'AltGr + d` in Polish. There is no modified character for
       *   this key combination and no character is inserted into the
       *   document, but FF fires the keypress for char code `100` anyway.
       *   No `input` event will occur.
       *
       * - `which` is the pressed key code, but a command combination is
       *   being used. Ex: `Cmd+C`. No character is inserted, and no
       *   `input` event will occur.
       */
        if (!isKeypressCommand(nativeEvent)) {
            // IE fires the `keypress` event when a user types an emoji via
            // Touch keyboard of Windows.  In such a case, the `char` property
            // holds an emoji character like `\uD83D\uDE0A`.  Because its length
            // is 2, the property `which` does not represent an emoji correctly.
            // In such a case, we directly return the `char` property instead of
            // using `which`.
            if (nativeEvent.char && nativeEvent.char.length > 1) return nativeEvent.char;
            if (nativeEvent.which) return String.fromCharCode(nativeEvent.which);
        }
        return null;

      case "topCompositionEnd":
        return useFallbackCompositionData ? null : nativeEvent.data;

      default:
        return null;
    }
}

/**
 * Extract a SyntheticInputEvent for `beforeInput`, based on either native
 * `textInput` or fallback behavior.
 *
 * @return {?object} A SyntheticInputEvent.
 */
function extractBeforeInputEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
    var chars;
    // If no characters are being inserted, no BeforeInput event should
    // be fired.
    if (!(chars = canUseTextInputEvent ? getNativeBeforeInputChars(topLevelType, nativeEvent) : getFallbackBeforeInputChars(topLevelType, nativeEvent))) return null;
    var event = SyntheticInputEvent_1.getPooled(eventTypes.beforeInput, targetInst, nativeEvent, nativeEventTarget);
    return event.data = chars, EventPropagators_1.accumulateTwoPhaseDispatches(event), 
    event;
}

/**
 * Create an `onBeforeInput` event to match
 * http://www.w3.org/TR/2013/WD-DOM-Level-3-Events-20131105/#events-inputevents.
 *
 * This event plugin is based on the native `textInput` event
 * available in Chrome, Safari, Opera, and IE. This event fires after
 * `onKeyPress` and `onCompositionEnd`, but before `onInput`.
 *
 * `beforeInput` is spec'd but not implemented in any browsers, and
 * the `input` event does not provide any useful information about what has
 * actually been added, contrary to the spec. Thus, `textInput` is the best
 * available event to identify the characters that have actually been inserted
 * into the target node.
 *
 * This plugin is also responsible for emitting `composition` events, thus
 * allowing us to share composition fallback code for both `beforeInput` and
 * `composition` event types.
 */
var BeforeInputEventPlugin = {
    eventTypes: eventTypes,
    extractEvents: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
        return [ extractCompositionEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget), extractBeforeInputEvent(topLevelType, targetInst, nativeEvent, nativeEventTarget) ];
    }
}, BeforeInputEventPlugin_1 = BeforeInputEventPlugin;

function checkMask(value, bitmask) {
    return (value & bitmask) === bitmask;
}

var DOMPropertyInjection = {
    /**
   * Mapping from normalized, camelcased property names to a configuration that
   * specifies how the associated DOM property should be accessed or rendered.
   */
    MUST_USE_PROPERTY: 1,
    HAS_BOOLEAN_VALUE: 4,
    HAS_NUMERIC_VALUE: 8,
    HAS_POSITIVE_NUMERIC_VALUE: 16 | 8,
    HAS_OVERLOADED_BOOLEAN_VALUE: 32,
    /**
   * Inject some specialized knowledge about the DOM. This takes a config object
   * with the following properties:
   *
   * isCustomAttribute: function that given an attribute name will return true
   * if it can be inserted into the DOM verbatim. Useful for data-* or aria-*
   * attributes where it's impossible to enumerate all of the possible
   * attribute names,
   *
   * Properties: object mapping DOM property name to one of the
   * DOMPropertyInjection constants or null. If your attribute isn't in here,
   * it won't get written to the DOM.
   *
   * DOMAttributeNames: object mapping React attribute name to the DOM
   * attribute name. Attribute names not specified use the **lowercase**
   * normalized name.
   *
   * DOMAttributeNamespaces: object mapping React attribute name to the DOM
   * attribute namespace URL. (Attribute names not specified use no namespace.)
   *
   * DOMPropertyNames: similar to DOMAttributeNames but for DOM properties.
   * Property names not specified use the normalized name.
   *
   * DOMMutationMethods: Properties that require special mutation methods. If
   * `value` is undefined, the mutation method should unset the property.
   *
   * @param {object} domPropertyConfig the config as described above.
   */
    injectDOMPropertyConfig: function(domPropertyConfig) {
        var Injection = DOMPropertyInjection, Properties = domPropertyConfig.Properties || {}, DOMAttributeNamespaces = domPropertyConfig.DOMAttributeNamespaces || {}, DOMAttributeNames = domPropertyConfig.DOMAttributeNames || {}, DOMPropertyNames = domPropertyConfig.DOMPropertyNames || {}, DOMMutationMethods = domPropertyConfig.DOMMutationMethods || {};
        domPropertyConfig.isCustomAttribute && DOMProperty._isCustomAttributeFunctions.push(domPropertyConfig.isCustomAttribute);
        for (var propName in Properties) {
            invariant(!DOMProperty.properties.hasOwnProperty(propName), "injectDOMPropertyConfig(...): You're trying to inject DOM property " + "'%s' which has already been injected. You may be accidentally " + "injecting the same DOM property config twice, or you may be " + "injecting two configs that have conflicting property names.", propName);
            var lowerCased = propName.toLowerCase(), propConfig = Properties[propName], propertyInfo = {
                attributeName: lowerCased,
                attributeNamespace: null,
                propertyName: propName,
                mutationMethod: null,
                mustUseProperty: checkMask(propConfig, Injection.MUST_USE_PROPERTY),
                hasBooleanValue: checkMask(propConfig, Injection.HAS_BOOLEAN_VALUE),
                hasNumericValue: checkMask(propConfig, Injection.HAS_NUMERIC_VALUE),
                hasPositiveNumericValue: checkMask(propConfig, Injection.HAS_POSITIVE_NUMERIC_VALUE),
                hasOverloadedBooleanValue: checkMask(propConfig, Injection.HAS_OVERLOADED_BOOLEAN_VALUE)
            };
            if (invariant(propertyInfo.hasBooleanValue + propertyInfo.hasNumericValue + propertyInfo.hasOverloadedBooleanValue <= 1, "DOMProperty: Value can be one of boolean, overloaded boolean, or " + "numeric value, but not a combination: %s", propName), 
            DOMAttributeNames.hasOwnProperty(propName)) {
                var attributeName = DOMAttributeNames[propName];
                propertyInfo.attributeName = attributeName;
            }
            DOMAttributeNamespaces.hasOwnProperty(propName) && (propertyInfo.attributeNamespace = DOMAttributeNamespaces[propName]), 
            DOMPropertyNames.hasOwnProperty(propName) && (propertyInfo.propertyName = DOMPropertyNames[propName]), 
            DOMMutationMethods.hasOwnProperty(propName) && (propertyInfo.mutationMethod = DOMMutationMethods[propName]), 
            DOMProperty.properties[propName] = propertyInfo;
        }
    }
}, ATTRIBUTE_NAME_START_CHAR = ":A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD", DOMProperty = {
    ID_ATTRIBUTE_NAME: "data-reactid",
    ROOT_ATTRIBUTE_NAME: "data-reactroot",
    ATTRIBUTE_NAME_START_CHAR: ATTRIBUTE_NAME_START_CHAR,
    ATTRIBUTE_NAME_CHAR: ATTRIBUTE_NAME_START_CHAR + "\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040",
    /**
   * Map from property "standard name" to an object with info about how to set
   * the property in the DOM. Each object contains:
   *
   * attributeName:
   *   Used when rendering markup or with `*Attribute()`.
   * attributeNamespace
   * propertyName:
   *   Used on DOM node instances. (This includes properties that mutate due to
   *   external factors.)
   * mutationMethod:
   *   If non-null, used instead of the property or `setAttribute()` after
   *   initial render.
   * mustUseProperty:
   *   Whether the property must be accessed and mutated as an object property.
   * hasBooleanValue:
   *   Whether the property should be removed when set to a falsey value.
   * hasNumericValue:
   *   Whether the property must be numeric or parse as a numeric and should be
   *   removed when set to a falsey value.
   * hasPositiveNumericValue:
   *   Whether the property must be positive numeric or parse as a positive
   *   numeric and should be removed when set to a falsey value.
   * hasOverloadedBooleanValue:
   *   Whether the property can be used as a flag as well as with a value.
   *   Removed when strictly equal to false; present without a value when
   *   strictly equal to true; present with a value otherwise.
   */
    properties: {},
    /**
   * Mapping from lowercase property names to the properly cased version, used
   * to warn in the case of missing properties. Available only in false.
   *
   * autofocus is predefined, because adding it to the property whitelist
   * causes unintended side effects.
   *
   * @type {Object}
   */
    getPossibleStandardName: null,
    /**
   * All of the isCustomAttribute() functions that have been injected.
   */
    _isCustomAttributeFunctions: [],
    /**
   * Checks whether a property name is a custom attribute.
   * @method
   */
    isCustomAttribute: function(attributeName) {
        for (var i = 0; i < DOMProperty._isCustomAttributeFunctions.length; i++) {
            if ((0, DOMProperty._isCustomAttributeFunctions[i])(attributeName)) return !0;
        }
        return !1;
    },
    injection: DOMPropertyInjection
}, DOMProperty_1 = DOMProperty, fiberHostComponent = null, ReactControlledComponentInjection = {
    injectFiberControlledHostComponent: function(hostComponentImpl) {
        // The fiber implementation doesn't use dynamic dispatch so we need to
        // inject the implementation.
        fiberHostComponent = hostComponentImpl;
    }
}, restoreTarget = null, restoreQueue = null;

function restoreStateOfTarget(target) {
    // We perform this translation at the end of the event loop so that we
    // always receive the correct fiber here
    var internalInstance = EventPluginUtils_1.getInstanceFromNode(target);
    if (internalInstance) {
        if ("number" == typeof internalInstance.tag) {
            invariant(fiberHostComponent && "function" == typeof fiberHostComponent.restoreControlledState, "Fiber needs to be injected to handle a fiber target for controlled " + "events.");
            var props = EventPluginUtils_1.getFiberCurrentPropsFromNode(internalInstance.stateNode);
            return void fiberHostComponent.restoreControlledState(internalInstance.stateNode, internalInstance.type, props);
        }
        invariant("function" == typeof internalInstance.restoreControlledState, "The internal instance must be a React host component."), 
        // If it is not a Fiber, we can just use dynamic dispatch.
        internalInstance.restoreControlledState();
    }
}

var ReactControlledComponent = {
    injection: ReactControlledComponentInjection,
    enqueueStateRestore: function(target) {
        restoreTarget ? restoreQueue ? restoreQueue.push(target) : restoreQueue = [ target ] : restoreTarget = target;
    },
    restoreStateIfNeeded: function() {
        if (restoreTarget) {
            var target = restoreTarget, queuedTargets = restoreQueue;
            if (restoreTarget = null, restoreQueue = null, restoreStateOfTarget(target), queuedTargets) for (var i = 0; i < queuedTargets.length; i++) restoreStateOfTarget(queuedTargets[i]);
        }
    }
}, ReactControlledComponent_1 = ReactControlledComponent, ReactDOMComponentFlags = {
    hasCachedChildNodes: 1 << 0
}, ReactDOMComponentFlags_1 = ReactDOMComponentFlags, HTMLNodeType = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_FRAGMENT_NODE: 11
}, HTMLNodeType_1 = HTMLNodeType, HostComponent$1 = ReactTypeOfWork.HostComponent, HostText = ReactTypeOfWork.HostText, ELEMENT_NODE = HTMLNodeType_1.ELEMENT_NODE, COMMENT_NODE = HTMLNodeType_1.COMMENT_NODE, ATTR_NAME = DOMProperty_1.ID_ATTRIBUTE_NAME, Flags = ReactDOMComponentFlags_1, randomKey = Math.random().toString(36).slice(2), internalInstanceKey = "__reactInternalInstance$" + randomKey, internalEventHandlersKey = "__reactEventHandlers$" + randomKey;

/**
 * Check if a given node should be cached.
 */
function shouldPrecacheNode(node, nodeID) {
    return node.nodeType === ELEMENT_NODE && node.getAttribute(ATTR_NAME) === "" + nodeID || node.nodeType === COMMENT_NODE && node.nodeValue === " react-text: " + nodeID + " " || node.nodeType === COMMENT_NODE && node.nodeValue === " react-empty: " + nodeID + " ";
}

/**
 * Drill down (through composites and empty components) until we get a host or
 * host text component.
 *
 * This is pretty polymorphic but unavoidable with the current structure we have
 * for `_renderedChildren`.
 */
function getRenderedHostOrTextFromComponent(component) {
    for (var rendered; rendered = component._renderedComponent; ) component = rendered;
    return component;
}

/**
 * Populate `_hostNode` on the rendered host/text component with the given
 * DOM node. The passed `inst` can be a composite.
 */
function precacheNode(inst, node) {
    var hostInst = getRenderedHostOrTextFromComponent(inst);
    hostInst._hostNode = node, node[internalInstanceKey] = hostInst;
}

function precacheFiberNode(hostInst, node) {
    node[internalInstanceKey] = hostInst;
}

function uncacheNode(inst) {
    var node = inst._hostNode;
    node && (delete node[internalInstanceKey], inst._hostNode = null);
}

/**
 * Populate `_hostNode` on each child of `inst`, assuming that the children
 * match up with the DOM (element) children of `node`.
 *
 * We cache entire levels at once to avoid an n^2 problem where we access the
 * children of a node sequentially and have to walk from the start to our target
 * node every time.
 *
 * Since we update `_renderedChildren` and the actual DOM at (slightly)
 * different times, we could race here and see a newer `_renderedChildren` than
 * the DOM nodes we see. To avoid this, ReactMultiChild calls
 * `prepareToManageChildren` before we change `_renderedChildren`, at which
 * time the container's child nodes are always cached (until it unmounts).
 */
function precacheChildNodes(inst, node) {
    if (!(inst._flags & Flags.hasCachedChildNodes)) {
        var children = inst._renderedChildren, childNode = node.firstChild;
        outer: for (var name in children) if (children.hasOwnProperty(name)) {
            var childInst = children[name], childID = getRenderedHostOrTextFromComponent(childInst)._domID;
            if (0 !== childID) {
                // We assume the child nodes are in the same order as the child instances.
                for (;null !== childNode; childNode = childNode.nextSibling) if (shouldPrecacheNode(childNode, childID)) {
                    precacheNode(childInst, childNode);
                    continue outer;
                }
                // We reached the end of the DOM children without finding an ID match.
                invariant(!1, "Unable to find element with ID %s.", childID);
            }
        }
        inst._flags |= Flags.hasCachedChildNodes;
    }
}

/**
 * Given a DOM node, return the closest ReactDOMComponent or
 * ReactDOMTextComponent instance ancestor.
 */
function getClosestInstanceFromNode(node) {
    if (node[internalInstanceKey]) return node[internalInstanceKey];
    for (// Walk up the tree until we find an ancestor whose instance we have cached.
    var parents = []; !node[internalInstanceKey]; ) {
        if (parents.push(node), !node.parentNode) // Top of the tree. This node must not be part of a React tree (or is
        // unmounted, potentially).
        return null;
        node = node.parentNode;
    }
    var closest, inst = node[internalInstanceKey];
    if (inst.tag === HostComponent$1 || inst.tag === HostText) // In Fiber, this will always be the deepest root.
    return inst;
    for (;node && (inst = node[internalInstanceKey]); node = parents.pop()) closest = inst, 
    parents.length && precacheChildNodes(inst, node);
    return closest;
}

/**
 * Given a DOM node, return the ReactDOMComponent or ReactDOMTextComponent
 * instance, or null if the node was not rendered by this React.
 */
function getInstanceFromNode(node) {
    var inst = node[internalInstanceKey];
    return inst ? inst.tag === HostComponent$1 || inst.tag === HostText ? inst : inst._hostNode === node ? inst : null : (inst = getClosestInstanceFromNode(node), 
    null != inst && inst._hostNode === node ? inst : null);
}

/**
 * Given a ReactDOMComponent or ReactDOMTextComponent, return the corresponding
 * DOM node.
 */
function getNodeFromInstance(inst) {
    if (inst.tag === HostComponent$1 || inst.tag === HostText) // In Fiber this, is just the state node right now. We assume it will be
    // a host component or host text.
    return inst.stateNode;
    if (// Without this first invariant, passing a non-DOM-component triggers the next
    // invariant for a missing parent, which is super confusing.
    invariant(void 0 !== inst._hostNode, "getNodeFromInstance: Invalid argument."), 
    inst._hostNode) return inst._hostNode;
    for (// Walk up the tree until we find an ancestor whose DOM node we have cached.
    var parents = []; !inst._hostNode; ) parents.push(inst), invariant(inst._hostParent, "React DOM tree root should always have a node reference."), 
    inst = inst._hostParent;
    // Now parents contains each ancestor that does *not* have a cached native
    // node, and `inst` is the deepest ancestor that does.
    for (;parents.length; inst = parents.pop()) precacheChildNodes(inst, inst._hostNode);
    return inst._hostNode;
}

function getFiberCurrentPropsFromNode(node) {
    return node[internalEventHandlersKey] || null;
}

function updateFiberProps(node, props) {
    node[internalEventHandlersKey] = props;
}

var ReactDOMComponentTree = {
    getClosestInstanceFromNode: getClosestInstanceFromNode,
    getInstanceFromNode: getInstanceFromNode,
    getNodeFromInstance: getNodeFromInstance,
    precacheChildNodes: precacheChildNodes,
    precacheNode: precacheNode,
    uncacheNode: uncacheNode,
    precacheFiberNode: precacheFiberNode,
    getFiberCurrentPropsFromNode: getFiberCurrentPropsFromNode,
    updateFiberProps: updateFiberProps
}, ReactDOMComponentTree_1 = ReactDOMComponentTree, stackBatchedUpdates = function(fn, a, b, c, d, e) {
    return fn(a, b, c, d, e);
}, fiberBatchedUpdates = function(fn, bookkeeping) {
    return fn(bookkeeping);
};

function performFiberBatchedUpdates(fn, bookkeeping) {
    // If we have Fiber loaded, we need to wrap this in a batching call so that
    // Fiber can apply its default priority for this call.
    return fiberBatchedUpdates(fn, bookkeeping);
}

function batchedUpdates(fn, bookkeeping) {
    // We first perform work with the stack batching strategy, by passing our
    // indirection to it.
    return stackBatchedUpdates(performFiberBatchedUpdates, fn, bookkeeping);
}

var isNestingBatched = !1;

function batchedUpdatesWithControlledComponents(fn, bookkeeping) {
    if (isNestingBatched) // If we are currently inside another batch, we need to wait until it
    // fully completes before restoring state. Therefore, we add the target to
    // a queue of work.
    return batchedUpdates(fn, bookkeeping);
    isNestingBatched = !0;
    try {
        return batchedUpdates(fn, bookkeeping);
    } finally {
        // Here we wait until all updates have propagated, which is important
        // when using controlled components within layers:
        // https://github.com/facebook/react/issues/1698
        // Then we restore state of any controlled component.
        isNestingBatched = !1, ReactControlledComponent_1.restoreStateIfNeeded();
    }
}

var ReactGenericBatchingInjection = {
    injectStackBatchedUpdates: function(_batchedUpdates) {
        stackBatchedUpdates = _batchedUpdates;
    },
    injectFiberBatchedUpdates: function(_batchedUpdates) {
        fiberBatchedUpdates = _batchedUpdates;
    }
}, ReactGenericBatching = {
    batchedUpdates: batchedUpdatesWithControlledComponents,
    injection: ReactGenericBatchingInjection
}, ReactGenericBatching_1 = ReactGenericBatching;

function isCheckable(elem) {
    var type = elem.type, nodeName = elem.nodeName;
    return nodeName && "input" === nodeName.toLowerCase() && ("checkbox" === type || "radio" === type);
}

function getTracker(inst) {
    return "number" == typeof inst.tag && (inst = inst.stateNode), inst._wrapperState.valueTracker;
}

function attachTracker(inst, tracker) {
    inst._wrapperState.valueTracker = tracker;
}

function detachTracker(inst) {
    delete inst._wrapperState.valueTracker;
}

function getValueFromNode(node) {
    var value;
    return node && (value = isCheckable(node) ? "" + node.checked : node.value), value;
}

function trackValueOnNode(node, inst) {
    var valueField = isCheckable(node) ? "checked" : "value", descriptor = Object.getOwnPropertyDescriptor(node.constructor.prototype, valueField), currentValue = "" + node[valueField];
    // if someone has already defined a value or Safari, then bail
    // and don't track value will cause over reporting of changes,
    // but it's better then a hard failure
    // (needed for certain tests that spyOn input values and Safari)
    if (!node.hasOwnProperty(valueField) && "function" == typeof descriptor.get && "function" == typeof descriptor.set) {
        Object.defineProperty(node, valueField, {
            enumerable: descriptor.enumerable,
            configurable: !0,
            get: function() {
                return descriptor.get.call(this);
            },
            set: function(value) {
                currentValue = "" + value, descriptor.set.call(this, value);
            }
        });
        return {
            getValue: function() {
                return currentValue;
            },
            setValue: function(value) {
                currentValue = "" + value;
            },
            stopTracking: function() {
                detachTracker(inst), delete node[valueField];
            }
        };
    }
}

var inputValueTracking = {
    // exposed for testing
    _getTrackerFromNode: function(node) {
        return getTracker(ReactDOMComponentTree_1.getInstanceFromNode(node));
    },
    trackNode: function(node) {
        node._wrapperState.valueTracker || (node._wrapperState.valueTracker = trackValueOnNode(node, node));
    },
    track: function(inst) {
        if (!getTracker(inst)) {
            attachTracker(inst, trackValueOnNode(ReactDOMComponentTree_1.getNodeFromInstance(inst), inst));
        }
    },
    updateValueIfChanged: function(inst) {
        if (!inst) return !1;
        var tracker = getTracker(inst);
        if (!tracker) return "number" == typeof inst.tag ? inputValueTracking.trackNode(inst.stateNode) : inputValueTracking.track(inst), 
        !0;
        var lastValue = tracker.getValue(), nextValue = getValueFromNode(ReactDOMComponentTree_1.getNodeFromInstance(inst));
        return nextValue !== lastValue && (tracker.setValue(nextValue), !0);
    },
    stopTracking: function(inst) {
        var tracker = getTracker(inst);
        tracker && tracker.stopTracking();
    }
}, inputValueTracking_1 = inputValueTracking, TEXT_NODE = HTMLNodeType_1.TEXT_NODE;

/**
 * Gets the target node from a native browser event by accounting for
 * inconsistencies in browser DOM APIs.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {DOMEventTarget} Target node.
 */
function getEventTarget(nativeEvent) {
    var target = nativeEvent.target || nativeEvent.srcElement || window;
    // Safari may fire events on text nodes (Node.TEXT_NODE is 3).
    // @see http://www.quirksmode.org/js/events_properties.html
    // Normalize SVG <use> element events #4963
    return target.correspondingUseElement && (target = target.correspondingUseElement), 
    target.nodeType === TEXT_NODE ? target.parentNode : target;
}

var getEventTarget_1 = getEventTarget, useHasFeature;

ExecutionEnvironment.canUseDOM && (useHasFeature = document.implementation && document.implementation.hasFeature && // always returns true in newer browsers as per the standard.
// @see http://dom.spec.whatwg.org/#dom-domimplementation-hasfeature
!0 !== document.implementation.hasFeature("", ""));

/**
 * Checks if an event is supported in the current execution environment.
 *
 * NOTE: This will not work correctly for non-generic events such as `change`,
 * `reset`, `load`, `error`, and `select`.
 *
 * Borrows from Modernizr.
 *
 * @param {string} eventNameSuffix Event name, e.g. "click".
 * @param {?boolean} capture Check if the capture phase is supported.
 * @return {boolean} True if the event is supported.
 * @internal
 * @license Modernizr 3.0.0pre (Custom Build) | MIT
 */
function isEventSupported(eventNameSuffix, capture) {
    if (!ExecutionEnvironment.canUseDOM || capture && !("addEventListener" in document)) return !1;
    var eventName = "on" + eventNameSuffix, isSupported = eventName in document;
    if (!isSupported) {
        var element = document.createElement("div");
        element.setAttribute(eventName, "return;"), isSupported = "function" == typeof element[eventName];
    }
    // This is the only way to test support for the `wheel` event in IE9+.
    return !isSupported && useHasFeature && "wheel" === eventNameSuffix && (isSupported = document.implementation.hasFeature("Events.wheel", "3.0")), 
    isSupported;
}

var isEventSupported_1 = isEventSupported, supportedInputTypes = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0
};

function isTextInputElement(elem) {
    var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
    return "input" === nodeName ? !!supportedInputTypes[elem.type] : "textarea" === nodeName;
}

var isTextInputElement_1 = isTextInputElement, eventTypes$1 = {
    change: {
        phasedRegistrationNames: {
            bubbled: "onChange",
            captured: "onChangeCapture"
        },
        dependencies: [ "topBlur", "topChange", "topClick", "topFocus", "topInput", "topKeyDown", "topKeyUp", "topSelectionChange" ]
    }
};

function createAndAccumulateChangeEvent(inst, nativeEvent, target) {
    var event = SyntheticEvent_1.getPooled(eventTypes$1.change, inst, nativeEvent, target);
    // Flag this event loop as needing state restore.
    return event.type = "change", ReactControlledComponent_1.enqueueStateRestore(target), 
    EventPropagators_1.accumulateTwoPhaseDispatches(event), event;
}

/**
 * For IE shims
 */
var activeElement = null, activeElementInst = null;

/**
 * SECTION: handle `change` event
 */
function shouldUseChangeEvent(elem) {
    var nodeName = elem.nodeName && elem.nodeName.toLowerCase();
    return "select" === nodeName || "input" === nodeName && "file" === elem.type;
}

function manualDispatchChangeEvent(nativeEvent) {
    var event = createAndAccumulateChangeEvent(activeElementInst, nativeEvent, getEventTarget_1(nativeEvent));
    // If change and propertychange bubbled, we'd just bind to it like all the
    // other events and have it go through ReactBrowserEventEmitter. Since it
    // doesn't, we manually listen for the events and so we have to enqueue and
    // process the abstract event manually.
    //
    // Batching is necessary here in order to ensure that all event handlers run
    // before the next rerender (including event handlers attached to ancestor
    // elements instead of directly on the input). Without this, controlled
    // components don't work properly in conjunction with event bubbling because
    // the component is rerendered and the value reverted before all the event
    // handlers can run. See https://github.com/facebook/react/issues/708.
    ReactGenericBatching_1.batchedUpdates(runEventInBatch, event);
}

function runEventInBatch(event) {
    EventPluginHub_1.enqueueEvents(event), EventPluginHub_1.processEventQueue(!1);
}

function getInstIfValueChanged(targetInst) {
    if (inputValueTracking_1.updateValueIfChanged(targetInst)) return targetInst;
}

function getTargetInstForChangeEvent(topLevelType, targetInst) {
    if ("topChange" === topLevelType) return targetInst;
}

/**
 * SECTION: handle `input` event
 */
var isInputEventSupported = !1;

ExecutionEnvironment.canUseDOM && (// IE9 claims to support the input event but fails to trigger it when
// deleting text, so we ignore its input events.
isInputEventSupported = isEventSupported_1("input") && (!document.documentMode || document.documentMode > 9));

/**
 * (For IE <=9) Starts tracking propertychange events on the passed-in element
 * and override the value property so that we can distinguish user events from
 * value changes in JS.
 */
function startWatchingForValueChange(target, targetInst) {
    activeElement = target, activeElementInst = targetInst, activeElement.attachEvent("onpropertychange", handlePropertyChange);
}

/**
 * (For IE <=9) Removes the event listeners from the currently-tracked element,
 * if any exists.
 */
function stopWatchingForValueChange() {
    activeElement && (activeElement.detachEvent("onpropertychange", handlePropertyChange), 
    activeElement = null, activeElementInst = null);
}

/**
 * (For IE <=9) Handles a propertychange event, sending a `change` event if
 * the value of the active element has changed.
 */
function handlePropertyChange(nativeEvent) {
    "value" === nativeEvent.propertyName && getInstIfValueChanged(activeElementInst) && manualDispatchChangeEvent(nativeEvent);
}

function handleEventsForInputEventPolyfill(topLevelType, target, targetInst) {
    "topFocus" === topLevelType ? (// In IE9, propertychange fires for most input events but is buggy and
    // doesn't fire when text is deleted, but conveniently, selectionchange
    // appears to fire in all of the remaining cases so we catch those and
    // forward the event if the value has changed
    // In either case, we don't want to call the event handler if the value
    // is changed from JS so we redefine a setter for `.value` that updates
    // our activeElementValue variable, allowing us to ignore those changes
    //
    // stopWatching() should be a noop here but we call it just in case we
    // missed a blur event somehow.
    stopWatchingForValueChange(), startWatchingForValueChange(target, targetInst)) : "topBlur" === topLevelType && stopWatchingForValueChange();
}

// For IE8 and IE9.
function getTargetInstForInputEventPolyfill(topLevelType, targetInst) {
    if ("topSelectionChange" === topLevelType || "topKeyUp" === topLevelType || "topKeyDown" === topLevelType) // On the selectionchange event, the target is just document which isn't
    // helpful for us so just check activeElement instead.
    //
    // 99% of the time, keydown and keyup aren't necessary. IE8 fails to fire
    // propertychange on the first input event after setting `value` from a
    // script and fires only keydown, keypress, keyup. Catching keyup usually
    // gets it and catching keydown lets us fire an event for the first
    // keystroke if user does a key repeat (it'll be a little delayed: right
    // before the second keystroke). Other input methods (e.g., paste) seem to
    // fire selectionchange normally.
    return getInstIfValueChanged(activeElementInst);
}

/**
 * SECTION: handle `click` event
 */
function shouldUseClickEvent(elem) {
    // Use the `click` event to detect changes to checkbox and radio inputs.
    // This approach works across all browsers, whereas `change` does not fire
    // until `blur` in IE8.
    var nodeName = elem.nodeName;
    return nodeName && "input" === nodeName.toLowerCase() && ("checkbox" === elem.type || "radio" === elem.type);
}

function getTargetInstForClickEvent(topLevelType, targetInst) {
    if ("topClick" === topLevelType) return getInstIfValueChanged(targetInst);
}

function getTargetInstForInputOrChangeEvent(topLevelType, targetInst) {
    if ("topInput" === topLevelType || "topChange" === topLevelType) return getInstIfValueChanged(targetInst);
}

function handleControlledInputBlur(inst, node) {
    // TODO: In IE, inst is occasionally null. Why?
    if (null != inst) {
        // Fiber and ReactDOM keep wrapper state in separate places
        var state = inst._wrapperState || node._wrapperState;
        if (state && state.controlled && "number" === node.type) {
            // If controlled, assign the value attribute to the current value on blur
            var value = "" + node.value;
            node.getAttribute("value") !== value && node.setAttribute("value", value);
        }
    }
}

/**
 * This plugin creates an `onChange` event that normalizes change events
 * across form elements. This event fires at a time when it's possible to
 * change the element's value without seeing a flicker.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - select
 */
var ChangeEventPlugin = {
    eventTypes: eventTypes$1,
    _isInputEventSupported: isInputEventSupported,
    extractEvents: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
        var getTargetInstFunc, handleEventFunc, targetNode = targetInst ? ReactDOMComponentTree_1.getNodeFromInstance(targetInst) : window;
        if (shouldUseChangeEvent(targetNode) ? getTargetInstFunc = getTargetInstForChangeEvent : isTextInputElement_1(targetNode) ? isInputEventSupported ? getTargetInstFunc = getTargetInstForInputOrChangeEvent : (getTargetInstFunc = getTargetInstForInputEventPolyfill, 
        handleEventFunc = handleEventsForInputEventPolyfill) : shouldUseClickEvent(targetNode) && (getTargetInstFunc = getTargetInstForClickEvent), 
        getTargetInstFunc) {
            var inst = getTargetInstFunc(topLevelType, targetInst);
            if (inst) {
                return createAndAccumulateChangeEvent(inst, nativeEvent, nativeEventTarget);
            }
        }
        handleEventFunc && handleEventFunc(topLevelType, targetNode, targetInst), // When blurring, set the value attribute for number inputs
        "topBlur" === topLevelType && handleControlledInputBlur(targetInst, targetNode);
    }
}, ChangeEventPlugin_1 = ChangeEventPlugin, DOMEventPluginOrder = [ "ResponderEventPlugin", "SimpleEventPlugin", "TapEventPlugin", "EnterLeaveEventPlugin", "ChangeEventPlugin", "SelectEventPlugin", "BeforeInputEventPlugin" ], DOMEventPluginOrder_1 = DOMEventPluginOrder, UIEventInterface = {
    view: function(event) {
        if (event.view) return event.view;
        var target = getEventTarget_1(event);
        if (target.window === target) // target is a window object
        return target;
        var doc = target.ownerDocument;
        // TODO: Figure out why `ownerDocument` is sometimes undefined in IE8.
        // TODO: Figure out why `ownerDocument` is sometimes undefined in IE8.
        return doc ? doc.defaultView || doc.parentWindow : window;
    },
    detail: function(event) {
        return event.detail || 0;
    }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticEvent}
 */
function SyntheticUIEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent_1.augmentClass(SyntheticUIEvent, UIEventInterface);

var SyntheticUIEvent_1 = SyntheticUIEvent, modifierKeyToProp = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
};

// IE8 does not implement getModifierState so we simply map it to the only
// modifier keys exposed by the event itself, does not support Lock-keys.
// Currently, all major browsers except Chrome seems to support Lock-keys.
function modifierStateGetter(keyArg) {
    var syntheticEvent = this, nativeEvent = syntheticEvent.nativeEvent;
    if (nativeEvent.getModifierState) return nativeEvent.getModifierState(keyArg);
    var keyProp = modifierKeyToProp[keyArg];
    return !!keyProp && !!nativeEvent[keyProp];
}

function getEventModifierState(nativeEvent) {
    return modifierStateGetter;
}

var getEventModifierState_1 = getEventModifierState, MouseEventInterface = {
    screenX: null,
    screenY: null,
    clientX: null,
    clientY: null,
    pageX: null,
    pageY: null,
    ctrlKey: null,
    shiftKey: null,
    altKey: null,
    metaKey: null,
    getModifierState: getEventModifierState_1,
    button: null,
    buttons: null,
    relatedTarget: function(event) {
        return event.relatedTarget || (event.fromElement === event.srcElement ? event.toElement : event.fromElement);
    }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticMouseEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticUIEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent_1.augmentClass(SyntheticMouseEvent, MouseEventInterface);

var SyntheticMouseEvent_1 = SyntheticMouseEvent, eventTypes$2 = {
    mouseEnter: {
        registrationName: "onMouseEnter",
        dependencies: [ "topMouseOut", "topMouseOver" ]
    },
    mouseLeave: {
        registrationName: "onMouseLeave",
        dependencies: [ "topMouseOut", "topMouseOver" ]
    }
}, EnterLeaveEventPlugin = {
    eventTypes: eventTypes$2,
    /**
   * For almost every interaction we care about, there will be both a top-level
   * `mouseover` and `mouseout` event that occurs. Only use `mouseout` so that
   * we do not extract duplicate events. However, moving the mouse into the
   * browser from outside will not fire a `mouseout` event. In this case, we use
   * the `mouseover` top-level event.
   */
    extractEvents: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
        if ("topMouseOver" === topLevelType && (nativeEvent.relatedTarget || nativeEvent.fromElement)) return null;
        if ("topMouseOut" !== topLevelType && "topMouseOver" !== topLevelType) // Must not be a mouse in or mouse out - ignoring.
        return null;
        var win;
        if (nativeEventTarget.window === nativeEventTarget) // `nativeEventTarget` is probably a window object.
        win = nativeEventTarget; else {
            // TODO: Figure out why `ownerDocument` is sometimes undefined in IE8.
            var doc = nativeEventTarget.ownerDocument;
            win = doc ? doc.defaultView || doc.parentWindow : window;
        }
        var from, to;
        if ("topMouseOut" === topLevelType) {
            from = targetInst;
            var related = nativeEvent.relatedTarget || nativeEvent.toElement;
            to = related ? ReactDOMComponentTree_1.getClosestInstanceFromNode(related) : null;
        } else // Moving to a node from outside the window.
        from = null, to = targetInst;
        if (from === to) // Nothing pertains to our managed components.
        return null;
        var fromNode = null == from ? win : ReactDOMComponentTree_1.getNodeFromInstance(from), toNode = null == to ? win : ReactDOMComponentTree_1.getNodeFromInstance(to), leave = SyntheticMouseEvent_1.getPooled(eventTypes$2.mouseLeave, from, nativeEvent, nativeEventTarget);
        leave.type = "mouseleave", leave.target = fromNode, leave.relatedTarget = toNode;
        var enter = SyntheticMouseEvent_1.getPooled(eventTypes$2.mouseEnter, to, nativeEvent, nativeEventTarget);
        return enter.type = "mouseenter", enter.target = toNode, enter.relatedTarget = fromNode, 
        EventPropagators_1.accumulateEnterLeaveDispatches(leave, enter, from, to), [ leave, enter ];
    }
}, EnterLeaveEventPlugin_1 = EnterLeaveEventPlugin, MUST_USE_PROPERTY = DOMProperty_1.injection.MUST_USE_PROPERTY, HAS_BOOLEAN_VALUE = DOMProperty_1.injection.HAS_BOOLEAN_VALUE, HAS_NUMERIC_VALUE = DOMProperty_1.injection.HAS_NUMERIC_VALUE, HAS_POSITIVE_NUMERIC_VALUE = DOMProperty_1.injection.HAS_POSITIVE_NUMERIC_VALUE, HAS_OVERLOADED_BOOLEAN_VALUE = DOMProperty_1.injection.HAS_OVERLOADED_BOOLEAN_VALUE, HTMLDOMPropertyConfig = {
    isCustomAttribute: RegExp.prototype.test.bind(new RegExp("^(data|aria)-[" + DOMProperty_1.ATTRIBUTE_NAME_CHAR + "]*$")),
    Properties: {
        /**
     * Standard Properties
     */
        accept: 0,
        acceptCharset: 0,
        accessKey: 0,
        action: 0,
        allowFullScreen: HAS_BOOLEAN_VALUE,
        allowTransparency: 0,
        alt: 0,
        // specifies target context for links with `preload` type
        as: 0,
        async: HAS_BOOLEAN_VALUE,
        autoComplete: 0,
        // autoFocus is polyfilled/normalized by AutoFocusUtils
        // autoFocus: HAS_BOOLEAN_VALUE,
        autoPlay: HAS_BOOLEAN_VALUE,
        capture: HAS_BOOLEAN_VALUE,
        cellPadding: 0,
        cellSpacing: 0,
        charSet: 0,
        challenge: 0,
        checked: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
        cite: 0,
        classID: 0,
        className: 0,
        cols: HAS_POSITIVE_NUMERIC_VALUE,
        colSpan: 0,
        content: 0,
        contentEditable: 0,
        contextMenu: 0,
        controls: HAS_BOOLEAN_VALUE,
        controlsList: 0,
        coords: 0,
        crossOrigin: 0,
        data: 0,
        // For `<object />` acts as `src`.
        dateTime: 0,
        default: HAS_BOOLEAN_VALUE,
        defer: HAS_BOOLEAN_VALUE,
        dir: 0,
        disabled: HAS_BOOLEAN_VALUE,
        download: HAS_OVERLOADED_BOOLEAN_VALUE,
        draggable: 0,
        encType: 0,
        form: 0,
        formAction: 0,
        formEncType: 0,
        formMethod: 0,
        formNoValidate: HAS_BOOLEAN_VALUE,
        formTarget: 0,
        frameBorder: 0,
        headers: 0,
        height: 0,
        hidden: HAS_BOOLEAN_VALUE,
        high: 0,
        href: 0,
        hrefLang: 0,
        htmlFor: 0,
        httpEquiv: 0,
        id: 0,
        inputMode: 0,
        integrity: 0,
        is: 0,
        keyParams: 0,
        keyType: 0,
        kind: 0,
        label: 0,
        lang: 0,
        list: 0,
        loop: HAS_BOOLEAN_VALUE,
        low: 0,
        manifest: 0,
        marginHeight: 0,
        marginWidth: 0,
        max: 0,
        maxLength: 0,
        media: 0,
        mediaGroup: 0,
        method: 0,
        min: 0,
        minLength: 0,
        // Caution; `option.selected` is not updated if `select.multiple` is
        // disabled with `removeAttribute`.
        multiple: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
        muted: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
        name: 0,
        nonce: 0,
        noValidate: HAS_BOOLEAN_VALUE,
        open: HAS_BOOLEAN_VALUE,
        optimum: 0,
        pattern: 0,
        placeholder: 0,
        playsInline: HAS_BOOLEAN_VALUE,
        poster: 0,
        preload: 0,
        profile: 0,
        radioGroup: 0,
        readOnly: HAS_BOOLEAN_VALUE,
        referrerPolicy: 0,
        rel: 0,
        required: HAS_BOOLEAN_VALUE,
        reversed: HAS_BOOLEAN_VALUE,
        role: 0,
        rows: HAS_POSITIVE_NUMERIC_VALUE,
        rowSpan: HAS_NUMERIC_VALUE,
        sandbox: 0,
        scope: 0,
        scoped: HAS_BOOLEAN_VALUE,
        scrolling: 0,
        seamless: HAS_BOOLEAN_VALUE,
        selected: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
        shape: 0,
        size: HAS_POSITIVE_NUMERIC_VALUE,
        sizes: 0,
        // support for projecting regular DOM Elements via V1 named slots ( shadow dom )
        slot: 0,
        span: HAS_POSITIVE_NUMERIC_VALUE,
        spellCheck: 0,
        src: 0,
        srcDoc: 0,
        srcLang: 0,
        srcSet: 0,
        start: HAS_NUMERIC_VALUE,
        step: 0,
        style: 0,
        summary: 0,
        tabIndex: 0,
        target: 0,
        title: 0,
        // Setting .type throws on non-<input> tags
        type: 0,
        useMap: 0,
        value: 0,
        width: 0,
        wmode: 0,
        wrap: 0,
        /**
     * RDFa Properties
     */
        about: 0,
        datatype: 0,
        inlist: 0,
        prefix: 0,
        // property is also supported for OpenGraph in meta tags.
        property: 0,
        resource: 0,
        typeof: 0,
        vocab: 0,
        /**
     * Non-standard Properties
     */
        // autoCapitalize and autoCorrect are supported in Mobile Safari for
        // keyboard hints.
        autoCapitalize: 0,
        autoCorrect: 0,
        // autoSave allows WebKit/Blink to persist values of input fields on page reloads
        autoSave: 0,
        // color is for Safari mask-icon link
        color: 0,
        // itemProp, itemScope, itemType are for
        // Microdata support. See http://schema.org/docs/gs.html
        itemProp: 0,
        itemScope: HAS_BOOLEAN_VALUE,
        itemType: 0,
        // itemID and itemRef are for Microdata support as well but
        // only specified in the WHATWG spec document. See
        // https://html.spec.whatwg.org/multipage/microdata.html#microdata-dom-api
        itemID: 0,
        itemRef: 0,
        // results show looking glass icon and recent searches on input
        // search fields in WebKit/Blink
        results: 0,
        // IE-only attribute that specifies security restrictions on an iframe
        // as an alternative to the sandbox attribute on IE<10
        security: 0,
        // IE-only attribute that controls focus behavior
        unselectable: 0
    },
    DOMAttributeNames: {
        acceptCharset: "accept-charset",
        className: "class",
        htmlFor: "for",
        httpEquiv: "http-equiv"
    },
    DOMPropertyNames: {},
    DOMMutationMethods: {
        value: function(node, value) {
            if (null == value) return node.removeAttribute("value");
            // Number inputs get special treatment due to some edge cases in
            // Chrome. Let everything else assign the value attribute as normal.
            // https://github.com/facebook/react/issues/7253#issuecomment-236074326
            "number" !== node.type || !1 === node.hasAttribute("value") ? node.setAttribute("value", "" + value) : node.validity && !node.validity.badInput && node.ownerDocument.activeElement !== node && // Don't assign an attribute if validation reports bad
            // input. Chrome will clear the value. Additionally, don't
            // operate on inputs that have focus, otherwise Chrome might
            // strip off trailing decimal places and cause the user's
            // cursor position to jump to the beginning of the input.
            //
            // In ReactDOMInput, we have an onBlur event that will trigger
            // this function again when focus is lost.
            node.setAttribute("value", "" + value);
        }
    }
}, HTMLDOMPropertyConfig_1 = HTMLDOMPropertyConfig, ReactInstanceMap = {
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
}, ReactInstanceMap_1 = ReactInstanceMap, ReactTypeOfSideEffect = {
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
}, HostRoot$1 = ReactTypeOfWork.HostRoot, HostComponent$2 = ReactTypeOfWork.HostComponent, HostText$1 = ReactTypeOfWork.HostText, NoEffect = ReactTypeOfSideEffect.NoEffect, Placement = ReactTypeOfSideEffect.Placement, MOUNTING = 1, MOUNTED = 2, UNMOUNTED = 3;

function isFiberMountedImpl(fiber) {
    var node = fiber;
    if (fiber.alternate) for (;node.return; ) node = node.return; else {
        // If there is no alternate, this might be a new tree that isn't inserted
        // yet. If it is, then it will have a pending insertion effect on it.
        if ((node.effectTag & Placement) !== NoEffect) return MOUNTING;
        for (;node.return; ) if (node = node.return, (node.effectTag & Placement) !== NoEffect) return MOUNTING;
    }
    return node.tag === HostRoot$1 ? MOUNTED : UNMOUNTED;
}

var isFiberMounted = function(fiber) {
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
    return invariant(a.tag === HostRoot$1, "Unable to find node on an unmounted component."), 
    a.stateNode.current === a ? fiber : alternate;
}

var findCurrentFiberUsingSlowPath_1 = findCurrentFiberUsingSlowPath, findCurrentHostFiber = function(parent) {
    var currentParent = findCurrentFiberUsingSlowPath(parent);
    if (!currentParent) return null;
    for (// Next we'll drill down this component to find the first HostComponent/Text.
    var node = currentParent; !0; ) {
        if (node.tag === HostComponent$2 || node.tag === HostText$1) return node;
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
    isFiberMounted: isFiberMounted,
    isMounted: isMounted,
    findCurrentFiberUsingSlowPath: findCurrentFiberUsingSlowPath_1,
    findCurrentHostFiber: findCurrentHostFiber
}, HostRoot = ReactTypeOfWork.HostRoot;

/**
 * Find the deepest React component completely containing the root of the
 * passed-in instance (for use when entire React trees are nested within each
 * other). If React trees are not nested, returns null.
 */
function findRootContainerNode(inst) {
    // TODO: It may be a good idea to cache this to prevent unnecessary DOM
    // traversal, but caching is difficult to do correctly without using a
    // mutation observer to listen for all DOM changes.
    if ("number" == typeof inst.tag) {
        for (;inst.return; ) inst = inst.return;
        return inst.tag !== HostRoot ? null : inst.stateNode.containerInfo;
    }
    for (;inst._hostParent; ) inst = inst._hostParent;
    return ReactDOMComponentTree_1.getNodeFromInstance(inst).parentNode;
}

// Used to store ancestor hierarchy in top level callback
function TopLevelCallbackBookKeeping(topLevelType, nativeEvent, targetInst) {
    this.topLevelType = topLevelType, this.nativeEvent = nativeEvent, this.targetInst = targetInst, 
    this.ancestors = [];
}

Object.assign(TopLevelCallbackBookKeeping.prototype, {
    destructor: function() {
        this.topLevelType = null, this.nativeEvent = null, this.targetInst = null, this.ancestors.length = 0;
    }
}), PooledClass_1.addPoolingTo(TopLevelCallbackBookKeeping, PooledClass_1.threeArgumentPooler);

function handleTopLevelImpl(bookKeeping) {
    var targetInst = bookKeeping.targetInst, ancestor = targetInst;
    do {
        if (!ancestor) {
            bookKeeping.ancestors.push(ancestor);
            break;
        }
        var root = findRootContainerNode(ancestor);
        if (!root) break;
        bookKeeping.ancestors.push(ancestor), ancestor = ReactDOMComponentTree_1.getClosestInstanceFromNode(root);
    } while (ancestor);
    for (var i = 0; i < bookKeeping.ancestors.length; i++) targetInst = bookKeeping.ancestors[i], 
    ReactDOMEventListener._handleTopLevel(bookKeeping.topLevelType, targetInst, bookKeeping.nativeEvent, getEventTarget_1(bookKeeping.nativeEvent));
}

var ReactDOMEventListener = {
    _enabled: !0,
    _handleTopLevel: null,
    setHandleTopLevel: function(handleTopLevel) {
        ReactDOMEventListener._handleTopLevel = handleTopLevel;
    },
    setEnabled: function(enabled) {
        ReactDOMEventListener._enabled = !!enabled;
    },
    isEnabled: function() {
        return ReactDOMEventListener._enabled;
    },
    /**
   * Traps top-level events by using event bubbling.
   *
   * @param {string} topLevelType Record from `BrowserEventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} element Element on which to attach listener.
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
    trapBubbledEvent: function(topLevelType, handlerBaseName, element) {
        return element ? EventListener.listen(element, handlerBaseName, ReactDOMEventListener.dispatchEvent.bind(null, topLevelType)) : null;
    },
    /**
   * Traps a top-level event by using event capturing.
   *
   * @param {string} topLevelType Record from `BrowserEventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} element Element on which to attach listener.
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
    trapCapturedEvent: function(topLevelType, handlerBaseName, element) {
        return element ? EventListener.capture(element, handlerBaseName, ReactDOMEventListener.dispatchEvent.bind(null, topLevelType)) : null;
    },
    dispatchEvent: function(topLevelType, nativeEvent) {
        if (ReactDOMEventListener._enabled) {
            var nativeEventTarget = getEventTarget_1(nativeEvent), targetInst = ReactDOMComponentTree_1.getClosestInstanceFromNode(nativeEventTarget);
            null === targetInst || "number" != typeof targetInst.tag || ReactFiberTreeReflection.isFiberMounted(targetInst) || (// If we get an event (ex: img onload) before committing that
            // component's mount, ignore it for now (that is, treat it as if it was an
            // event on a non-React tree). We might also consider queueing events and
            // dispatching them after the mount.
            targetInst = null);
            var bookKeeping = TopLevelCallbackBookKeeping.getPooled(topLevelType, nativeEvent, targetInst);
            try {
                // Event queue being processed in the same cycle allows
                // `preventDefault`.
                ReactGenericBatching_1.batchedUpdates(handleTopLevelImpl, bookKeeping);
            } finally {
                TopLevelCallbackBookKeeping.release(bookKeeping);
            }
        }
    }
}, ReactDOMEventListener_1 = ReactDOMEventListener;

function runEventQueueInBatch(events) {
    EventPluginHub_1.enqueueEvents(events), EventPluginHub_1.processEventQueue(!1);
}

var ReactEventEmitterMixin = {
    /**
   * Streams a fired top-level event to `EventPluginHub` where plugins have the
   * opportunity to create `ReactEvent`s to be dispatched.
   */
    handleTopLevel: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
        runEventQueueInBatch(EventPluginHub_1.extractEvents(topLevelType, targetInst, nativeEvent, nativeEventTarget));
    }
}, ReactEventEmitterMixin_1 = ReactEventEmitterMixin;

/**
 * Generate a mapping of standard vendor prefixes using the defined style property and event name.
 *
 * @param {string} styleProp
 * @param {string} eventName
 * @returns {object}
 */
function makePrefixMap(styleProp, eventName) {
    var prefixes = {};
    return prefixes[styleProp.toLowerCase()] = eventName.toLowerCase(), prefixes["Webkit" + styleProp] = "webkit" + eventName, 
    prefixes["Moz" + styleProp] = "moz" + eventName, prefixes["ms" + styleProp] = "MS" + eventName, 
    prefixes["O" + styleProp] = "o" + eventName.toLowerCase(), prefixes;
}

/**
 * A list of event names to a configurable list of vendor prefixes.
 */
var vendorPrefixes = {
    animationend: makePrefixMap("Animation", "AnimationEnd"),
    animationiteration: makePrefixMap("Animation", "AnimationIteration"),
    animationstart: makePrefixMap("Animation", "AnimationStart"),
    transitionend: makePrefixMap("Transition", "TransitionEnd")
}, prefixedEventNames = {}, style = {};

/**
 * Bootstrap if a DOM exists.
 */
ExecutionEnvironment.canUseDOM && (style = document.createElement("div").style, 
// On some platforms, in particular some releases of Android 4.x,
// the un-prefixed "animation" and "transition" properties are defined on the
// style object but the events that fire will still be prefixed, so we need
// to check if the un-prefixed events are usable, and if not remove them from the map.
"AnimationEvent" in window || (delete vendorPrefixes.animationend.animation, delete vendorPrefixes.animationiteration.animation, 
delete vendorPrefixes.animationstart.animation), // Same as above
"TransitionEvent" in window || delete vendorPrefixes.transitionend.transition);

/**
 * Attempts to determine the correct vendor prefixed event name.
 *
 * @param {string} eventName
 * @returns {string}
 */
function getVendorPrefixedEventName(eventName) {
    if (prefixedEventNames[eventName]) return prefixedEventNames[eventName];
    if (!vendorPrefixes[eventName]) return eventName;
    var prefixMap = vendorPrefixes[eventName];
    for (var styleProp in prefixMap) if (prefixMap.hasOwnProperty(styleProp) && styleProp in style) return prefixedEventNames[eventName] = prefixMap[styleProp];
    return "";
}

var getVendorPrefixedEventName_1 = getVendorPrefixedEventName, topLevelTypes$1 = {
    topAbort: "abort",
    topAnimationEnd: getVendorPrefixedEventName_1("animationend") || "animationend",
    topAnimationIteration: getVendorPrefixedEventName_1("animationiteration") || "animationiteration",
    topAnimationStart: getVendorPrefixedEventName_1("animationstart") || "animationstart",
    topBlur: "blur",
    topCancel: "cancel",
    topCanPlay: "canplay",
    topCanPlayThrough: "canplaythrough",
    topChange: "change",
    topClick: "click",
    topClose: "close",
    topCompositionEnd: "compositionend",
    topCompositionStart: "compositionstart",
    topCompositionUpdate: "compositionupdate",
    topContextMenu: "contextmenu",
    topCopy: "copy",
    topCut: "cut",
    topDoubleClick: "dblclick",
    topDrag: "drag",
    topDragEnd: "dragend",
    topDragEnter: "dragenter",
    topDragExit: "dragexit",
    topDragLeave: "dragleave",
    topDragOver: "dragover",
    topDragStart: "dragstart",
    topDrop: "drop",
    topDurationChange: "durationchange",
    topEmptied: "emptied",
    topEncrypted: "encrypted",
    topEnded: "ended",
    topError: "error",
    topFocus: "focus",
    topInput: "input",
    topKeyDown: "keydown",
    topKeyPress: "keypress",
    topKeyUp: "keyup",
    topLoadedData: "loadeddata",
    topLoad: "load",
    topLoadedMetadata: "loadedmetadata",
    topLoadStart: "loadstart",
    topMouseDown: "mousedown",
    topMouseMove: "mousemove",
    topMouseOut: "mouseout",
    topMouseOver: "mouseover",
    topMouseUp: "mouseup",
    topPaste: "paste",
    topPause: "pause",
    topPlay: "play",
    topPlaying: "playing",
    topProgress: "progress",
    topRateChange: "ratechange",
    topScroll: "scroll",
    topSeeked: "seeked",
    topSeeking: "seeking",
    topSelectionChange: "selectionchange",
    topStalled: "stalled",
    topSuspend: "suspend",
    topTextInput: "textInput",
    topTimeUpdate: "timeupdate",
    topToggle: "toggle",
    topTouchCancel: "touchcancel",
    topTouchEnd: "touchend",
    topTouchMove: "touchmove",
    topTouchStart: "touchstart",
    topTransitionEnd: getVendorPrefixedEventName_1("transitionend") || "transitionend",
    topVolumeChange: "volumechange",
    topWaiting: "waiting",
    topWheel: "wheel"
}, BrowserEventConstants = {
    topLevelTypes: topLevelTypes$1
}, BrowserEventConstants_1 = BrowserEventConstants, topLevelTypes = BrowserEventConstants_1.topLevelTypes, alreadyListeningTo = {}, reactTopListenersCounter = 0, topListenersIDKey = "_reactListenersID" + ("" + Math.random()).slice(2);

function getListeningForDocument(mountAt) {
    // In IE8, `mountAt` is a host object and doesn't have `hasOwnProperty`
    // directly.
    return Object.prototype.hasOwnProperty.call(mountAt, topListenersIDKey) || (mountAt[topListenersIDKey] = reactTopListenersCounter++, 
    alreadyListeningTo[mountAt[topListenersIDKey]] = {}), alreadyListeningTo[mountAt[topListenersIDKey]];
}

var ReactBrowserEventEmitter = Object.assign({}, ReactEventEmitterMixin_1, {
    /**
   * Sets whether or not any created callbacks should be enabled.
   *
   * @param {boolean} enabled True if callbacks should be enabled.
   */
    setEnabled: function(enabled) {
        ReactDOMEventListener_1 && ReactDOMEventListener_1.setEnabled(enabled);
    },
    /**
   * @return {boolean} True if callbacks are enabled.
   */
    isEnabled: function() {
        return !(!ReactDOMEventListener_1 || !ReactDOMEventListener_1.isEnabled());
    },
    /**
   * We listen for bubbled touch events on the document object.
   *
   * Firefox v8.01 (and possibly others) exhibited strange behavior when
   * mounting `onmousemove` events at some node that was not the document
   * element. The symptoms were that if your mouse is not moving over something
   * contained within that mount point (for example on the background) the
   * top-level listeners for `onmousemove` won't be called. However, if you
   * register the `mousemove` on the document object, then it will of course
   * catch all `mousemove`s. This along with iOS quirks, justifies restricting
   * top-level listeners to the document object only, at least for these
   * movement types of events and possibly all events.
   *
   * @see http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
   *
   * Also, `keyup`/`keypress`/`keydown` do not bubble to the window on IE, but
   * they bubble to document.
   *
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @param {object} contentDocumentHandle Document which owns the container
   */
    listenTo: function(registrationName, contentDocumentHandle) {
        for (var mountAt = contentDocumentHandle, isListening = getListeningForDocument(mountAt), dependencies = EventPluginRegistry_1.registrationNameDependencies[registrationName], i = 0; i < dependencies.length; i++) {
            var dependency = dependencies[i];
            isListening.hasOwnProperty(dependency) && isListening[dependency] || ("topWheel" === dependency ? isEventSupported_1("wheel") ? ReactDOMEventListener_1.trapBubbledEvent("topWheel", "wheel", mountAt) : isEventSupported_1("mousewheel") ? ReactDOMEventListener_1.trapBubbledEvent("topWheel", "mousewheel", mountAt) : // Firefox needs to capture a different mouse scroll event.
            // @see http://www.quirksmode.org/dom/events/tests/scroll.html
            ReactDOMEventListener_1.trapBubbledEvent("topWheel", "DOMMouseScroll", mountAt) : "topScroll" === dependency ? ReactDOMEventListener_1.trapCapturedEvent("topScroll", "scroll", mountAt) : "topFocus" === dependency || "topBlur" === dependency ? (ReactDOMEventListener_1.trapCapturedEvent("topFocus", "focus", mountAt), 
            ReactDOMEventListener_1.trapCapturedEvent("topBlur", "blur", mountAt), // to make sure blur and focus event listeners are only attached once
            isListening.topBlur = !0, isListening.topFocus = !0) : "topCancel" === dependency ? (isEventSupported_1("cancel", !0) && ReactDOMEventListener_1.trapCapturedEvent("topCancel", "cancel", mountAt), 
            isListening.topCancel = !0) : "topClose" === dependency ? (isEventSupported_1("close", !0) && ReactDOMEventListener_1.trapCapturedEvent("topClose", "close", mountAt), 
            isListening.topClose = !0) : topLevelTypes.hasOwnProperty(dependency) && ReactDOMEventListener_1.trapBubbledEvent(dependency, topLevelTypes[dependency], mountAt), 
            isListening[dependency] = !0);
        }
    },
    isListeningToAllDependencies: function(registrationName, mountAt) {
        for (var isListening = getListeningForDocument(mountAt), dependencies = EventPluginRegistry_1.registrationNameDependencies[registrationName], i = 0; i < dependencies.length; i++) {
            var dependency = dependencies[i];
            if (!isListening.hasOwnProperty(dependency) || !isListening[dependency]) return !1;
        }
        return !0;
    },
    trapBubbledEvent: function(topLevelType, handlerBaseName, handle) {
        return ReactDOMEventListener_1.trapBubbledEvent(topLevelType, handlerBaseName, handle);
    },
    trapCapturedEvent: function(topLevelType, handlerBaseName, handle) {
        return ReactDOMEventListener_1.trapCapturedEvent(topLevelType, handlerBaseName, handle);
    }
}), ReactBrowserEventEmitter_1 = ReactBrowserEventEmitter, NS = {
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace"
}, ATTRS = {
    accentHeight: "accent-height",
    accumulate: 0,
    additive: 0,
    alignmentBaseline: "alignment-baseline",
    allowReorder: "allowReorder",
    alphabetic: 0,
    amplitude: 0,
    arabicForm: "arabic-form",
    ascent: 0,
    attributeName: "attributeName",
    attributeType: "attributeType",
    autoReverse: "autoReverse",
    azimuth: 0,
    baseFrequency: "baseFrequency",
    baseProfile: "baseProfile",
    baselineShift: "baseline-shift",
    bbox: 0,
    begin: 0,
    bias: 0,
    by: 0,
    calcMode: "calcMode",
    capHeight: "cap-height",
    clip: 0,
    clipPath: "clip-path",
    clipRule: "clip-rule",
    clipPathUnits: "clipPathUnits",
    colorInterpolation: "color-interpolation",
    colorInterpolationFilters: "color-interpolation-filters",
    colorProfile: "color-profile",
    colorRendering: "color-rendering",
    contentScriptType: "contentScriptType",
    contentStyleType: "contentStyleType",
    cursor: 0,
    cx: 0,
    cy: 0,
    d: 0,
    decelerate: 0,
    descent: 0,
    diffuseConstant: "diffuseConstant",
    direction: 0,
    display: 0,
    divisor: 0,
    dominantBaseline: "dominant-baseline",
    dur: 0,
    dx: 0,
    dy: 0,
    edgeMode: "edgeMode",
    elevation: 0,
    enableBackground: "enable-background",
    end: 0,
    exponent: 0,
    externalResourcesRequired: "externalResourcesRequired",
    fill: 0,
    fillOpacity: "fill-opacity",
    fillRule: "fill-rule",
    filter: 0,
    filterRes: "filterRes",
    filterUnits: "filterUnits",
    floodColor: "flood-color",
    floodOpacity: "flood-opacity",
    focusable: 0,
    fontFamily: "font-family",
    fontSize: "font-size",
    fontSizeAdjust: "font-size-adjust",
    fontStretch: "font-stretch",
    fontStyle: "font-style",
    fontVariant: "font-variant",
    fontWeight: "font-weight",
    format: 0,
    from: 0,
    fx: 0,
    fy: 0,
    g1: 0,
    g2: 0,
    glyphName: "glyph-name",
    glyphOrientationHorizontal: "glyph-orientation-horizontal",
    glyphOrientationVertical: "glyph-orientation-vertical",
    glyphRef: "glyphRef",
    gradientTransform: "gradientTransform",
    gradientUnits: "gradientUnits",
    hanging: 0,
    horizAdvX: "horiz-adv-x",
    horizOriginX: "horiz-origin-x",
    ideographic: 0,
    imageRendering: "image-rendering",
    in: 0,
    in2: 0,
    intercept: 0,
    k: 0,
    k1: 0,
    k2: 0,
    k3: 0,
    k4: 0,
    kernelMatrix: "kernelMatrix",
    kernelUnitLength: "kernelUnitLength",
    kerning: 0,
    keyPoints: "keyPoints",
    keySplines: "keySplines",
    keyTimes: "keyTimes",
    lengthAdjust: "lengthAdjust",
    letterSpacing: "letter-spacing",
    lightingColor: "lighting-color",
    limitingConeAngle: "limitingConeAngle",
    local: 0,
    markerEnd: "marker-end",
    markerMid: "marker-mid",
    markerStart: "marker-start",
    markerHeight: "markerHeight",
    markerUnits: "markerUnits",
    markerWidth: "markerWidth",
    mask: 0,
    maskContentUnits: "maskContentUnits",
    maskUnits: "maskUnits",
    mathematical: 0,
    mode: 0,
    numOctaves: "numOctaves",
    offset: 0,
    opacity: 0,
    operator: 0,
    order: 0,
    orient: 0,
    orientation: 0,
    origin: 0,
    overflow: 0,
    overlinePosition: "overline-position",
    overlineThickness: "overline-thickness",
    paintOrder: "paint-order",
    panose1: "panose-1",
    pathLength: "pathLength",
    patternContentUnits: "patternContentUnits",
    patternTransform: "patternTransform",
    patternUnits: "patternUnits",
    pointerEvents: "pointer-events",
    points: 0,
    pointsAtX: "pointsAtX",
    pointsAtY: "pointsAtY",
    pointsAtZ: "pointsAtZ",
    preserveAlpha: "preserveAlpha",
    preserveAspectRatio: "preserveAspectRatio",
    primitiveUnits: "primitiveUnits",
    r: 0,
    radius: 0,
    refX: "refX",
    refY: "refY",
    renderingIntent: "rendering-intent",
    repeatCount: "repeatCount",
    repeatDur: "repeatDur",
    requiredExtensions: "requiredExtensions",
    requiredFeatures: "requiredFeatures",
    restart: 0,
    result: 0,
    rotate: 0,
    rx: 0,
    ry: 0,
    scale: 0,
    seed: 0,
    shapeRendering: "shape-rendering",
    slope: 0,
    spacing: 0,
    specularConstant: "specularConstant",
    specularExponent: "specularExponent",
    speed: 0,
    spreadMethod: "spreadMethod",
    startOffset: "startOffset",
    stdDeviation: "stdDeviation",
    stemh: 0,
    stemv: 0,
    stitchTiles: "stitchTiles",
    stopColor: "stop-color",
    stopOpacity: "stop-opacity",
    strikethroughPosition: "strikethrough-position",
    strikethroughThickness: "strikethrough-thickness",
    string: 0,
    stroke: 0,
    strokeDasharray: "stroke-dasharray",
    strokeDashoffset: "stroke-dashoffset",
    strokeLinecap: "stroke-linecap",
    strokeLinejoin: "stroke-linejoin",
    strokeMiterlimit: "stroke-miterlimit",
    strokeOpacity: "stroke-opacity",
    strokeWidth: "stroke-width",
    surfaceScale: "surfaceScale",
    systemLanguage: "systemLanguage",
    tableValues: "tableValues",
    targetX: "targetX",
    targetY: "targetY",
    textAnchor: "text-anchor",
    textDecoration: "text-decoration",
    textRendering: "text-rendering",
    textLength: "textLength",
    to: 0,
    transform: 0,
    u1: 0,
    u2: 0,
    underlinePosition: "underline-position",
    underlineThickness: "underline-thickness",
    unicode: 0,
    unicodeBidi: "unicode-bidi",
    unicodeRange: "unicode-range",
    unitsPerEm: "units-per-em",
    vAlphabetic: "v-alphabetic",
    vHanging: "v-hanging",
    vIdeographic: "v-ideographic",
    vMathematical: "v-mathematical",
    values: 0,
    vectorEffect: "vector-effect",
    version: 0,
    vertAdvY: "vert-adv-y",
    vertOriginX: "vert-origin-x",
    vertOriginY: "vert-origin-y",
    viewBox: "viewBox",
    viewTarget: "viewTarget",
    visibility: 0,
    widths: 0,
    wordSpacing: "word-spacing",
    writingMode: "writing-mode",
    x: 0,
    xHeight: "x-height",
    x1: 0,
    x2: 0,
    xChannelSelector: "xChannelSelector",
    xlinkActuate: "xlink:actuate",
    xlinkArcrole: "xlink:arcrole",
    xlinkHref: "xlink:href",
    xlinkRole: "xlink:role",
    xlinkShow: "xlink:show",
    xlinkTitle: "xlink:title",
    xlinkType: "xlink:type",
    xmlBase: "xml:base",
    xmlns: 0,
    xmlnsXlink: "xmlns:xlink",
    xmlLang: "xml:lang",
    xmlSpace: "xml:space",
    y: 0,
    y1: 0,
    y2: 0,
    yChannelSelector: "yChannelSelector",
    z: 0,
    zoomAndPan: "zoomAndPan"
}, SVGDOMPropertyConfig = {
    Properties: {},
    DOMAttributeNamespaces: {
        xlinkActuate: NS.xlink,
        xlinkArcrole: NS.xlink,
        xlinkHref: NS.xlink,
        xlinkRole: NS.xlink,
        xlinkShow: NS.xlink,
        xlinkTitle: NS.xlink,
        xlinkType: NS.xlink,
        xmlBase: NS.xml,
        xmlLang: NS.xml,
        xmlSpace: NS.xml
    },
    DOMAttributeNames: {}
};

Object.keys(ATTRS).forEach(function(key) {
    SVGDOMPropertyConfig.Properties[key] = 0, ATTRS[key] && (SVGDOMPropertyConfig.DOMAttributeNames[key] = ATTRS[key]);
});

var SVGDOMPropertyConfig_1 = SVGDOMPropertyConfig, TEXT_NODE$1 = HTMLNodeType_1.TEXT_NODE;

/**
 * Given any node return the first leaf node without children.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {DOMElement|DOMTextNode}
 */
function getLeafNode(node) {
    for (;node && node.firstChild; ) node = node.firstChild;
    return node;
}

/**
 * Get the next sibling within a container. This will walk up the
 * DOM if a node's siblings have been exhausted.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {?DOMElement|DOMTextNode}
 */
function getSiblingNode(node) {
    for (;node; ) {
        if (node.nextSibling) return node.nextSibling;
        node = node.parentNode;
    }
}

/**
 * Get object describing the nodes which contain characters at offset.
 *
 * @param {DOMElement|DOMTextNode} root
 * @param {number} offset
 * @return {?object}
 */
function getNodeForCharacterOffset(root, offset) {
    for (var node = getLeafNode(root), nodeStart = 0, nodeEnd = 0; node; ) {
        if (node.nodeType === TEXT_NODE$1) {
            if (nodeEnd = nodeStart + node.textContent.length, nodeStart <= offset && nodeEnd >= offset) return {
                node: node,
                offset: offset - nodeStart
            };
            nodeStart = nodeEnd;
        }
        node = getLeafNode(getSiblingNode(node));
    }
}

var getNodeForCharacterOffset_1 = getNodeForCharacterOffset;

/**
 * While `isCollapsed` is available on the Selection object and `collapsed`
 * is available on the Range object, IE11 sometimes gets them wrong.
 * If the anchor/focus nodes and offsets are the same, the range is collapsed.
 */
function isCollapsed(anchorNode, anchorOffset, focusNode$$1, focusOffset) {
    return anchorNode === focusNode$$1 && anchorOffset === focusOffset;
}

/**
 * @param {DOMElement} node
 * @return {?object}
 */
function getModernOffsets(node) {
    var selection = window.getSelection && window.getSelection();
    if (!selection || 0 === selection.rangeCount) return null;
    var anchorNode = selection.anchorNode, anchorOffset = selection.anchorOffset, focusNode$$1 = selection.focusNode, focusOffset = selection.focusOffset, currentRange = selection.getRangeAt(0);
    // In Firefox, range.startContainer and range.endContainer can be "anonymous
    // divs", e.g. the up/down buttons on an <input type="number">. Anonymous
    // divs do not seem to expose properties, triggering a "Permission denied
    // error" if any of its properties are accessed. The only seemingly possible
    // way to avoid erroring is to access a property that typically works for
    // non-anonymous divs and catch any error that may otherwise arise. See
    // https://bugzilla.mozilla.org/show_bug.cgi?id=208427
    try {
        /* eslint-disable no-unused-expressions */
        currentRange.startContainer.nodeType, currentRange.endContainer.nodeType;
    } catch (e) {
        return null;
    }
    // If the node and offset values are the same, the selection is collapsed.
    // `Selection.isCollapsed` is available natively, but IE sometimes gets
    // this value wrong.
    var isSelectionCollapsed = isCollapsed(selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset), rangeLength = isSelectionCollapsed ? 0 : currentRange.toString().length, tempRange = currentRange.cloneRange();
    tempRange.selectNodeContents(node), tempRange.setEnd(currentRange.startContainer, currentRange.startOffset);
    var isTempRangeCollapsed = isCollapsed(tempRange.startContainer, tempRange.startOffset, tempRange.endContainer, tempRange.endOffset), start = isTempRangeCollapsed ? 0 : tempRange.toString().length, end = start + rangeLength, detectionRange = document.createRange();
    detectionRange.setStart(anchorNode, anchorOffset), detectionRange.setEnd(focusNode$$1, focusOffset);
    var isBackward = detectionRange.collapsed;
    return {
        start: isBackward ? end : start,
        end: isBackward ? start : end
    };
}

/**
 * In modern non-IE browsers, we can support both forward and backward
 * selections.
 *
 * Note: IE10+ supports the Selection object, but it does not support
 * the `extend` method, which means that even in modern IE, it's not possible
 * to programmatically create a backward selection. Thus, for all IE
 * versions, we use the old IE API to create our selections.
 *
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
function setModernOffsets(node, offsets) {
    if (window.getSelection) {
        var selection = window.getSelection(), length = node[getTextContentAccessor_1()].length, start = Math.min(offsets.start, length), end = void 0 === offsets.end ? start : Math.min(offsets.end, length);
        // IE 11 uses modern selection, but doesn't support the extend method.
        // Flip backward selections, so we can set with a single range.
        if (!selection.extend && start > end) {
            var temp = end;
            end = start, start = temp;
        }
        var startMarker = getNodeForCharacterOffset_1(node, start), endMarker = getNodeForCharacterOffset_1(node, end);
        if (startMarker && endMarker) {
            var range = document.createRange();
            range.setStart(startMarker.node, startMarker.offset), selection.removeAllRanges(), 
            start > end ? (selection.addRange(range), selection.extend(endMarker.node, endMarker.offset)) : (range.setEnd(endMarker.node, endMarker.offset), 
            selection.addRange(range));
        }
    }
}

var ReactDOMSelection = {
    /**
   * @param {DOMElement} node
   */
    getOffsets: getModernOffsets,
    /**
   * @param {DOMElement|DOMTextNode} node
   * @param {object} offsets
   */
    setOffsets: setModernOffsets
}, ReactDOMSelection_1 = ReactDOMSelection, ELEMENT_NODE$1 = HTMLNodeType_1.ELEMENT_NODE;

function isInDocument(node) {
    return containsNode(document.documentElement, node);
}

/**
 * @ReactInputSelection: React input selection module. Based on Selection.js,
 * but modified to be suitable for react and has a couple of bug fixes (doesn't
 * assume buttons have range selections allowed).
 * Input selection module for React.
 */
var ReactInputSelection = {
    hasSelectionCapabilities: function(elem) {
        var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
        return nodeName && ("input" === nodeName && "text" === elem.type || "textarea" === nodeName || "true" === elem.contentEditable);
    },
    getSelectionInformation: function() {
        var focusedElem = getActiveElement();
        return {
            focusedElem: focusedElem,
            selectionRange: ReactInputSelection.hasSelectionCapabilities(focusedElem) ? ReactInputSelection.getSelection(focusedElem) : null
        };
    },
    /**
   * @restoreSelection: If any selection information was potentially lost,
   * restore it. This is useful when performing operations that could remove dom
   * nodes and place them back in, resulting in focus being lost.
   */
    restoreSelection: function(priorSelectionInformation) {
        var curFocusedElem = getActiveElement(), priorFocusedElem = priorSelectionInformation.focusedElem, priorSelectionRange = priorSelectionInformation.selectionRange;
        if (curFocusedElem !== priorFocusedElem && isInDocument(priorFocusedElem)) {
            ReactInputSelection.hasSelectionCapabilities(priorFocusedElem) && ReactInputSelection.setSelection(priorFocusedElem, priorSelectionRange);
            for (// Focusing a node can change the scroll position, which is undesirable
            var ancestors = [], ancestor = priorFocusedElem; ancestor = ancestor.parentNode; ) ancestor.nodeType === ELEMENT_NODE$1 && ancestors.push({
                element: ancestor,
                left: ancestor.scrollLeft,
                top: ancestor.scrollTop
            });
            focusNode(priorFocusedElem);
            for (var i = 0; i < ancestors.length; i++) {
                var info = ancestors[i];
                info.element.scrollLeft = info.left, info.element.scrollTop = info.top;
            }
        }
    },
    /**
   * @getSelection: Gets the selection bounds of a focused textarea, input or
   * contentEditable node.
   * -@input: Look up selection bounds of this input
   * -@return {start: selectionStart, end: selectionEnd}
   */
    getSelection: function(input) {
        return ("selectionStart" in input ? {
            start: input.selectionStart,
            end: input.selectionEnd
        } : ReactDOMSelection_1.getOffsets(input)) || {
            start: 0,
            end: 0
        };
    },
    /**
   * @setSelection: Sets the selection bounds of a textarea or input and focuses
   * the input.
   * -@input     Set selection bounds of this input or textarea
   * -@offsets   Object of same form that is returned from get*
   */
    setSelection: function(input, offsets) {
        var start = offsets.start, end = offsets.end;
        void 0 === end && (end = start), "selectionStart" in input ? (input.selectionStart = start, 
        input.selectionEnd = Math.min(end, input.value.length)) : ReactDOMSelection_1.setOffsets(input, offsets);
    }
}, ReactInputSelection_1 = ReactInputSelection, DOCUMENT_NODE = HTMLNodeType_1.DOCUMENT_NODE, skipSelectionChangeEvent = ExecutionEnvironment.canUseDOM && "documentMode" in document && document.documentMode <= 11, eventTypes$3 = {
    select: {
        phasedRegistrationNames: {
            bubbled: "onSelect",
            captured: "onSelectCapture"
        },
        dependencies: [ "topBlur", "topContextMenu", "topFocus", "topKeyDown", "topKeyUp", "topMouseDown", "topMouseUp", "topSelectionChange" ]
    }
}, activeElement$1 = null, activeElementInst$1 = null, lastSelection = null, mouseDown = !1, isListeningToAllDependencies = ReactBrowserEventEmitter_1.isListeningToAllDependencies;

/**
 * Get an object which is a unique representation of the current selection.
 *
 * The return value will not be consistent across nodes or browsers, but
 * two identical selections on the same node will return identical objects.
 *
 * @param {DOMElement} node
 * @return {object}
 */
function getSelection(node) {
    if ("selectionStart" in node && ReactInputSelection_1.hasSelectionCapabilities(node)) return {
        start: node.selectionStart,
        end: node.selectionEnd
    };
    if (window.getSelection) {
        var selection = window.getSelection();
        return {
            anchorNode: selection.anchorNode,
            anchorOffset: selection.anchorOffset,
            focusNode: selection.focusNode,
            focusOffset: selection.focusOffset
        };
    }
}

/**
 * Poll selection to see whether it's changed.
 *
 * @param {object} nativeEvent
 * @return {?SyntheticEvent}
 */
function constructSelectEvent(nativeEvent, nativeEventTarget) {
    // Ensure we have the right element, and that the user is not dragging a
    // selection (this matches native `select` event behavior). In HTML5, select
    // fires only on input and textarea thus if there's no focused element we
    // won't dispatch.
    if (mouseDown || null == activeElement$1 || activeElement$1 !== getActiveElement()) return null;
    // Only fire when selection has actually changed.
    var currentSelection = getSelection(activeElement$1);
    if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
        lastSelection = currentSelection;
        var syntheticEvent = SyntheticEvent_1.getPooled(eventTypes$3.select, activeElementInst$1, nativeEvent, nativeEventTarget);
        return syntheticEvent.type = "select", syntheticEvent.target = activeElement$1, 
        EventPropagators_1.accumulateTwoPhaseDispatches(syntheticEvent), syntheticEvent;
    }
    return null;
}

/**
 * This plugin creates an `onSelect` event that normalizes select events
 * across form elements.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - contentEditable
 *
 * This differs from native browser implementations in the following ways:
 * - Fires on contentEditable fields as well as inputs.
 * - Fires for collapsed selection.
 * - Fires after user input.
 */
var SelectEventPlugin = {
    eventTypes: eventTypes$3,
    extractEvents: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
        var doc = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : nativeEventTarget.nodeType === DOCUMENT_NODE ? nativeEventTarget : nativeEventTarget.ownerDocument;
        if (!doc || !isListeningToAllDependencies("onSelect", doc)) return null;
        var targetNode = targetInst ? ReactDOMComponentTree_1.getNodeFromInstance(targetInst) : window;
        switch (topLevelType) {
          // Track the input node that has focus.
            case "topFocus":
            (isTextInputElement_1(targetNode) || "true" === targetNode.contentEditable) && (activeElement$1 = targetNode, 
            activeElementInst$1 = targetInst, lastSelection = null);
            break;

          case "topBlur":
            activeElement$1 = null, activeElementInst$1 = null, lastSelection = null;
            break;

          // Don't fire the event while the user is dragging. This matches the
            // semantics of the native select event.
            case "topMouseDown":
            mouseDown = !0;
            break;

          case "topContextMenu":
          case "topMouseUp":
            return mouseDown = !1, constructSelectEvent(nativeEvent, nativeEventTarget);

          // Chrome and IE fire non-standard event when selection is changed (and
            // sometimes when it hasn't). IE's event fires out of order with respect
            // to key and input events on deletion, so we discard it.
            //
            // Firefox doesn't support selectionchange, so check selection status
            // after each key entry. The selection changes after keydown and before
            // keyup, but we check on keydown as well in the case of holding down a
            // key, when multiple keydown events are fired but only one keyup is.
            // This is also our approach for IE handling, for the reason above.
            case "topSelectionChange":
            if (skipSelectionChangeEvent) break;

          // falls through
            case "topKeyDown":
          case "topKeyUp":
            return constructSelectEvent(nativeEvent, nativeEventTarget);
        }
        return null;
    }
}, SelectEventPlugin_1 = SelectEventPlugin, AnimationEventInterface = {
    animationName: null,
    elapsedTime: null,
    pseudoElement: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticEvent}
 */
function SyntheticAnimationEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent_1.augmentClass(SyntheticAnimationEvent, AnimationEventInterface);

var SyntheticAnimationEvent_1 = SyntheticAnimationEvent, ClipboardEventInterface = {
    clipboardData: function(event) {
        return "clipboardData" in event ? event.clipboardData : window.clipboardData;
    }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticClipboardEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent_1.augmentClass(SyntheticClipboardEvent, ClipboardEventInterface);

var SyntheticClipboardEvent_1 = SyntheticClipboardEvent, FocusEventInterface = {
    relatedTarget: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticFocusEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticUIEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent_1.augmentClass(SyntheticFocusEvent, FocusEventInterface);

var SyntheticFocusEvent_1 = SyntheticFocusEvent;

/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventCharCode
 */
/**
 * `charCode` represents the actual "character code" and is safe to use with
 * `String.fromCharCode`. As such, only keys that correspond to printable
 * characters produce a valid `charCode`, the only exception to this is Enter.
 * The Tab-key is considered non-printable and does not have a `charCode`,
 * presumably because it does not produce a tab-character in browsers.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {number} Normalized `charCode` property.
 */
function getEventCharCode(nativeEvent) {
    var charCode, keyCode = nativeEvent.keyCode;
    // Some non-printable keys are reported in `charCode`/`keyCode`, discard them.
    // Must not discard the (non-)printable Enter-key.
    // FF does not set `charCode` for the Enter-key, check against `keyCode`.
    // IE8 does not implement `charCode`, but `keyCode` has the correct value.
    // Some non-printable keys are reported in `charCode`/`keyCode`, discard them.
    // Must not discard the (non-)printable Enter-key.
    return "charCode" in nativeEvent ? 0 === (charCode = nativeEvent.charCode) && 13 === keyCode && (charCode = 13) : charCode = keyCode, 
    charCode >= 32 || 13 === charCode ? charCode : 0;
}

var getEventCharCode_1 = getEventCharCode, normalizeKey = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
}, translateToKey = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
};

/**
 * @param {object} nativeEvent Native browser event.
 * @return {string} Normalized `key` property.
 */
function getEventKey(nativeEvent) {
    if (nativeEvent.key) {
        // Normalize inconsistent values reported by browsers due to
        // implementations of a working draft specification.
        // FireFox implements `key` but returns `MozPrintableKey` for all
        // printable characters (normalized to `Unidentified`), ignore it.
        var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
        if ("Unidentified" !== key) return key;
    }
    // Browser does not implement `key`, polyfill as much of it as we can.
    if ("keypress" === nativeEvent.type) {
        var charCode = getEventCharCode_1(nativeEvent);
        // The enter-key is technically both printable and non-printable and can
        // thus be captured by `keypress`, no other non-printable key should.
        return 13 === charCode ? "Enter" : String.fromCharCode(charCode);
    }
    return "keydown" === nativeEvent.type || "keyup" === nativeEvent.type ? translateToKey[nativeEvent.keyCode] || "Unidentified" : "";
}

var getEventKey_1 = getEventKey, KeyboardEventInterface = {
    key: getEventKey_1,
    location: null,
    ctrlKey: null,
    shiftKey: null,
    altKey: null,
    metaKey: null,
    repeat: null,
    locale: null,
    getModifierState: getEventModifierState_1,
    // Legacy Interface
    charCode: function(event) {
        // `charCode` is the result of a KeyPress event and represents the value of
        // the actual printable character.
        // KeyPress is deprecated, but its replacement is not yet final and not
        // implemented in any major browser. Only KeyPress has charCode.
        // `charCode` is the result of a KeyPress event and represents the value of
        // the actual printable character.
        // KeyPress is deprecated, but its replacement is not yet final and not
        // implemented in any major browser. Only KeyPress has charCode.
        return "keypress" === event.type ? getEventCharCode_1(event) : 0;
    },
    keyCode: function(event) {
        // `keyCode` is the result of a KeyDown/Up event and represents the value of
        // physical keyboard key.
        // The actual meaning of the value depends on the users' keyboard layout
        // which cannot be detected. Assuming that it is a US keyboard layout
        // provides a surprisingly accurate mapping for US and European users.
        // Due to this, it is left to the user to implement at this time.
        // `keyCode` is the result of a KeyDown/Up event and represents the value of
        // physical keyboard key.
        // The actual meaning of the value depends on the users' keyboard layout
        // which cannot be detected. Assuming that it is a US keyboard layout
        // provides a surprisingly accurate mapping for US and European users.
        // Due to this, it is left to the user to implement at this time.
        return "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
    },
    which: function(event) {
        // `which` is an alias for either `keyCode` or `charCode` depending on the
        // type of the event.
        // `which` is an alias for either `keyCode` or `charCode` depending on the
        // type of the event.
        return "keypress" === event.type ? getEventCharCode_1(event) : "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
    }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticKeyboardEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticUIEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent_1.augmentClass(SyntheticKeyboardEvent, KeyboardEventInterface);

var SyntheticKeyboardEvent_1 = SyntheticKeyboardEvent, DragEventInterface = {
    dataTransfer: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticDragEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticMouseEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticMouseEvent_1.augmentClass(SyntheticDragEvent, DragEventInterface);

var SyntheticDragEvent_1 = SyntheticDragEvent, TouchEventInterface = {
    touches: null,
    targetTouches: null,
    changedTouches: null,
    altKey: null,
    metaKey: null,
    ctrlKey: null,
    shiftKey: null,
    getModifierState: getEventModifierState_1
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticTouchEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticUIEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticUIEvent_1.augmentClass(SyntheticTouchEvent, TouchEventInterface);

var SyntheticTouchEvent_1 = SyntheticTouchEvent, TransitionEventInterface = {
    propertyName: null,
    elapsedTime: null,
    pseudoElement: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticEvent}
 */
function SyntheticTransitionEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticEvent_1.augmentClass(SyntheticTransitionEvent, TransitionEventInterface);

var SyntheticTransitionEvent_1 = SyntheticTransitionEvent, WheelEventInterface = {
    deltaX: function(event) {
        // Fallback to `wheelDeltaX` for Webkit and normalize (right is positive).
        return "deltaX" in event ? event.deltaX : "wheelDeltaX" in event ? -event.wheelDeltaX : 0;
    },
    deltaY: function(event) {
        // Fallback to `wheelDeltaY` for Webkit and normalize (down is positive).
        // Fallback to `wheelDelta` for IE<9 and normalize (down is positive).
        return "deltaY" in event ? event.deltaY : "wheelDeltaY" in event ? -event.wheelDeltaY : "wheelDelta" in event ? -event.wheelDelta : 0;
    },
    deltaZ: null,
    // Browsers without "deltaMode" is reporting in raw wheel delta where one
    // notch on the scroll is always +/- 120, roughly equivalent to pixels.
    // A good approximation of DOM_DELTA_LINE (1) is 5% of viewport size or
    // ~40 pixels, for DOM_DELTA_SCREEN (2) it is 87.5% of viewport size.
    deltaMode: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticMouseEvent}
 */
function SyntheticWheelEvent(dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget) {
    return SyntheticMouseEvent_1.call(this, dispatchConfig, dispatchMarker, nativeEvent, nativeEventTarget);
}

SyntheticMouseEvent_1.augmentClass(SyntheticWheelEvent, WheelEventInterface);

var SyntheticWheelEvent_1 = SyntheticWheelEvent, eventTypes$4 = {}, topLevelEventsToDispatchConfig = {};

[ "abort", "animationEnd", "animationIteration", "animationStart", "blur", "cancel", "canPlay", "canPlayThrough", "click", "close", "contextMenu", "copy", "cut", "doubleClick", "drag", "dragEnd", "dragEnter", "dragExit", "dragLeave", "dragOver", "dragStart", "drop", "durationChange", "emptied", "encrypted", "ended", "error", "focus", "input", "invalid", "keyDown", "keyPress", "keyUp", "load", "loadedData", "loadedMetadata", "loadStart", "mouseDown", "mouseMove", "mouseOut", "mouseOver", "mouseUp", "paste", "pause", "play", "playing", "progress", "rateChange", "reset", "scroll", "seeked", "seeking", "stalled", "submit", "suspend", "timeUpdate", "toggle", "touchCancel", "touchEnd", "touchMove", "touchStart", "transitionEnd", "volumeChange", "waiting", "wheel" ].forEach(function(event) {
    var capitalizedEvent = event[0].toUpperCase() + event.slice(1), onEvent = "on" + capitalizedEvent, topEvent = "top" + capitalizedEvent, type = {
        phasedRegistrationNames: {
            bubbled: onEvent,
            captured: onEvent + "Capture"
        },
        dependencies: [ topEvent ]
    };
    eventTypes$4[event] = type, topLevelEventsToDispatchConfig[topEvent] = type;
});

var SimpleEventPlugin = {
    eventTypes: eventTypes$4,
    extractEvents: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {
        var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType];
        if (!dispatchConfig) return null;
        var EventConstructor;
        switch (topLevelType) {
          case "topAbort":
          case "topCancel":
          case "topCanPlay":
          case "topCanPlayThrough":
          case "topClose":
          case "topDurationChange":
          case "topEmptied":
          case "topEncrypted":
          case "topEnded":
          case "topError":
          case "topInput":
          case "topInvalid":
          case "topLoad":
          case "topLoadedData":
          case "topLoadedMetadata":
          case "topLoadStart":
          case "topPause":
          case "topPlay":
          case "topPlaying":
          case "topProgress":
          case "topRateChange":
          case "topReset":
          case "topSeeked":
          case "topSeeking":
          case "topStalled":
          case "topSubmit":
          case "topSuspend":
          case "topTimeUpdate":
          case "topToggle":
          case "topVolumeChange":
          case "topWaiting":
            // HTML Events
            // @see http://www.w3.org/TR/html5/index.html#events-0
            EventConstructor = SyntheticEvent_1;
            break;

          case "topKeyPress":
            // Firefox creates a keypress event for function keys too. This removes
            // the unwanted keypress events. Enter is however both printable and
            // non-printable. One would expect Tab to be as well (but it isn't).
            if (0 === getEventCharCode_1(nativeEvent)) return null;

          /* falls through */
            case "topKeyDown":
          case "topKeyUp":
            EventConstructor = SyntheticKeyboardEvent_1;
            break;

          case "topBlur":
          case "topFocus":
            EventConstructor = SyntheticFocusEvent_1;
            break;

          case "topClick":
            // Firefox creates a click event on right mouse clicks. This removes the
            // unwanted click events.
            if (2 === nativeEvent.button) return null;

          /* falls through */
            case "topDoubleClick":
          case "topMouseDown":
          case "topMouseMove":
          case "topMouseUp":
          // TODO: Disabled elements should not respond to mouse events
            /* falls through */
            case "topMouseOut":
          case "topMouseOver":
          case "topContextMenu":
            EventConstructor = SyntheticMouseEvent_1;
            break;

          case "topDrag":
          case "topDragEnd":
          case "topDragEnter":
          case "topDragExit":
          case "topDragLeave":
          case "topDragOver":
          case "topDragStart":
          case "topDrop":
            EventConstructor = SyntheticDragEvent_1;
            break;

          case "topTouchCancel":
          case "topTouchEnd":
          case "topTouchMove":
          case "topTouchStart":
            EventConstructor = SyntheticTouchEvent_1;
            break;

          case "topAnimationEnd":
          case "topAnimationIteration":
          case "topAnimationStart":
            EventConstructor = SyntheticAnimationEvent_1;
            break;

          case "topTransitionEnd":
            EventConstructor = SyntheticTransitionEvent_1;
            break;

          case "topScroll":
            EventConstructor = SyntheticUIEvent_1;
            break;

          case "topWheel":
            EventConstructor = SyntheticWheelEvent_1;
            break;

          case "topCopy":
          case "topCut":
          case "topPaste":
            EventConstructor = SyntheticClipboardEvent_1;
        }
        invariant(EventConstructor, "SimpleEventPlugin: Unhandled event type, `%s`.", topLevelType);
        var event = EventConstructor.getPooled(dispatchConfig, targetInst, nativeEvent, nativeEventTarget);
        return EventPropagators_1.accumulateTwoPhaseDispatches(event), event;
    }
}, SimpleEventPlugin_1 = SimpleEventPlugin, alreadyInjected = !1;

function inject() {
    alreadyInjected || (alreadyInjected = !0, ReactDOMEventListener_1.setHandleTopLevel(ReactBrowserEventEmitter_1.handleTopLevel), 
    /**
   * Inject modules for resolving DOM hierarchy and plugin ordering.
   */
    EventPluginHub_1.injection.injectEventPluginOrder(DOMEventPluginOrder_1), EventPluginUtils_1.injection.injectComponentTree(ReactDOMComponentTree_1), 
    /**
   * Some important event plugins included by default (without having to require
   * them).
   */
    EventPluginHub_1.injection.injectEventPluginsByName({
        SimpleEventPlugin: SimpleEventPlugin_1,
        EnterLeaveEventPlugin: EnterLeaveEventPlugin_1,
        ChangeEventPlugin: ChangeEventPlugin_1,
        SelectEventPlugin: SelectEventPlugin_1,
        BeforeInputEventPlugin: BeforeInputEventPlugin_1
    }), DOMProperty_1.injection.injectDOMPropertyConfig(ARIADOMPropertyConfig_1), DOMProperty_1.injection.injectDOMPropertyConfig(HTMLDOMPropertyConfig_1), 
    DOMProperty_1.injection.injectDOMPropertyConfig(SVGDOMPropertyConfig_1));
}

var ReactDOMInjection = {
    inject: inject
}, isUnitlessNumber = {
    animationIterationCount: !0,
    borderImageOutset: !0,
    borderImageSlice: !0,
    borderImageWidth: !0,
    boxFlex: !0,
    boxFlexGroup: !0,
    boxOrdinalGroup: !0,
    columnCount: !0,
    flex: !0,
    flexGrow: !0,
    flexPositive: !0,
    flexShrink: !0,
    flexNegative: !0,
    flexOrder: !0,
    gridRow: !0,
    gridRowEnd: !0,
    gridRowSpan: !0,
    gridRowStart: !0,
    gridColumn: !0,
    gridColumnEnd: !0,
    gridColumnSpan: !0,
    gridColumnStart: !0,
    fontWeight: !0,
    lineClamp: !0,
    lineHeight: !0,
    opacity: !0,
    order: !0,
    orphans: !0,
    tabSize: !0,
    widows: !0,
    zIndex: !0,
    zoom: !0,
    // SVG-related properties
    fillOpacity: !0,
    floodOpacity: !0,
    stopOpacity: !0,
    strokeDasharray: !0,
    strokeDashoffset: !0,
    strokeMiterlimit: !0,
    strokeOpacity: !0,
    strokeWidth: !0
};

/**
 * @param {string} prefix vendor-specific prefix, eg: Webkit
 * @param {string} key style name, eg: transitionDuration
 * @return {string} style name prefixed with `prefix`, properly camelCased, eg:
 * WebkitTransitionDuration
 */
function prefixKey(prefix, key) {
    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}

/**
 * Support style names that may come passed in prefixed by adding permutations
 * of vendor prefixes.
 */
var prefixes = [ "Webkit", "ms", "Moz", "O" ];

// Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an
// infinite loop, because it iterates over the newly added props too.
Object.keys(isUnitlessNumber).forEach(function(prop) {
    prefixes.forEach(function(prefix) {
        isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
    });
});

/**
 * Most style properties can be unset by doing .style[prop] = '' but IE8
 * doesn't like doing that with shorthand properties so for the properties that
 * IE8 breaks on, which are listed here, we instead unset each of the
 * individual properties. See http://bugs.jquery.com/ticket/12385.
 * The 4-value 'clock' properties like margin, padding, border-width seem to
 * behave without any problems. Curiously, list-style works too without any
 * special prodding.
 */
var shorthandPropertyExpansions = {
    background: {
        backgroundAttachment: !0,
        backgroundColor: !0,
        backgroundImage: !0,
        backgroundPositionX: !0,
        backgroundPositionY: !0,
        backgroundRepeat: !0
    },
    backgroundPosition: {
        backgroundPositionX: !0,
        backgroundPositionY: !0
    },
    border: {
        borderWidth: !0,
        borderStyle: !0,
        borderColor: !0
    },
    borderBottom: {
        borderBottomWidth: !0,
        borderBottomStyle: !0,
        borderBottomColor: !0
    },
    borderLeft: {
        borderLeftWidth: !0,
        borderLeftStyle: !0,
        borderLeftColor: !0
    },
    borderRight: {
        borderRightWidth: !0,
        borderRightStyle: !0,
        borderRightColor: !0
    },
    borderTop: {
        borderTopWidth: !0,
        borderTopStyle: !0,
        borderTopColor: !0
    },
    font: {
        fontStyle: !0,
        fontVariant: !0,
        fontWeight: !0,
        fontSize: !0,
        lineHeight: !0,
        fontFamily: !0
    },
    outline: {
        outlineWidth: !0,
        outlineStyle: !0,
        outlineColor: !0
    }
}, CSSProperty = {
    isUnitlessNumber: isUnitlessNumber,
    shorthandPropertyExpansions: shorthandPropertyExpansions
}, CSSProperty_1 = CSSProperty, isUnitlessNumber$1 = CSSProperty_1.isUnitlessNumber;

/**
 * Convert a value into the proper css writable value. The style name `name`
 * should be logical (no hyphens), as specified
 * in `CSSProperty.isUnitlessNumber`.
 *
 * @param {string} name CSS property name such as `topMargin`.
 * @param {*} value CSS property value such as `10px`.
 * @return {string} Normalized style value with dimensions applied.
 */
function dangerousStyleValue(name, value, isCustomProperty) {
    return null == value || "boolean" == typeof value || "" === value ? "" : isCustomProperty || "number" != typeof value || 0 === value || isUnitlessNumber$1.hasOwnProperty(name) && isUnitlessNumber$1[name] ? ("" + value).trim() : value + "px";
}

var dangerousStyleValue_1 = dangerousStyleValue, processStyleName = memoizeStringOnly(function(styleName) {
    return hyphenateStyleName(styleName);
}), hasShorthandPropertyBug = !1;

if (ExecutionEnvironment.canUseDOM) {
    var tempStyle = document.createElement("div").style;
    try {
        // IE8 throws "Invalid argument." if resetting shorthand style properties.
        tempStyle.font = "";
    } catch (e) {
        hasShorthandPropertyBug = !0;
    }
}

/**
 * Operations for dealing with CSS properties.
 */
var CSSPropertyOperations = {
    /**
   * Serializes a mapping of style properties for use as inline styles:
   *
   *   > createMarkupForStyles({width: '200px', height: 0})
   *   "width:200px;height:0;"
   *
   * Undefined values are ignored so that declarative programming is easier.
   * The result should be HTML-escaped before insertion into the DOM.
   *
   * @param {object} styles
   * @param {ReactDOMComponent} component
   * @return {?string}
   */
    createMarkupForStyles: function(styles, component) {
        var serialized = "", delimiter = "";
        for (var styleName in styles) if (styles.hasOwnProperty(styleName)) {
            var isCustomProperty = 0 === styleName.indexOf("--"), styleValue = styles[styleName];
            null != styleValue && (serialized += delimiter + processStyleName(styleName) + ":", 
            serialized += dangerousStyleValue_1(styleName, styleValue, isCustomProperty), delimiter = ";");
        }
        return serialized || null;
    },
    /**
   * This creates a string that is expected to be equivalent to the style
   * attribute generated by server-side rendering. It by-passes warnings and
   * security checks so it's not safe to use this value for anything other than
   * comparison. It is only used in DEV for SSR validation. This is duplicated
   * from createMarkupForStyles because createMarkupForStyles is expected to
   * move out of the client-side renderer and it would be nice to make a clean
   * break.
   */
    createDangerousStringForStyles: function(styles) {},
    /**
   * Sets the value for multiple styles on a node.  If a value is specified as
   * '' (empty string), the corresponding style property will be unset.
   *
   * @param {DOMElement} node
   * @param {object} styles
   * @param {ReactDOMComponent} component
   */
    setValueForStyles: function(node, styles, component) {
        var style = node.style;
        for (var styleName in styles) if (styles.hasOwnProperty(styleName)) {
            var isCustomProperty = 0 === styleName.indexOf("--"), styleValue = dangerousStyleValue_1(styleName, styles[styleName], isCustomProperty);
            if ("float" === styleName && (styleName = "cssFloat"), isCustomProperty) style.setProperty(styleName, styleValue); else if (styleValue) style[styleName] = styleValue; else {
                var expansion = hasShorthandPropertyBug && CSSProperty_1.shorthandPropertyExpansions[styleName];
                if (expansion) // Shorthand property that IE8 won't like unsetting, so unset each
                // component to placate it
                for (var individualStyleName in expansion) style[individualStyleName] = ""; else style[styleName] = "";
            }
        }
    }
}, CSSPropertyOperations_1 = CSSPropertyOperations, matchHtmlRegExp = /["'&<>]/;

/**
 * Escape special characters in the given string of html.
 *
 * @param  {string} string The string to escape for inserting into HTML
 * @return {string}
 * @public
 */
function escapeHtml(string) {
    var str = "" + string, match = matchHtmlRegExp.exec(str);
    if (!match) return str;
    var escape, html = "", index = 0, lastIndex = 0;
    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
          case 34:
            // "
            escape = "&quot;";
            break;

          case 38:
            // &
            escape = "&amp;";
            break;

          case 39:
            // '
            escape = "&#x27;";
            // modified from escape-html; used to be '&#39'
            break;

          case 60:
            // <
            escape = "&lt;";
            break;

          case 62:
            // >
            escape = "&gt;";
            break;

          default:
            continue;
        }
        lastIndex !== index && (html += str.substring(lastIndex, index)), lastIndex = index + 1, 
        html += escape;
    }
    return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}

// end code copied and modified from escape-html
/**
 * Escapes text to prevent scripting attacks.
 *
 * @param {*} text Text value to escape.
 * @return {string} An escaped string.
 */
function escapeTextContentForBrowser(text) {
    return "boolean" == typeof text || "number" == typeof text ? "" + text : escapeHtml(text);
}

var escapeTextContentForBrowser_1 = escapeTextContentForBrowser;

/**
 * Escapes attribute value to prevent scripting attacks.
 *
 * @param {*} value Value to escape.
 * @return {string} An escaped string.
 */
function quoteAttributeValueForBrowser(value) {
    return '"' + escapeTextContentForBrowser_1(value) + '"';
}

var quoteAttributeValueForBrowser_1 = quoteAttributeValueForBrowser, VALID_ATTRIBUTE_NAME_REGEX = new RegExp("^[" + DOMProperty_1.ATTRIBUTE_NAME_START_CHAR + "][" + DOMProperty_1.ATTRIBUTE_NAME_CHAR + "]*$"), illegalAttributeNameCache = {}, validatedAttributeNameCache = {};

function isAttributeNameSafe(attributeName) {
    return !!validatedAttributeNameCache.hasOwnProperty(attributeName) || !illegalAttributeNameCache.hasOwnProperty(attributeName) && (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName) ? (validatedAttributeNameCache[attributeName] = !0, 
    !0) : (illegalAttributeNameCache[attributeName] = !0, warning(!1, "Invalid attribute name: `%s`", attributeName), 
    !1));
}

function shouldIgnoreValue(propertyInfo, value) {
    return null == value || propertyInfo.hasBooleanValue && !value || propertyInfo.hasNumericValue && isNaN(value) || propertyInfo.hasPositiveNumericValue && value < 1 || propertyInfo.hasOverloadedBooleanValue && !1 === value;
}

/**
 * Operations for dealing with DOM properties.
 */
var DOMPropertyOperations = {
    /**
   * Creates markup for the ID property.
   *
   * @param {string} id Unescaped ID.
   * @return {string} Markup string.
   */
    createMarkupForID: function(id) {
        return DOMProperty_1.ID_ATTRIBUTE_NAME + "=" + quoteAttributeValueForBrowser_1(id);
    },
    setAttributeForID: function(node, id) {
        node.setAttribute(DOMProperty_1.ID_ATTRIBUTE_NAME, id);
    },
    createMarkupForRoot: function() {
        return DOMProperty_1.ROOT_ATTRIBUTE_NAME + '=""';
    },
    setAttributeForRoot: function(node) {
        node.setAttribute(DOMProperty_1.ROOT_ATTRIBUTE_NAME, "");
    },
    /**
   * Creates markup for a property.
   *
   * @param {string} name
   * @param {*} value
   * @return {?string} Markup string, or null if the property was invalid.
   */
    createMarkupForProperty: function(name, value) {
        var propertyInfo = DOMProperty_1.properties.hasOwnProperty(name) ? DOMProperty_1.properties[name] : null;
        if (propertyInfo) {
            if (shouldIgnoreValue(propertyInfo, value)) return "";
            var attributeName = propertyInfo.attributeName;
            return propertyInfo.hasBooleanValue || propertyInfo.hasOverloadedBooleanValue && !0 === value ? attributeName + '=""' : attributeName + "=" + quoteAttributeValueForBrowser_1(value);
        }
        return DOMProperty_1.isCustomAttribute(name) ? null == value ? "" : name + "=" + quoteAttributeValueForBrowser_1(value) : null;
    },
    /**
   * Creates markup for a custom property.
   *
   * @param {string} name
   * @param {*} value
   * @return {string} Markup string, or empty string if the property was invalid.
   */
    createMarkupForCustomAttribute: function(name, value) {
        return isAttributeNameSafe(name) && null != value ? name + "=" + quoteAttributeValueForBrowser_1(value) : "";
    },
    /**
   * Get the value for a property on a node. Only used in DEV for SSR validation.
   * The "expected" argument is used as a hint of what the expected value is.
   * Some properties have multiple equivalent values.
   */
    getValueForProperty: function(node, name, expected) {},
    /**
   * Get the value for a attribute on a node. Only used in DEV for SSR validation.
   * The third argument is used as a hint of what the expected value is. Some
   * attributes have multiple equivalent values.
   */
    getValueForAttribute: function(node, name, expected) {},
    /**
   * Sets the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   * @param {*} value
   */
    setValueForProperty: function(node, name, value) {
        var propertyInfo = DOMProperty_1.properties.hasOwnProperty(name) ? DOMProperty_1.properties[name] : null;
        if (propertyInfo) {
            var mutationMethod = propertyInfo.mutationMethod;
            if (mutationMethod) mutationMethod(node, value); else {
                if (shouldIgnoreValue(propertyInfo, value)) return void DOMPropertyOperations.deleteValueForProperty(node, name);
                if (propertyInfo.mustUseProperty) // Contrary to `setAttribute`, object properties are properly
                // `toString`ed by IE8/9.
                node[propertyInfo.propertyName] = value; else {
                    var attributeName = propertyInfo.attributeName, namespace = propertyInfo.attributeNamespace;
                    // `setAttribute` with objects becomes only `[object]` in IE8/9,
                    // ('' + value) makes it output the correct toString()-value.
                    namespace ? node.setAttributeNS(namespace, attributeName, "" + value) : propertyInfo.hasBooleanValue || propertyInfo.hasOverloadedBooleanValue && !0 === value ? node.setAttribute(attributeName, "") : node.setAttribute(attributeName, "" + value);
                }
            }
        } else if (DOMProperty_1.isCustomAttribute(name)) return void DOMPropertyOperations.setValueForAttribute(node, name, value);
    },
    setValueForAttribute: function(node, name, value) {
        isAttributeNameSafe(name) && (null == value ? node.removeAttribute(name) : node.setAttribute(name, "" + value));
    },
    /**
   * Deletes an attributes from a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   */
    deleteValueForAttribute: function(node, name) {
        node.removeAttribute(name);
    },
    /**
   * Deletes the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   */
    deleteValueForProperty: function(node, name) {
        var propertyInfo = DOMProperty_1.properties.hasOwnProperty(name) ? DOMProperty_1.properties[name] : null;
        if (propertyInfo) {
            var mutationMethod = propertyInfo.mutationMethod;
            if (mutationMethod) mutationMethod(node, void 0); else if (propertyInfo.mustUseProperty) {
                var propName = propertyInfo.propertyName;
                propertyInfo.hasBooleanValue ? node[propName] = !1 : node[propName] = "";
            } else node.removeAttribute(propertyInfo.attributeName);
        } else DOMProperty_1.isCustomAttribute(name) && node.removeAttribute(name);
    }
}, DOMPropertyOperations_1 = DOMPropertyOperations, omittedCloseTags = {
    area: !0,
    base: !0,
    br: !0,
    col: !0,
    embed: !0,
    hr: !0,
    img: !0,
    input: !0,
    keygen: !0,
    link: !0,
    meta: !0,
    param: !0,
    source: !0,
    track: !0,
    wbr: !0
}, omittedCloseTags_1 = omittedCloseTags, _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) Object.prototype.hasOwnProperty.call(source, key) && (target[key] = source[key]);
    }
    return target;
}, voidElementTags = _extends({
    menuitem: !0
}, omittedCloseTags_1), voidElementTags_1 = voidElementTags, HTML = "__html";

function getDeclarationErrorAddendum(getCurrentOwnerName) {
    return "";
}

function assertValidProps(tag, props, getCurrentOwnerName) {
    props && (// Note the use of `==` which checks for null or undefined.
    voidElementTags_1[tag] && invariant(null == props.children && null == props.dangerouslySetInnerHTML, "%s is a void element tag and must neither have `children` nor " + "use `dangerouslySetInnerHTML`.%s", tag, getDeclarationErrorAddendum(getCurrentOwnerName)), 
    null != props.dangerouslySetInnerHTML && (invariant(null == props.children, "Can only set one of `children` or `props.dangerouslySetInnerHTML`."), 
    invariant("object" == typeof props.dangerouslySetInnerHTML && HTML in props.dangerouslySetInnerHTML, "`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. " + "Please visit https://fb.me/react-invariant-dangerously-set-inner-html " + "for more information.")), 
    invariant(null == props.style || "object" == typeof props.style, "The `style` prop expects a mapping from style properties to values, " + "not a string. For example, style={{marginRight: spacing + 'em'}} when " + "using JSX.%s", getDeclarationErrorAddendum(getCurrentOwnerName)));
}

var assertValidProps_1 = assertValidProps;

/**
 * Escape and wrap key so it is safe to use as a reactid
 *
 * @param {string} key to be escaped.
 * @return {string} the escaped key.
 */
function escape(key) {
    var escaperLookup = {
        "=": "=0",
        ":": "=2"
    };
    return "$" + ("" + key).replace(/[=:]/g, function(match) {
        return escaperLookup[match];
    });
}

var unescapeInDev = emptyFunction, KeyEscapeUtils = {
    escape: escape,
    unescapeInDev: unescapeInDev
}, KeyEscapeUtils_1 = KeyEscapeUtils, ITERATOR_SYMBOL = "function" == typeof Symbol && Symbol.iterator, FAUX_ITERATOR_SYMBOL = "@@iterator", REACT_ELEMENT_TYPE = "function" == typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103, SEPARATOR = ".", SUBSEPARATOR = ":";

/**
 * Generate a key string that identifies a component within a set.
 *
 * @param {*} component A component that could contain a manual key.
 * @param {number} index Index that is used if a manual key is not provided.
 * @return {string}
 */
function getComponentKey(component, index) {
    // Do some typechecking here since we call this blindly. We want to ensure
    // that we don't block potential future ES APIs.
    // Do some typechecking here since we call this blindly. We want to ensure
    // that we don't block potential future ES APIs.
    return component && "object" == typeof component && null != component.key ? KeyEscapeUtils_1.escape(component.key) : index.toString(36);
}

/**
 * @param {?*} children Children tree container.
 * @param {!string} nameSoFar Name of the key path so far.
 * @param {!function} callback Callback to invoke with each child found.
 * @param {?*} traverseContext Used to pass information throughout the traversal
 * process.
 * @return {!number} The number of children in this subtree.
 */
function traverseStackChildrenImpl(children, nameSoFar, callback, traverseContext) {
    var type = typeof children;
    if ("undefined" !== type && "boolean" !== type || (// All of the above are perceived as null.
    children = null), null === children || "string" === type || "number" === type || // The following is inlined from ReactElement. This means we can optimize
    // some checks. React Fiber also inlines this logic for similar purposes.
    "object" === type && children.$$typeof === REACT_ELEMENT_TYPE) // If it's the only child, treat the name as if it was wrapped in an array
    // so that it's consistent if the number of children grows.
    return callback(traverseContext, children, "" === nameSoFar ? SEPARATOR + getComponentKey(children, 0) : nameSoFar), 
    1;
    var child, nextName, subtreeCount = 0, nextNamePrefix = "" === nameSoFar ? SEPARATOR : nameSoFar + SUBSEPARATOR;
    if (Array.isArray(children)) for (var i = 0; i < children.length; i++) child = children[i], 
    nextName = nextNamePrefix + getComponentKey(child, i), subtreeCount += traverseStackChildrenImpl(child, nextName, callback, traverseContext); else {
        var iteratorFn = ITERATOR_SYMBOL && children[ITERATOR_SYMBOL] || children[FAUX_ITERATOR_SYMBOL];
        if ("function" == typeof iteratorFn) for (var step, iterator = iteratorFn.call(children), ii = 0; !(step = iterator.next()).done; ) child = step.value, 
        nextName = nextNamePrefix + getComponentKey(child, ii++), subtreeCount += traverseStackChildrenImpl(child, nextName, callback, traverseContext); else if ("object" === type) {
            var addendum = "", childrenString = "" + children;
            invariant(!1, "Objects are not valid as a React child (found: %s).%s", "[object Object]" === childrenString ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString, addendum);
        }
    }
    return subtreeCount;
}

/**
 * Traverses children that are typically specified as `props.children`, but
 * might also be specified through attributes:
 *
 * - `traverseStackChildren(this.props.children, ...)`
 * - `traverseStackChildren(this.props.leftPanelChildren, ...)`
 *
 * The `traverseContext` is an optional argument that is passed through the
 * entire traversal. It can be used to store accumulations or anything else that
 * the callback might find relevant.
 *
 * @param {?*} children Children tree object.
 * @param {!function} callback To invoke upon traversing each child.
 * @param {?*} traverseContext Context for traversal.
 * @return {!number} The number of children in this subtree.
 */
function traverseStackChildren(children, callback, traverseContext) {
    return null == children ? 0 : traverseStackChildrenImpl(children, "", callback, traverseContext);
}

var traverseStackChildren_1 = traverseStackChildren;

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}

var registrationNameModules = EventPluginRegistry_1.registrationNameModules, newlineEatingTags = {
    listing: !0,
    pre: !0,
    textarea: !0
}, VALID_TAG_REGEX = /^[a-zA-Z][a-zA-Z:_\.\-\d]*$/, validatedTagCache = {};

function validateDangerousTag(tag) {
    validatedTagCache.hasOwnProperty(tag) || (invariant(VALID_TAG_REGEX.test(tag), "Invalid tag: %s", tag), 
    validatedTagCache[tag] = !0);
}

function warnNoop(publicInstance, callerName) {}

function shouldConstruct(Component) {
    return Component.prototype && Component.prototype.isReactComponent;
}

function getNonChildrenInnerMarkup(props) {
    var innerHTML = props.dangerouslySetInnerHTML;
    if (null != innerHTML) {
        if (null != innerHTML.__html) return innerHTML.__html;
    } else {
        var content = props.children;
        if ("string" == typeof content || "number" == typeof content) return escapeTextContentForBrowser_1(content);
    }
    return null;
}

function flattenOptionChildren(children) {
    var content = "";
    // Flatten children and warn if they aren't strings or numbers;
    // invalid types are ignored.
    return React.Children.forEach(children, function(child) {
        null != child && ("string" != typeof child && "number" != typeof child || (content += child));
    }), content;
}

function maskContext(type, context) {
    var contextTypes = type.contextTypes;
    if (!contextTypes) return emptyObject;
    var maskedContext = {};
    for (var contextName in contextTypes) maskedContext[contextName] = context[contextName];
    return maskedContext;
}

function processContext(type, context) {
    return maskContext(type, context);
}

var STYLE = "style", RESERVED_PROPS = {
    children: null,
    dangerouslySetInnerHTML: null,
    suppressContentEditableWarning: null
};

function isCustomComponent(tagName, props) {
    return tagName.indexOf("-") >= 0 || null != props.is;
}

function createOpenTagMarkup(tagVerbatim, tagLowercase, props, makeStaticMarkup, isRootElement, instForDebug) {
    var ret = "<" + tagVerbatim;
    for (var propKey in props) if (props.hasOwnProperty(propKey)) {
        var propValue = props[propKey];
        if (null != propValue && !registrationNameModules.hasOwnProperty(propKey)) {
            propKey === STYLE && (propValue = CSSPropertyOperations_1.createMarkupForStyles(propValue, instForDebug));
            var markup = null;
            isCustomComponent(tagLowercase, props) ? RESERVED_PROPS.hasOwnProperty(propKey) || (markup = DOMPropertyOperations_1.createMarkupForCustomAttribute(propKey, propValue)) : markup = DOMPropertyOperations_1.createMarkupForProperty(propKey, propValue), 
            markup && (ret += " " + markup);
        }
    }
    // For static pages, no need to put React ID and checksum. Saves lots of
    // bytes.
    // For static pages, no need to put React ID and checksum. Saves lots of
    // bytes.
    return makeStaticMarkup ? ret : (isRootElement && (ret += " " + DOMPropertyOperations_1.createMarkupForRoot()), 
    ret += " " + DOMPropertyOperations_1.createMarkupForID(""));
}

function resolve(child, context) {
    for (// TODO: We'll need to support Arrays (and strings) after Fiber is rolled out
    invariant(!Array.isArray(child), "Did not expect to receive an Array child"); React.isValidElement(child) && "function" == typeof child.type; ) {
        var inst, Component = child.type, publicContext = processContext(Component, context), queue = [], replace = !1, updater = {
            isMounted: function(publicInstance) {
                return !1;
            },
            enqueueForceUpdate: function(publicInstance) {
                if (null === queue) return warnNoop(publicInstance, "forceUpdate"), null;
            },
            enqueueReplaceState: function(publicInstance, completeState) {
                replace = !0, queue = [ completeState ];
            },
            enqueueSetState: function(publicInstance, partialState) {
                if (null === queue) return warnNoop(publicInstance, "setState"), null;
                queue.push(partialState);
            }
        };
        if (shouldConstruct(Component)) inst = new Component(child.props, publicContext, updater); else if (null == (inst = Component(child.props, publicContext, updater)) || null == inst.render) {
            child = inst;
            continue;
        }
        inst.props = child.props, inst.context = publicContext, inst.updater = updater;
        var initialState = inst.state;
        if (void 0 === initialState && (inst.state = initialState = null), inst.componentWillMount) if (inst.componentWillMount(), 
        queue.length) {
            var oldQueue = queue, oldReplace = replace;
            if (queue = null, replace = !1, oldReplace && 1 === oldQueue.length) inst.state = oldQueue[0]; else {
                for (var nextState = oldReplace ? oldQueue[0] : inst.state, dontMutate = !0, i = oldReplace ? 1 : 0; i < oldQueue.length; i++) {
                    var partial = oldQueue[i], partialState = "function" == typeof partial ? partial.call(inst, nextState, child.props, publicContext) : partial;
                    partialState && (dontMutate ? (dontMutate = !1, nextState = Object.assign({}, nextState, partialState)) : Object.assign(nextState, partialState));
                }
                inst.state = nextState;
            }
        } else queue = null;
        child = inst.render();
        var childContext = inst.getChildContext && inst.getChildContext();
        childContext && (context = Object.assign({}, context, childContext));
    }
    return {
        child: child,
        context: context
    };
}

var ReactDOMServerRenderer = function() {
    function ReactDOMServerRenderer(element, makeStaticMarkup) {
        _classCallCheck(this, ReactDOMServerRenderer), this.stack = [ {
            children: [ element ],
            childIndex: 0,
            context: emptyObject,
            footer: ""
        } ], this.exhausted = !1, this.currentSelectValue = null, this.previousWasTextNode = !1, 
        this.makeStaticMarkup = makeStaticMarkup;
    }
    return ReactDOMServerRenderer.prototype.read = function(bytes) {
        if (this.exhausted) return null;
        for (var out = ""; out.length < bytes; ) {
            if (0 === this.stack.length) {
                this.exhausted = !0;
                break;
            }
            var frame = this.stack[this.stack.length - 1];
            if (frame.childIndex >= frame.children.length) out += frame.footer, this.previousWasTextNode = !1, 
            this.stack.pop(), "select" === frame.tag && (this.currentSelectValue = null); else {
                var child = frame.children[frame.childIndex++];
                out += this.render(child, frame.context);
            }
        }
        return out;
    }, ReactDOMServerRenderer.prototype.render = function(child, context) {
        if ("string" == typeof child || "number" == typeof child) {
            var text = "" + child;
            return "" === text ? "" : this.makeStaticMarkup ? escapeTextContentForBrowser_1(text) : this.previousWasTextNode ? "\x3c!-- --\x3e" + escapeTextContentForBrowser_1(text) : (this.previousWasTextNode = !0, 
            escapeTextContentForBrowser_1(text));
        }
        var _resolve = resolve(child, context);
        return child = _resolve.child, context = _resolve.context, null === child || !1 === child ? "" : this.renderDOM(child, context);
    }, ReactDOMServerRenderer.prototype.renderDOM = function(element, context) {
        var tag = element.type.toLowerCase();
        validateDangerousTag(tag);
        var props = element.props;
        if ("input" === tag) props = Object.assign({
            type: void 0
        }, props, {
            defaultChecked: void 0,
            defaultValue: void 0,
            value: null != props.value ? props.value : props.defaultValue,
            checked: null != props.checked ? props.checked : props.defaultChecked
        }); else if ("textarea" === tag) {
            var initialValue = props.value;
            if (null == initialValue) {
                var defaultValue = props.defaultValue, textareaChildren = props.children;
                null != textareaChildren && (invariant(null == defaultValue, "If you supply `defaultValue` on a <textarea>, do not pass children."), 
                Array.isArray(textareaChildren) && (invariant(textareaChildren.length <= 1, "<textarea> can only have at most one child."), 
                textareaChildren = textareaChildren[0]), defaultValue = "" + textareaChildren), 
                null == defaultValue && (defaultValue = ""), initialValue = defaultValue;
            }
            props = Object.assign({}, props, {
                value: void 0,
                children: "" + initialValue
            });
        } else if ("select" === tag) this.currentSelectValue = null != props.value ? props.value : props.defaultValue, 
        props = Object.assign({}, props, {
            value: void 0
        }); else if ("option" === tag) {
            var selected = null, selectValue = this.currentSelectValue, optionChildren = flattenOptionChildren(props.children);
            if (null != selectValue) {
                var value;
                if (value = null != props.value ? props.value + "" : optionChildren, selected = !1, 
                Array.isArray(selectValue)) {
                    // multiple
                    for (var j = 0; j < selectValue.length; j++) if ("" + selectValue[j] === value) {
                        selected = !0;
                        break;
                    }
                } else selected = "" + selectValue === value;
                props = Object.assign({
                    selected: void 0,
                    children: void 0
                }, props, {
                    selected: selected,
                    children: optionChildren
                });
            }
        }
        assertValidProps_1(tag, props);
        var out = createOpenTagMarkup(element.type, tag, props, this.makeStaticMarkup, 1 === this.stack.length, null), footer = "";
        omittedCloseTags_1.hasOwnProperty(tag) ? out += "/>" : (out += ">", footer = "</" + element.type + ">");
        var children = [], innerMarkup = getNonChildrenInnerMarkup(props);
        // text/html ignores the first character in these tags if it's a newline
        // Prefer to break application/xml over text/html (for now) by adding
        // a newline specifically to get eaten by the parser. (Alternately for
        // textareas, replacing "^\n" with "\r\n" doesn't get eaten, and the first
        // \r is normalized out by HTMLTextAreaElement#value.)
        // See: <http://www.w3.org/TR/html-polyglot/#newlines-in-textarea-and-pre>
        // See: <http://www.w3.org/TR/html5/syntax.html#element-restrictions>
        // See: <http://www.w3.org/TR/html5/syntax.html#newlines>
        // See: Parsing of "textarea" "listing" and "pre" elements
        //  from <http://www.w3.org/TR/html5/syntax.html#parsing-main-inbody>
        return null != innerMarkup ? (newlineEatingTags[tag] && "\n" === innerMarkup.charAt(0) && (out += "\n"), 
        out += innerMarkup) : traverseStackChildren_1(props.children, function(ctx, child, name) {
            null != child && children.push(child);
        }), this.stack.push({
            tag: tag,
            children: children,
            childIndex: 0,
            context: context,
            footer: footer
        }), out;
    }, ReactDOMServerRenderer;
}(), ReactPartialRenderer = ReactDOMServerRenderer;

/**
 * Render a ReactElement to its initial HTML. This should only be used on the
 * server.
 * See https://facebook.github.io/react/docs/react-dom-server.html#rendertostring
 */
function renderToString(element) {
    return invariant(React.isValidElement(element), "renderToString(): You must pass a valid ReactElement."), 
    new ReactPartialRenderer(element, !1).read(1 / 0);
}

/**
 * Similar to renderToString, except this doesn't create extra DOM attributes
 * such as data-react-id that React uses internally.
 * See https://facebook.github.io/react/docs/react-dom-server.html#rendertostaticmarkup
 */
function renderToStaticMarkup(element) {
    return invariant(React.isValidElement(element), "renderToStaticMarkup(): You must pass a valid ReactElement."), 
    new ReactPartialRenderer(element, !0).read(1 / 0);
}

var ReactDOMStringRenderer = {
    renderToString: renderToString,
    renderToStaticMarkup: renderToStaticMarkup
}, ReactVersion = "16.0.0-alpha.13";

ReactDOMInjection.inject();

var ReactDOMServerEntry = {
    renderToString: ReactDOMStringRenderer.renderToString,
    renderToStaticMarkup: ReactDOMStringRenderer.renderToStaticMarkup,
    version: ReactVersion
};

module.exports = ReactDOMServerEntry;
