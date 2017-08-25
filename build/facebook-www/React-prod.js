/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @providesModule React-prod
 */
"use strict";

require("fbjs/lib/warning");

var emptyObject = require("fbjs/lib/emptyObject"), invariant = require("fbjs/lib/invariant"), emptyFunction = require("fbjs/lib/emptyFunction");

function warnNoop(publicInstance, callerName) {}

/**
 * This is the abstract API for an update queue.
 */
var ReactNoopUpdateQueue = {
    /**
   * Checks whether or not this composite component is mounted.
   * @param {ReactClass} publicInstance The instance we want to test.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
    isMounted: function(publicInstance) {
        return !1;
    },
    /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldComponentUpdate`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {?function} callback Called after component is updated.
   * @param {?string} Name of the calling function in the public API.
   * @internal
   */
    enqueueForceUpdate: function(publicInstance, callback, callerName) {
        warnNoop(publicInstance, "forceUpdate");
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
    enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
        warnNoop(publicInstance, "replaceState");
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
    enqueueSetState: function(publicInstance, partialState, callback, callerName) {
        warnNoop(publicInstance, "setState");
    }
}, ReactNoopUpdateQueue_1 = ReactNoopUpdateQueue, lowPriorityWarning = require("lowPriorityWarning");

/**
 * Base class helpers for the updating state of a component.
 */
function ReactComponent(props, context, updater) {
    this.props = props, this.context = context, this.refs = emptyObject, // We initialize the default updater but the real one gets injected by the
    // renderer.
    this.updater = updater || ReactNoopUpdateQueue_1;
}

ReactComponent.prototype.isReactComponent = {}, /**
 * Sets a subset of the state. Always use this to mutate
 * state. You should treat `this.state` as immutable.
 *
 * There is no guarantee that `this.state` will be immediately updated, so
 * accessing `this.state` after calling this method may return the old value.
 *
 * There is no guarantee that calls to `setState` will run synchronously,
 * as they may eventually be batched together.  You can provide an optional
 * callback that will be executed when the call to setState is actually
 * completed.
 *
 * When a function is provided to setState, it will be called at some point in
 * the future (not synchronously). It will be called with the up to date
 * component arguments (state, props, context). These values can be different
 * from this.* because your function may be called after receiveProps but before
 * shouldComponentUpdate, and this new state, props, and context will not yet be
 * assigned to this.
 *
 * @param {object|function} partialState Next partial state or function to
 *        produce next partial state to be merged with current state.
 * @param {?function} callback Called after state is updated.
 * @final
 * @protected
 */
ReactComponent.prototype.setState = function(partialState, callback) {
    invariant("object" == typeof partialState || "function" == typeof partialState || null == partialState, "setState(...): takes an object of state variables to update or a " + "function which returns an object of state variables."), 
    this.updater.enqueueSetState(this, partialState, callback, "setState");
}, /**
 * Forces an update. This should only be invoked when it is known with
 * certainty that we are **not** in a DOM transaction.
 *
 * You may want to call this when you know that some deeper aspect of the
 * component's state has changed but `setState` was not called.
 *
 * This will not invoke `shouldComponentUpdate`, but it will invoke
 * `componentWillUpdate` and `componentDidUpdate`.
 *
 * @param {?function} callback Called after update is complete.
 * @final
 * @protected
 */
ReactComponent.prototype.forceUpdate = function(callback) {
    this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
};

/**
 * Deprecated APIs. These APIs used to exist on classic React classes but since
 * we would like to deprecate them, we're not going to move them over to this
 * modern base class. Instead, we define a getter that warns if it's accessed.
 */
/**
 * Base class helpers for the updating state of a component.
 */
function ReactPureComponent(props, context, updater) {
    // Duplicated from ReactComponent.
    this.props = props, this.context = context, this.refs = emptyObject, // We initialize the default updater but the real one gets injected by the
    // renderer.
    this.updater = updater || ReactNoopUpdateQueue_1;
}

function ComponentDummy() {}

ComponentDummy.prototype = ReactComponent.prototype, ReactPureComponent.prototype = new ComponentDummy(), 
ReactPureComponent.prototype.constructor = ReactPureComponent, // Avoid an extra prototype jump for these methods.
Object.assign(ReactPureComponent.prototype, ReactComponent.prototype), ReactPureComponent.prototype.isPureReactComponent = !0;

var ReactBaseClasses = {
    Component: ReactComponent,
    PureComponent: ReactPureComponent
}, oneArgumentPooler = function(copyFieldsFrom) {
    var Klass = this;
    if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        return Klass.call(instance, copyFieldsFrom), instance;
    }
    return new Klass(copyFieldsFrom);
}, twoArgumentPooler$1 = function(a1, a2) {
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
}, fourArgumentPooler$1 = function(a1, a2, a3, a4) {
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
    twoArgumentPooler: twoArgumentPooler$1,
    threeArgumentPooler: threeArgumentPooler,
    fourArgumentPooler: fourArgumentPooler$1
}, PooledClass_1 = PooledClass, ReactCurrentOwner = require("ReactCurrentOwner"), hasOwnProperty = Object.prototype.hasOwnProperty, REACT_ELEMENT_TYPE = "function" == typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103, RESERVED_PROPS = {
    key: !0,
    ref: !0,
    __self: !0,
    __source: !0
};

function hasValidRef(config) {
    return void 0 !== config.ref;
}

function hasValidKey(config) {
    return void 0 !== config.key;
}

/**
 * Factory method to create a new React element. This no longer adheres to
 * the class pattern, so do not use new to call it. Also, no instanceof check
 * will work. Instead test $$typeof field against Symbol.for('react.element') to check
 * if something is a React Element.
 *
 * @param {*} type
 * @param {*} key
 * @param {string|object} ref
 * @param {*} self A *temporary* helper to detect places where `this` is
 * different from the `owner` when React.createElement is called, so that we
 * can warn. We want to get rid of owner and replace string `ref`s with arrow
 * functions, and as long as `this` and owner are the same, there will be no
 * change in behavior.
 * @param {*} source An annotation object (added by a transpiler or otherwise)
 * indicating filename, line number, and/or other information.
 * @param {*} owner
 * @param {*} props
 * @internal
 */
var ReactElement = function(type, key, ref, self, source, owner, props) {
    return {
        // This tag allow us to uniquely identify this as a React Element
        $$typeof: REACT_ELEMENT_TYPE,
        // Built-in properties that belong on the element
        type: type,
        key: key,
        ref: ref,
        props: props,
        // Record the component responsible for creating this element.
        _owner: owner
    };
};

/**
 * Create and return a new ReactElement of the given type.
 * See https://facebook.github.io/react/docs/react-api.html#createelement
 */
ReactElement.createElement = function(type, config, children) {
    var propName, props = {}, key = null, ref = null, self = null, source = null;
    if (null != config) {
        hasValidRef(config) && (ref = config.ref), hasValidKey(config) && (key = "" + config.key), 
        self = void 0 === config.__self ? null : config.__self, source = void 0 === config.__source ? null : config.__source;
        // Remaining properties are added to a new props object
        for (propName in config) hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName) && (props[propName] = config[propName]);
    }
    // Children can be more than one argument, and those are transferred onto
    // the newly allocated props object.
    var childrenLength = arguments.length - 2;
    if (1 === childrenLength) props.children = children; else if (childrenLength > 1) {
        for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
        props.children = childArray;
    }
    // Resolve default props
    if (type && type.defaultProps) {
        var defaultProps = type.defaultProps;
        for (propName in defaultProps) void 0 === props[propName] && (props[propName] = defaultProps[propName]);
    }
    return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
}, /**
 * Return a function that produces ReactElements of a given type.
 * See https://facebook.github.io/react/docs/react-api.html#createfactory
 */
ReactElement.createFactory = function(type) {
    var factory = ReactElement.createElement.bind(null, type);
    // Expose the type on the factory and the prototype so that it can be
    // easily accessed on elements. E.g. `<Foo />.type === Foo`.
    // This should not be named `constructor` since this may not be the function
    // that created the element, and it may not even be a constructor.
    // Legacy hook TODO: Warn if this is accessed
    return factory.type = type, factory;
}, ReactElement.cloneAndReplaceKey = function(oldElement, newKey) {
    return ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
}, /**
 * Clone and return a new ReactElement using element as the starting point.
 * See https://facebook.github.io/react/docs/react-api.html#cloneelement
 */
ReactElement.cloneElement = function(element, config, children) {
    var propName, props = Object.assign({}, element.props), key = element.key, ref = element.ref, self = element._self, source = element._source, owner = element._owner;
    if (null != config) {
        hasValidRef(config) && (// Silently steal the ref from the parent.
        ref = config.ref, owner = ReactCurrentOwner.current), hasValidKey(config) && (key = "" + config.key);
        // Remaining properties override existing props
        var defaultProps;
        element.type && element.type.defaultProps && (defaultProps = element.type.defaultProps);
        for (propName in config) hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName) && (void 0 === config[propName] && void 0 !== defaultProps ? // Resolve default props
        props[propName] = defaultProps[propName] : props[propName] = config[propName]);
    }
    // Children can be more than one argument, and those are transferred onto
    // the newly allocated props object.
    var childrenLength = arguments.length - 2;
    if (1 === childrenLength) props.children = children; else if (childrenLength > 1) {
        for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
        props.children = childArray;
    }
    return ReactElement(element.type, key, ref, self, source, owner, props);
}, /**
 * Verifies the object is a ReactElement.
 * See https://facebook.github.io/react/docs/react-api.html#isvalidelement
 * @param {?object} object
 * @return {boolean} True if `object` is a valid component.
 * @final
 */
ReactElement.isValidElement = function(object) {
    return "object" == typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
};

var ReactElement_1 = ReactElement, ITERATOR_SYMBOL = "function" == typeof Symbol && Symbol.iterator, FAUX_ITERATOR_SYMBOL = "@@iterator", REACT_ELEMENT_TYPE$1 = "function" == typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103, SEPARATOR = ".", SUBSEPARATOR = ":";

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

var unescapeInDev = emptyFunction;

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
    return "object" == typeof component && null !== component && null != component.key ? escape(component.key) : index.toString(36);
}

/**
 * @param {?*} children Children tree container.
 * @param {!string} nameSoFar Name of the key path so far.
 * @param {!function} callback Callback to invoke with each child found.
 * @param {?*} traverseContext Used to pass information throughout the traversal
 * process.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildrenImpl(children, nameSoFar, callback, traverseContext) {
    var type = typeof children;
    if ("undefined" !== type && "boolean" !== type || (// All of the above are perceived as null.
    children = null), null === children || "string" === type || "number" === type || // The following is inlined from ReactElement. This means we can optimize
    // some checks. React Fiber also inlines this logic for similar purposes.
    "object" === type && children.$$typeof === REACT_ELEMENT_TYPE$1) // If it's the only child, treat the name as if it was wrapped in an array
    // so that it's consistent if the number of children grows.
    return callback(traverseContext, children, "" === nameSoFar ? SEPARATOR + getComponentKey(children, 0) : nameSoFar, unescapeInDev), 
    1;
    var child, nextName, subtreeCount = 0, nextNamePrefix = "" === nameSoFar ? SEPARATOR : nameSoFar + SUBSEPARATOR;
    if (Array.isArray(children)) for (var i = 0; i < children.length; i++) child = children[i], 
    nextName = nextNamePrefix + getComponentKey(child, i), subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext); else {
        var iteratorFn = ITERATOR_SYMBOL && children[ITERATOR_SYMBOL] || children[FAUX_ITERATOR_SYMBOL];
        if ("function" == typeof iteratorFn) for (var step, iterator = iteratorFn.call(children), ii = 0; !(step = iterator.next()).done; ) child = step.value, 
        nextName = nextNamePrefix + getComponentKey(child, ii++), subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext); else if ("object" === type) {
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
 * - `traverseAllChildren(this.props.children, ...)`
 * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
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
function traverseAllChildren(children, callback, traverseContext) {
    return null == children ? 0 : traverseAllChildrenImpl(children, "", callback, traverseContext);
}

var traverseAllChildren_1 = traverseAllChildren, twoArgumentPooler = PooledClass_1.twoArgumentPooler, fourArgumentPooler = PooledClass_1.fourArgumentPooler, userProvidedKeyEscapeRegex = /\/+/g;

function escapeUserProvidedKey(text) {
    return ("" + text).replace(userProvidedKeyEscapeRegex, "$&/");
}

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * traversal. Allows avoiding binding callbacks.
 *
 * @constructor ForEachBookKeeping
 * @param {!function} forEachFunction Function to perform traversal with.
 * @param {?*} forEachContext Context to perform context with.
 */
function ForEachBookKeeping(forEachFunction, forEachContext) {
    this.func = forEachFunction, this.context = forEachContext, this.count = 0;
}

ForEachBookKeeping.prototype.destructor = function() {
    this.func = null, this.context = null, this.count = 0;
}, PooledClass_1.addPoolingTo(ForEachBookKeeping, twoArgumentPooler);

function forEachSingleChild(bookKeeping, child, name) {
    var func = bookKeeping.func, context = bookKeeping.context;
    func.call(context, child, bookKeeping.count++);
}

/**
 * Iterates through children that are typically specified as `props.children`.
 *
 * See https://facebook.github.io/react/docs/react-api.html#react.children.foreach
 *
 * The provided forEachFunc(child, index) will be called for each
 * leaf child.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} forEachFunc
 * @param {*} forEachContext Context for forEachContext.
 */
function forEachChildren(children, forEachFunc, forEachContext) {
    if (null == children) return children;
    var traverseContext = ForEachBookKeeping.getPooled(forEachFunc, forEachContext);
    traverseAllChildren_1(children, forEachSingleChild, traverseContext), ForEachBookKeeping.release(traverseContext);
}

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * mapping. Allows avoiding binding callbacks.
 *
 * @constructor MapBookKeeping
 * @param {!*} mapResult Object containing the ordered map of results.
 * @param {!function} mapFunction Function to perform mapping with.
 * @param {?*} mapContext Context to perform mapping with.
 */
function MapBookKeeping(mapResult, keyPrefix, mapFunction, mapContext) {
    this.result = mapResult, this.keyPrefix = keyPrefix, this.func = mapFunction, this.context = mapContext, 
    this.count = 0;
}

MapBookKeeping.prototype.destructor = function() {
    this.result = null, this.keyPrefix = null, this.func = null, this.context = null, 
    this.count = 0;
}, PooledClass_1.addPoolingTo(MapBookKeeping, fourArgumentPooler);

function mapSingleChildIntoContext(bookKeeping, child, childKey) {
    var result = bookKeeping.result, keyPrefix = bookKeeping.keyPrefix, func = bookKeeping.func, context = bookKeeping.context, mappedChild = func.call(context, child, bookKeeping.count++);
    Array.isArray(mappedChild) ? mapIntoWithKeyPrefixInternal(mappedChild, result, childKey, emptyFunction.thatReturnsArgument) : null != mappedChild && (ReactElement_1.isValidElement(mappedChild) && (mappedChild = ReactElement_1.cloneAndReplaceKey(mappedChild, // Keep both the (mapped) and old keys if they differ, just as
    // traverseAllChildren used to do for objects as children
    keyPrefix + (!mappedChild.key || child && child.key === mappedChild.key ? "" : escapeUserProvidedKey(mappedChild.key) + "/") + childKey)), 
    result.push(mappedChild));
}

function mapIntoWithKeyPrefixInternal(children, array, prefix, func, context) {
    var escapedPrefix = "";
    null != prefix && (escapedPrefix = escapeUserProvidedKey(prefix) + "/");
    var traverseContext = MapBookKeeping.getPooled(array, escapedPrefix, func, context);
    traverseAllChildren_1(children, mapSingleChildIntoContext, traverseContext), MapBookKeeping.release(traverseContext);
}

/**
 * Maps children that are typically specified as `props.children`.
 *
 * See https://facebook.github.io/react/docs/react-api.html#react.children.map
 *
 * The provided mapFunction(child, key, index) will be called for each
 * leaf child.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} func The map function.
 * @param {*} context Context for mapFunction.
 * @return {object} Object containing the ordered map of results.
 */
function mapChildren(children, func, context) {
    if (null == children) return children;
    var result = [];
    return mapIntoWithKeyPrefixInternal(children, result, null, func, context), result;
}

function forEachSingleChildDummy(traverseContext, child, name) {
    return null;
}

/**
 * Count the number of children that are typically specified as
 * `props.children`.
 *
 * See https://facebook.github.io/react/docs/react-api.html#react.children.count
 *
 * @param {?*} children Children tree container.
 * @return {number} The number of children.
 */
function countChildren(children, context) {
    return traverseAllChildren_1(children, forEachSingleChildDummy, null);
}

/**
 * Flatten a children object (typically specified as `props.children`) and
 * return an array with appropriately re-keyed children.
 *
 * See https://facebook.github.io/react/docs/react-api.html#react.children.toarray
 */
function toArray(children) {
    var result = [];
    return mapIntoWithKeyPrefixInternal(children, result, null, emptyFunction.thatReturnsArgument), 
    result;
}

var ReactChildren = {
    forEach: forEachChildren,
    map: mapChildren,
    mapIntoWithKeyPrefixInternal: mapIntoWithKeyPrefixInternal,
    count: countChildren,
    toArray: toArray
}, ReactChildren_1 = ReactChildren, ReactVersion = "16.0.0-alpha.13";

/**
 * Returns the first child in a collection of children and verifies that there
 * is only one child in the collection.
 *
 * See https://facebook.github.io/react/docs/react-api.html#react.children.only
 *
 * The current implementation of this function assumes that a single child gets
 * passed without a wrapper, but the purpose of this helper function is to
 * abstract away the particular structure of children.
 *
 * @param {?object} children Child collection structure.
 * @return {ReactElement} The first and only `ReactElement` contained in the
 * structure.
 */
function onlyChild(children) {
    return invariant(ReactElement_1.isValidElement(children), "React.Children.only expected to receive a single React element child."), 
    children;
}

var onlyChild_1 = onlyChild, createElement = ReactElement_1.createElement, createFactory = ReactElement_1.createFactory, cloneElement = ReactElement_1.cloneElement, React = {
    Children: {
        map: ReactChildren_1.map,
        forEach: ReactChildren_1.forEach,
        count: ReactChildren_1.count,
        toArray: ReactChildren_1.toArray,
        only: onlyChild_1
    },
    Component: ReactBaseClasses.Component,
    PureComponent: ReactBaseClasses.PureComponent,
    createElement: createElement,
    cloneElement: cloneElement,
    isValidElement: ReactElement_1.isValidElement,
    createFactory: createFactory,
    version: ReactVersion,
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
        ReactCurrentOwner: require("ReactCurrentOwner")
    }
}, ReactEntry = React;

module.exports = ReactEntry;
