/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 * @providesModule ReactDOMFiber-prod
 */
"use strict";

var invariant = require("fbjs/lib/invariant"), EventListener = require("fbjs/lib/EventListener"), React = require("React"), warning = require("fbjs/lib/warning"), ExecutionEnvironment = require("fbjs/lib/ExecutionEnvironment");

require("fbjs/lib/camelizeStyleName");

var hyphenateStyleName = require("fbjs/lib/hyphenateStyleName"), memoizeStringOnly = require("fbjs/lib/memoizeStringOnly");

require("prop-types");

var emptyFunction = require("fbjs/lib/emptyFunction"), containsNode = require("fbjs/lib/containsNode"), focusNode = require("fbjs/lib/focusNode"), getActiveElement = require("fbjs/lib/getActiveElement"), shallowEqual = require("fbjs/lib/shallowEqual");

require("prop-types/checkPropTypes");

var emptyObject = require("fbjs/lib/emptyObject"), eventPluginOrder = null, namesToPlugins = {};

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
}, EventPluginRegistry_1 = EventPluginRegistry, oneArgumentPooler = function(copyFieldsFrom) {
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
}, PooledClass_1 = PooledClass;

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
}, DOMProperty_1 = DOMProperty, ReactDOMComponentFlags = {
    hasCachedChildNodes: 1 << 0
}, ReactDOMComponentFlags_1 = ReactDOMComponentFlags, ReactTypeOfWork = {
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
}, HTMLNodeType = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_FRAGMENT_NODE: 11
}, HTMLNodeType_1 = HTMLNodeType, HostComponent = ReactTypeOfWork.HostComponent, HostText = ReactTypeOfWork.HostText, ELEMENT_NODE$1 = HTMLNodeType_1.ELEMENT_NODE, COMMENT_NODE$1 = HTMLNodeType_1.COMMENT_NODE, ATTR_NAME = DOMProperty_1.ID_ATTRIBUTE_NAME, Flags = ReactDOMComponentFlags_1, randomKey = Math.random().toString(36).slice(2), internalInstanceKey = "__reactInternalInstance$" + randomKey, internalEventHandlersKey = "__reactEventHandlers$" + randomKey;

/**
 * Check if a given node should be cached.
 */
function shouldPrecacheNode(node, nodeID) {
    return node.nodeType === ELEMENT_NODE$1 && node.getAttribute(ATTR_NAME) === "" + nodeID || node.nodeType === COMMENT_NODE$1 && node.nodeValue === " react-text: " + nodeID + " " || node.nodeType === COMMENT_NODE$1 && node.nodeValue === " react-empty: " + nodeID + " ";
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

function precacheFiberNode$1(hostInst, node) {
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
    if (inst.tag === HostComponent || inst.tag === HostText) // In Fiber, this will always be the deepest root.
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
    return inst ? inst.tag === HostComponent || inst.tag === HostText ? inst : inst._hostNode === node ? inst : null : (inst = getClosestInstanceFromNode(node), 
    null != inst && inst._hostNode === node ? inst : null);
}

/**
 * Given a ReactDOMComponent or ReactDOMTextComponent, return the corresponding
 * DOM node.
 */
function getNodeFromInstance(inst) {
    if (inst.tag === HostComponent || inst.tag === HostText) // In Fiber this, is just the state node right now. We assume it will be
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

function updateFiberProps$1(node, props) {
    node[internalEventHandlersKey] = props;
}

var ReactDOMComponentTree = {
    getClosestInstanceFromNode: getClosestInstanceFromNode,
    getInstanceFromNode: getInstanceFromNode,
    getNodeFromInstance: getNodeFromInstance,
    precacheChildNodes: precacheChildNodes,
    precacheNode: precacheNode,
    uncacheNode: uncacheNode,
    precacheFiberNode: precacheFiberNode$1,
    getFiberCurrentPropsFromNode: getFiberCurrentPropsFromNode,
    updateFiberProps: updateFiberProps$1
}, ReactDOMComponentTree_1 = ReactDOMComponentTree, ReactInstanceMap = {
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
}, ReactGlobalSharedState_1 = ReactGlobalSharedState;

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
function getComponentName(instanceOrFiber) {
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

var getComponentName_1 = getComponentName, ReactTypeOfSideEffect = {
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
}, HostRoot$1 = ReactTypeOfWork.HostRoot, HostComponent$1 = ReactTypeOfWork.HostComponent, HostText$1 = ReactTypeOfWork.HostText, NoEffect = ReactTypeOfSideEffect.NoEffect, Placement = ReactTypeOfSideEffect.Placement, MOUNTING = 1, MOUNTED = 2, UNMOUNTED = 3;

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
        if (node.tag === HostComponent$1 || node.tag === HostText$1) return node;
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
}, caughtError = null, invokeGuardedCallback = function(name, func, context, a, b, c, d, e, f) {
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
}, EventPluginUtils_1 = EventPluginUtils, fiberHostComponent = null, ReactControlledComponentInjection = {
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
}, ReactControlledComponent_1 = ReactControlledComponent, stackBatchedUpdates = function(fn, a, b, c, d, e) {
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
}, ReactGenericBatching_1 = ReactGenericBatching, TEXT_NODE$1 = HTMLNodeType_1.TEXT_NODE;

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
    target.nodeType === TEXT_NODE$1 ? target.parentNode : target;
}

var getEventTarget_1 = getEventTarget, HostRoot = ReactTypeOfWork.HostRoot;

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
}, EventPluginHub_1 = EventPluginHub;

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
}, ReactEventEmitterMixin_1 = ReactEventEmitterMixin, useHasFeature;

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

var isEventSupported_1 = isEventSupported;

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
}), ReactBrowserEventEmitter_1 = ReactBrowserEventEmitter, isUnitlessNumber = {
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
}, CSSPropertyOperations_1 = CSSPropertyOperations, DOMNamespaces = {
    html: "http://www.w3.org/1999/xhtml",
    mathml: "http://www.w3.org/1998/Math/MathML",
    svg: "http://www.w3.org/2000/svg"
}, DOMNamespaces_1 = DOMNamespaces, matchHtmlRegExp = /["'&<>]/;

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
}, DOMPropertyOperations_1 = DOMPropertyOperations;

/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDebugCurrentFiber
 * 
 */
function getCurrentFiberOwnerName$3() {
    return null;
}

function getCurrentFiberStackAddendum$1() {
    return null;
}

var ReactDebugCurrentFiber = {
    current: null,
    phase: null,
    getCurrentFiberOwnerName: getCurrentFiberOwnerName$3,
    getCurrentFiberStackAddendum: getCurrentFiberStackAddendum$1
}, ReactDebugCurrentFiber_1 = ReactDebugCurrentFiber;

function isControlled(props) {
    return "checkbox" === props.type || "radio" === props.type ? null != props.checked : null != props.value;
}

/**
 * Implements an <input> host component that allows setting these optional
 * props: `checked`, `value`, `defaultChecked`, and `defaultValue`.
 *
 * If `checked` or `value` are not supplied (or null/undefined), user actions
 * that affect the checked state or value will trigger updates to the element.
 *
 * If they are supplied (and not null/undefined), the rendered element will not
 * trigger updates to the element. Instead, the props must change in order for
 * the rendered element to be updated.
 *
 * The rendered element will be initialized as unchecked (or `defaultChecked`)
 * with an empty value (or `defaultValue`).
 *
 * See http://www.w3.org/TR/2012/WD-html5-20121025/the-input-element.html
 */
var ReactDOMInput = {
    getHostProps: function(element, props) {
        var node = element, value = props.value, checked = props.checked;
        return Object.assign({
            // Make sure we set .type before any other properties (setting .value
            // before .type means .value is lost in IE11 and below)
            type: void 0,
            // Make sure we set .step before .value (setting .value before .step
            // means .value is rounded on mount, based upon step precision)
            step: void 0,
            // Make sure we set .min & .max before .value (to ensure proper order
            // in corner cases such as min or max deriving from value, e.g. Issue #7170)
            min: void 0,
            max: void 0
        }, props, {
            defaultChecked: void 0,
            defaultValue: void 0,
            value: null != value ? value : node._wrapperState.initialValue,
            checked: null != checked ? checked : node._wrapperState.initialChecked
        });
    },
    initWrapperState: function(element, props) {
        var defaultValue = props.defaultValue;
        element._wrapperState = {
            initialChecked: null != props.checked ? props.checked : props.defaultChecked,
            initialValue: null != props.value ? props.value : defaultValue,
            controlled: isControlled(props)
        };
    },
    updateWrapper: function(element, props) {
        var node = element, checked = props.checked;
        null != checked && DOMPropertyOperations_1.setValueForProperty(node, "checked", checked || !1);
        var value = props.value;
        if (null != value) if (0 === value && "" === node.value) node.value = "0"; else if ("number" === props.type) {
            // Simulate `input.valueAsNumber`. IE9 does not support it
            var valueAsNumber = parseFloat(node.value) || 0;
            (// eslint-disable-next-line
            value != valueAsNumber || // eslint-disable-next-line
            value == valueAsNumber && node.value != value) && (// Cast `value` to a string to ensure the value is set correctly. While
            // browsers typically do this as necessary, jsdom doesn't.
            node.value = "" + value);
        } else node.value !== "" + value && (// Cast `value` to a string to ensure the value is set correctly. While
        // browsers typically do this as necessary, jsdom doesn't.
        node.value = "" + value); else null == props.value && null != props.defaultValue && node.defaultValue !== "" + props.defaultValue && (node.defaultValue = "" + props.defaultValue), 
        null == props.checked && null != props.defaultChecked && (node.defaultChecked = !!props.defaultChecked);
    },
    postMountWrapper: function(element, props) {
        var node = element;
        // Detach value from defaultValue. We won't do anything if we're working on
        // submit or reset inputs as those values & defaultValues are linked. They
        // are not resetable nodes so this operation doesn't matter and actually
        // removes browser-default values (eg "Submit Query") when no value is
        // provided.
        switch (props.type) {
          case "submit":
          case "reset":
            break;

          case "color":
          case "date":
          case "datetime":
          case "datetime-local":
          case "month":
          case "time":
          case "week":
            // This fixes the no-show issue on iOS Safari and Android Chrome:
            // https://github.com/facebook/react/issues/7233
            node.value = "", node.value = node.defaultValue;
            break;

          default:
            node.value = node.value;
        }
        // Normally, we'd just do `node.checked = node.checked` upon initial mount, less this bug
        // this is needed to work around a chrome bug where setting defaultChecked
        // will sometimes influence the value of checked (even after detachment).
        // Reference: https://bugs.chromium.org/p/chromium/issues/detail?id=608416
        // We need to temporarily unset name to avoid disrupting radio button groups.
        var name = node.name;
        "" !== name && (node.name = ""), node.defaultChecked = !node.defaultChecked, node.defaultChecked = !node.defaultChecked, 
        "" !== name && (node.name = name);
    },
    restoreControlledState: function(element, props) {
        var node = element;
        ReactDOMInput.updateWrapper(node, props), updateNamedCousins(node, props);
    }
};

function updateNamedCousins(rootNode, props) {
    var name = props.name;
    if ("radio" === props.type && null != name) {
        for (var queryRoot = rootNode; queryRoot.parentNode; ) queryRoot = queryRoot.parentNode;
        for (var group = queryRoot.querySelectorAll("input[name=" + JSON.stringify("" + name) + '][type="radio"]'), i = 0; i < group.length; i++) {
            var otherNode = group[i];
            if (otherNode !== rootNode && otherNode.form === rootNode.form) {
                // This will throw if radio buttons rendered by different copies of React
                // and the same name are rendered into the same form (same as #1939).
                // That's probably okay; we don't support it just as we don't support
                // mixing React radio buttons with non-React ones.
                var otherProps = ReactDOMComponentTree_1.getFiberCurrentPropsFromNode(otherNode);
                invariant(otherProps, "ReactDOMInput: Mixing React and non-React radio inputs with the " + "same `name` is not supported."), 
                // If this is a controlled radio button group, forcing the input that
                // was previously checked to update will cause it to be come re-checked
                // as appropriate.
                ReactDOMInput.updateWrapper(otherNode, otherProps);
            }
        }
    }
}

var ReactDOMFiberInput = ReactDOMInput;

function flattenChildren(children) {
    var content = "";
    // Flatten children and warn if they aren't strings or numbers;
    // invalid types are ignored.
    // We can silently skip them because invalid DOM nesting warning
    // catches these cases in Fiber.
    return React.Children.forEach(children, function(child) {
        null != child && ("string" != typeof child && "number" != typeof child || (content += child));
    }), content;
}

/**
 * Implements an <option> host component that warns when `selected` is set.
 */
var ReactDOMOption = {
    validateProps: function(element, props) {},
    postMountWrapper: function(element, props) {
        // value="" should make a value attribute (#6219)
        null != props.value && element.setAttribute("value", props.value);
    },
    getHostProps: function(element, props) {
        var hostProps = Object.assign({
            children: void 0
        }, props), content = flattenChildren(props.children);
        return content && (hostProps.children = content), hostProps;
    }
}, ReactDOMFiberOption = ReactDOMOption, didWarnValueDefaultValue$1 = !1;

function updateOptions(node, multiple, propValue) {
    var options = node.options;
    if (multiple) {
        for (var selectedValues = propValue, selectedValue = {}, i = 0; i < selectedValues.length; i++) // Prefix to avoid chaos with special keys.
        selectedValue["$" + selectedValues[i]] = !0;
        for (var _i = 0; _i < options.length; _i++) {
            var selected = selectedValue.hasOwnProperty("$" + options[_i].value);
            options[_i].selected !== selected && (options[_i].selected = selected);
        }
    } else {
        for (var _selectedValue = "" + propValue, _i2 = 0; _i2 < options.length; _i2++) if (options[_i2].value === _selectedValue) return void (options[_i2].selected = !0);
        options.length && (options[0].selected = !0);
    }
}

/**
 * Implements a <select> host component that allows optionally setting the
 * props `value` and `defaultValue`. If `multiple` is false, the prop must be a
 * stringable. If `multiple` is true, the prop must be an array of stringables.
 *
 * If `value` is not supplied (or null/undefined), user actions that change the
 * selected option will trigger updates to the rendered options.
 *
 * If it is supplied (and not null/undefined), the rendered options will not
 * update in response to user actions. Instead, the `value` prop must change in
 * order for the rendered options to update.
 *
 * If `defaultValue` is provided, any options with the supplied values will be
 * selected.
 */
var ReactDOMSelect = {
    getHostProps: function(element, props) {
        return Object.assign({}, props, {
            value: void 0
        });
    },
    initWrapperState: function(element, props) {
        var node = element, value = props.value;
        node._wrapperState = {
            initialValue: null != value ? value : props.defaultValue,
            wasMultiple: !!props.multiple
        }, void 0 === props.value || void 0 === props.defaultValue || didWarnValueDefaultValue$1 || (warning(!1, "Select elements must be either controlled or uncontrolled " + "(specify either the value prop, or the defaultValue prop, but not " + "both). Decide between using a controlled or uncontrolled select " + "element and remove one of these props. More info: " + "https://fb.me/react-controlled-components"), 
        didWarnValueDefaultValue$1 = !0);
    },
    postMountWrapper: function(element, props) {
        var node = element;
        node.multiple = !!props.multiple;
        var value = props.value;
        null != value ? updateOptions(node, !!props.multiple, value) : null != props.defaultValue && updateOptions(node, !!props.multiple, props.defaultValue);
    },
    postUpdateWrapper: function(element, props) {
        var node = element;
        // After the initial mount, we control selected-ness manually so don't pass
        // this value down
        node._wrapperState.initialValue = void 0;
        var wasMultiple = node._wrapperState.wasMultiple;
        node._wrapperState.wasMultiple = !!props.multiple;
        var value = props.value;
        null != value ? updateOptions(node, !!props.multiple, value) : wasMultiple !== !!props.multiple && (// For simplicity, reapply `defaultValue` if `multiple` is toggled.
        null != props.defaultValue ? updateOptions(node, !!props.multiple, props.defaultValue) : // Revert the select back to its default unselected state.
        updateOptions(node, !!props.multiple, props.multiple ? [] : ""));
    },
    restoreControlledState: function(element, props) {
        var node = element, value = props.value;
        null != value && updateOptions(node, !!props.multiple, value);
    }
}, ReactDOMFiberSelect = ReactDOMSelect, ReactDOMTextarea = {
    getHostProps: function(element, props) {
        var node = element;
        return invariant(null == props.dangerouslySetInnerHTML, "`dangerouslySetInnerHTML` does not make sense on <textarea>."), 
        Object.assign({}, props, {
            value: void 0,
            defaultValue: void 0,
            children: "" + node._wrapperState.initialValue
        });
    },
    initWrapperState: function(element, props) {
        var node = element, value = props.value, initialValue = value;
        // Only bother fetching default value if we're going to use it
        if (null == value) {
            var defaultValue = props.defaultValue, children = props.children;
            null != children && (invariant(null == defaultValue, "If you supply `defaultValue` on a <textarea>, do not pass children."), 
            Array.isArray(children) && (invariant(children.length <= 1, "<textarea> can only have at most one child."), 
            children = children[0]), defaultValue = "" + children), null == defaultValue && (defaultValue = ""), 
            initialValue = defaultValue;
        }
        node._wrapperState = {
            initialValue: "" + initialValue
        };
    },
    updateWrapper: function(element, props) {
        var node = element, value = props.value;
        if (null != value) {
            // Cast `value` to a string to ensure the value is set correctly. While
            // browsers typically do this as necessary, jsdom doesn't.
            var newValue = "" + value;
            // To avoid side effects (such as losing text selection), only set value if changed
            newValue !== node.value && (node.value = newValue), null == props.defaultValue && (node.defaultValue = newValue);
        }
        null != props.defaultValue && (node.defaultValue = props.defaultValue);
    },
    postMountWrapper: function(element, props) {
        var node = element, textContent = node.textContent;
        // Only set node.value if textContent is equal to the expected
        // initial value. In IE10/IE11 there is a bug where the placeholder attribute
        // will populate textContent as well.
        // https://developer.microsoft.com/microsoft-edge/platform/issues/101525/
        textContent === node._wrapperState.initialValue && (node.value = textContent);
    },
    restoreControlledState: function(element, props) {
        // DOM component is still mounted; update
        ReactDOMTextarea.updateWrapper(element, props);
    }
}, ReactDOMFiberTextarea = ReactDOMTextarea, omittedCloseTags = {
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
}, omittedCloseTags_1), voidElementTags_1 = voidElementTags, HTML$1 = "__html";

function getDeclarationErrorAddendum$1(getCurrentOwnerName) {
    return "";
}

function assertValidProps(tag, props, getCurrentOwnerName) {
    props && (// Note the use of `==` which checks for null or undefined.
    voidElementTags_1[tag] && invariant(null == props.children && null == props.dangerouslySetInnerHTML, "%s is a void element tag and must neither have `children` nor " + "use `dangerouslySetInnerHTML`.%s", tag, getDeclarationErrorAddendum$1(getCurrentOwnerName)), 
    null != props.dangerouslySetInnerHTML && (invariant(null == props.children, "Can only set one of `children` or `props.dangerouslySetInnerHTML`."), 
    invariant("object" == typeof props.dangerouslySetInnerHTML && HTML$1 in props.dangerouslySetInnerHTML, "`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. " + "Please visit https://fb.me/react-invariant-dangerously-set-inner-html " + "for more information.")), 
    invariant(null == props.style || "object" == typeof props.style, "The `style` prop expects a mapping from style properties to values, " + "not a string. For example, style={{marginRight: spacing + 'em'}} when " + "using JSX.%s", getDeclarationErrorAddendum$1(getCurrentOwnerName)));
}

var assertValidProps_1 = assertValidProps;

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
}, inputValueTracking_1 = inputValueTracking;

/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isCustomComponent
 */
function isCustomComponent(tagName, props) {
    return tagName.indexOf("-") >= 0 || null != props.is;
}

var isCustomComponent_1 = isCustomComponent, createMicrosoftUnsafeLocalFunction = function(func) {
    return "undefined" != typeof MSApp && MSApp.execUnsafeLocalFunction ? function(arg0, arg1, arg2, arg3) {
        MSApp.execUnsafeLocalFunction(function() {
            return func(arg0, arg1, arg2, arg3);
        });
    } : func;
}, createMicrosoftUnsafeLocalFunction_1 = createMicrosoftUnsafeLocalFunction, reusableSVGContainer, setInnerHTML = createMicrosoftUnsafeLocalFunction_1(function(node, html) {
    // IE does not have innerHTML for SVG nodes, so instead we inject the
    // new markup in a temp node and then move the child nodes across into
    // the target node
    if (node.namespaceURI !== DOMNamespaces_1.svg || "innerHTML" in node) node.innerHTML = html; else {
        reusableSVGContainer = reusableSVGContainer || document.createElement("div"), reusableSVGContainer.innerHTML = "<svg>" + html + "</svg>";
        for (var svgNode = reusableSVGContainer.firstChild; svgNode.firstChild; ) node.appendChild(svgNode.firstChild);
    }
}), setInnerHTML_1 = setInnerHTML, TEXT_NODE$2 = HTMLNodeType_1.TEXT_NODE, setTextContent = function(node, text) {
    if (text) {
        var firstChild = node.firstChild;
        if (firstChild && firstChild === node.lastChild && firstChild.nodeType === TEXT_NODE$2) return void (firstChild.nodeValue = text);
    }
    node.textContent = text;
};

ExecutionEnvironment.canUseDOM && ("textContent" in document.documentElement || (setTextContent = function(node, text) {
    if (node.nodeType === TEXT_NODE$2) return void (node.nodeValue = text);
    setInnerHTML_1(node, escapeTextContentForBrowser_1(text));
}));

var setTextContent_1 = setTextContent, getCurrentFiberOwnerName = ReactDebugCurrentFiber_1.getCurrentFiberOwnerName, DOCUMENT_NODE$1 = HTMLNodeType_1.DOCUMENT_NODE, DOCUMENT_FRAGMENT_NODE$1 = HTMLNodeType_1.DOCUMENT_FRAGMENT_NODE, listenTo = ReactBrowserEventEmitter_1.listenTo, registrationNameModules = EventPluginRegistry_1.registrationNameModules, DANGEROUSLY_SET_INNER_HTML = "dangerouslySetInnerHTML", SUPPRESS_CONTENT_EDITABLE_WARNING = "suppressContentEditableWarning", CHILDREN = "children", STYLE = "style", HTML = "__html", HTML_NAMESPACE = DOMNamespaces_1.html, SVG_NAMESPACE = DOMNamespaces_1.svg, MATH_NAMESPACE = DOMNamespaces_1.mathml;

function ensureListeningTo(rootContainerElement, registrationName) {
    var isDocumentOrFragment = rootContainerElement.nodeType === DOCUMENT_NODE$1 || rootContainerElement.nodeType === DOCUMENT_FRAGMENT_NODE$1, doc = isDocumentOrFragment ? rootContainerElement : rootContainerElement.ownerDocument;
    listenTo(registrationName, doc);
}

// There are so many media events, it makes sense to just
// maintain a list rather than create a `trapBubbledEvent` for each
var mediaEvents = {
    topAbort: "abort",
    topCanPlay: "canplay",
    topCanPlayThrough: "canplaythrough",
    topDurationChange: "durationchange",
    topEmptied: "emptied",
    topEncrypted: "encrypted",
    topEnded: "ended",
    topError: "error",
    topLoadedData: "loadeddata",
    topLoadedMetadata: "loadedmetadata",
    topLoadStart: "loadstart",
    topPause: "pause",
    topPlay: "play",
    topPlaying: "playing",
    topProgress: "progress",
    topRateChange: "ratechange",
    topSeeked: "seeked",
    topSeeking: "seeking",
    topStalled: "stalled",
    topSuspend: "suspend",
    topTimeUpdate: "timeupdate",
    topVolumeChange: "volumechange",
    topWaiting: "waiting"
};

function trapClickOnNonInteractiveElement(node) {
    // Mobile Safari does not fire properly bubble click events on
    // non-interactive elements, which means delegated click listeners do not
    // fire. The workaround for this bug involves attaching an empty click
    // listener on the target node.
    // http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
    // Just set it using the onclick property so that we don't have to manage any
    // bookkeeping for it. Not sure if we need to clear it when the listener is
    // removed.
    // TODO: Only do this for the relevant Safaris maybe?
    node.onclick = emptyFunction;
}

function trapBubbledEventsLocal(node, tag) {
    // If a component renders to null or if another component fatals and causes
    // the state of the tree to be corrupted, `node` here can be null.
    // TODO: Make sure that we check isMounted before firing any of these events.
    // TODO: Inline these below since we're calling this from an equivalent
    // switch statement.
    switch (tag) {
      case "iframe":
      case "object":
        ReactBrowserEventEmitter_1.trapBubbledEvent("topLoad", "load", node);
        break;

      case "video":
      case "audio":
        // Create listener for each media event
        for (var event in mediaEvents) mediaEvents.hasOwnProperty(event) && ReactBrowserEventEmitter_1.trapBubbledEvent(event, mediaEvents[event], node);
        break;

      case "source":
        ReactBrowserEventEmitter_1.trapBubbledEvent("topError", "error", node);
        break;

      case "img":
      case "image":
        ReactBrowserEventEmitter_1.trapBubbledEvent("topError", "error", node), ReactBrowserEventEmitter_1.trapBubbledEvent("topLoad", "load", node);
        break;

      case "form":
        ReactBrowserEventEmitter_1.trapBubbledEvent("topReset", "reset", node), ReactBrowserEventEmitter_1.trapBubbledEvent("topSubmit", "submit", node);
        break;

      case "input":
      case "select":
      case "textarea":
        ReactBrowserEventEmitter_1.trapBubbledEvent("topInvalid", "invalid", node);
        break;

      case "details":
        ReactBrowserEventEmitter_1.trapBubbledEvent("topToggle", "toggle", node);
    }
}

function setInitialDOMProperties(domElement, rootContainerElement, nextProps, isCustomComponentTag) {
    for (var propKey in nextProps) if (nextProps.hasOwnProperty(propKey)) {
        var nextProp = nextProps[propKey];
        if (propKey === STYLE) CSSPropertyOperations_1.setValueForStyles(domElement, nextProp); else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
            var nextHtml = nextProp ? nextProp[HTML] : void 0;
            null != nextHtml && setInnerHTML_1(domElement, nextHtml);
        } else propKey === CHILDREN ? "string" == typeof nextProp ? setTextContent_1(domElement, nextProp) : "number" == typeof nextProp && setTextContent_1(domElement, "" + nextProp) : propKey === SUPPRESS_CONTENT_EDITABLE_WARNING || (registrationNameModules.hasOwnProperty(propKey) ? nextProp && ensureListeningTo(rootContainerElement, propKey) : isCustomComponentTag ? DOMPropertyOperations_1.setValueForAttribute(domElement, propKey, nextProp) : (DOMProperty_1.properties[propKey] || DOMProperty_1.isCustomAttribute(propKey)) && null != nextProp && DOMPropertyOperations_1.setValueForProperty(domElement, propKey, nextProp));
    }
}

function updateDOMProperties(domElement, updatePayload, wasCustomComponentTag, isCustomComponentTag) {
    // TODO: Handle wasCustomComponentTag
    for (var i = 0; i < updatePayload.length; i += 2) {
        var propKey = updatePayload[i], propValue = updatePayload[i + 1];
        propKey === STYLE ? CSSPropertyOperations_1.setValueForStyles(domElement, propValue) : propKey === DANGEROUSLY_SET_INNER_HTML ? setInnerHTML_1(domElement, propValue) : propKey === CHILDREN ? setTextContent_1(domElement, propValue) : isCustomComponentTag ? null != propValue ? DOMPropertyOperations_1.setValueForAttribute(domElement, propKey, propValue) : DOMPropertyOperations_1.deleteValueForAttribute(domElement, propKey) : (DOMProperty_1.properties[propKey] || DOMProperty_1.isCustomAttribute(propKey)) && (// If we're updating to null or undefined, we should remove the property
        // from the DOM node instead of inadvertently setting to a string. This
        // brings us in line with the same behavior we have on initial render.
        null != propValue ? DOMPropertyOperations_1.setValueForProperty(domElement, propKey, propValue) : DOMPropertyOperations_1.deleteValueForProperty(domElement, propKey));
    }
}

// Assumes there is no parent namespace.
function getIntrinsicNamespace(type) {
    switch (type) {
      case "svg":
        return SVG_NAMESPACE;

      case "math":
        return MATH_NAMESPACE;

      default:
        return HTML_NAMESPACE;
    }
}

var ReactDOMFiberComponent = {
    getChildNamespace: function(parentNamespace, type) {
        return null == parentNamespace || parentNamespace === HTML_NAMESPACE ? getIntrinsicNamespace(type) : parentNamespace === SVG_NAMESPACE && "foreignObject" === type ? HTML_NAMESPACE : parentNamespace;
    },
    createElement: function(type, props, rootContainerElement, parentNamespace) {
        // We create tags in the namespace of their parent container, except HTML
        var domElement, ownerDocument = rootContainerElement.nodeType === DOCUMENT_NODE$1 ? rootContainerElement : rootContainerElement.ownerDocument, namespaceURI = parentNamespace;
        if (namespaceURI === HTML_NAMESPACE && (namespaceURI = getIntrinsicNamespace(type)), 
        namespaceURI === HTML_NAMESPACE) if ("script" === type) {
            // Create the script via .innerHTML so its "parser-inserted" flag is
            // set to true and it does not execute
            var div = ownerDocument.createElement("div");
            div.innerHTML = "<script><" + "/script>";
            // eslint-disable-line
            // This is guaranteed to yield a script element.
            var firstChild = div.firstChild;
            domElement = div.removeChild(firstChild);
        } else // $FlowIssue `createElement` should be updated for Web Components
        domElement = props.is ? ownerDocument.createElement(type, {
            is: props.is
        }) : ownerDocument.createElement(type); else domElement = ownerDocument.createElementNS(namespaceURI, type);
        return domElement;
    },
    setInitialProperties: function(domElement, tag, rawProps, rootContainerElement) {
        var props, isCustomComponentTag = isCustomComponent_1(tag, rawProps);
        switch (tag) {
          case "audio":
          case "form":
          case "iframe":
          case "img":
          case "image":
          case "link":
          case "object":
          case "source":
          case "video":
          case "details":
            trapBubbledEventsLocal(domElement, tag), props = rawProps;
            break;

          case "input":
            ReactDOMFiberInput.initWrapperState(domElement, rawProps), props = ReactDOMFiberInput.getHostProps(domElement, rawProps), 
            trapBubbledEventsLocal(domElement, tag), // For controlled components we always need to ensure we're listening
            // to onChange. Even if there is no listener.
            ensureListeningTo(rootContainerElement, "onChange");
            break;

          case "option":
            ReactDOMFiberOption.validateProps(domElement, rawProps), props = ReactDOMFiberOption.getHostProps(domElement, rawProps);
            break;

          case "select":
            ReactDOMFiberSelect.initWrapperState(domElement, rawProps), props = ReactDOMFiberSelect.getHostProps(domElement, rawProps), 
            trapBubbledEventsLocal(domElement, tag), // For controlled components we always need to ensure we're listening
            // to onChange. Even if there is no listener.
            ensureListeningTo(rootContainerElement, "onChange");
            break;

          case "textarea":
            ReactDOMFiberTextarea.initWrapperState(domElement, rawProps), props = ReactDOMFiberTextarea.getHostProps(domElement, rawProps), 
            trapBubbledEventsLocal(domElement, tag), // For controlled components we always need to ensure we're listening
            // to onChange. Even if there is no listener.
            ensureListeningTo(rootContainerElement, "onChange");
            break;

          default:
            props = rawProps;
        }
        switch (assertValidProps_1(tag, props, getCurrentFiberOwnerName), setInitialDOMProperties(domElement, rootContainerElement, props, isCustomComponentTag), 
        tag) {
          case "input":
            // TODO: Make sure we check if this is still unmounted or do any clean
            // up necessary since we never stop tracking anymore.
            inputValueTracking_1.trackNode(domElement), ReactDOMFiberInput.postMountWrapper(domElement, rawProps);
            break;

          case "textarea":
            // TODO: Make sure we check if this is still unmounted or do any clean
            // up necessary since we never stop tracking anymore.
            inputValueTracking_1.trackNode(domElement), ReactDOMFiberTextarea.postMountWrapper(domElement, rawProps);
            break;

          case "option":
            ReactDOMFiberOption.postMountWrapper(domElement, rawProps);
            break;

          case "select":
            ReactDOMFiberSelect.postMountWrapper(domElement, rawProps);
            break;

          default:
            "function" == typeof props.onClick && // TODO: This cast may not be sound for SVG, MathML or custom elements.
            trapClickOnNonInteractiveElement(domElement);
        }
    },
    // Calculate the diff between the two objects.
    diffProperties: function(domElement, tag, lastRawProps, nextRawProps, rootContainerElement) {
        var lastProps, nextProps, updatePayload = null;
        switch (tag) {
          case "input":
            lastProps = ReactDOMFiberInput.getHostProps(domElement, lastRawProps), nextProps = ReactDOMFiberInput.getHostProps(domElement, nextRawProps), 
            updatePayload = [];
            break;

          case "option":
            lastProps = ReactDOMFiberOption.getHostProps(domElement, lastRawProps), nextProps = ReactDOMFiberOption.getHostProps(domElement, nextRawProps), 
            updatePayload = [];
            break;

          case "select":
            lastProps = ReactDOMFiberSelect.getHostProps(domElement, lastRawProps), nextProps = ReactDOMFiberSelect.getHostProps(domElement, nextRawProps), 
            updatePayload = [];
            break;

          case "textarea":
            lastProps = ReactDOMFiberTextarea.getHostProps(domElement, lastRawProps), nextProps = ReactDOMFiberTextarea.getHostProps(domElement, nextRawProps), 
            updatePayload = [];
            break;

          default:
            lastProps = lastRawProps, nextProps = nextRawProps, "function" != typeof lastProps.onClick && "function" == typeof nextProps.onClick && // TODO: This cast may not be sound for SVG, MathML or custom elements.
            trapClickOnNonInteractiveElement(domElement);
        }
        assertValidProps_1(tag, nextProps, getCurrentFiberOwnerName);
        var propKey, styleName, styleUpdates = null;
        for (propKey in lastProps) if (!nextProps.hasOwnProperty(propKey) && lastProps.hasOwnProperty(propKey) && null != lastProps[propKey]) if (propKey === STYLE) {
            var lastStyle = lastProps[propKey];
            for (styleName in lastStyle) lastStyle.hasOwnProperty(styleName) && (styleUpdates || (styleUpdates = {}), 
            styleUpdates[styleName] = "");
        } else propKey === DANGEROUSLY_SET_INNER_HTML || propKey === CHILDREN || propKey === SUPPRESS_CONTENT_EDITABLE_WARNING || (registrationNameModules.hasOwnProperty(propKey) ? // This is a special case. If any listener updates we need to ensure
        // that the "current" fiber pointer gets updated so we need a commit
        // to update this element.
        updatePayload || (updatePayload = []) : // For all other deleted properties we add it to the queue. We use
        // the whitelist in the commit phase instead.
        (updatePayload = updatePayload || []).push(propKey, null));
        for (propKey in nextProps) {
            var nextProp = nextProps[propKey], lastProp = null != lastProps ? lastProps[propKey] : void 0;
            if (nextProps.hasOwnProperty(propKey) && nextProp !== lastProp && (null != nextProp || null != lastProp)) if (propKey === STYLE) if (lastProp) {
                // Unset styles on `lastProp` but not on `nextProp`.
                for (styleName in lastProp) !lastProp.hasOwnProperty(styleName) || nextProp && nextProp.hasOwnProperty(styleName) || (styleUpdates || (styleUpdates = {}), 
                styleUpdates[styleName] = "");
                // Update styles that changed since `lastProp`.
                for (styleName in nextProp) nextProp.hasOwnProperty(styleName) && lastProp[styleName] !== nextProp[styleName] && (styleUpdates || (styleUpdates = {}), 
                styleUpdates[styleName] = nextProp[styleName]);
            } else // Relies on `updateStylesByID` not mutating `styleUpdates`.
            styleUpdates || (updatePayload || (updatePayload = []), updatePayload.push(propKey, styleUpdates)), 
            styleUpdates = nextProp; else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
                var nextHtml = nextProp ? nextProp[HTML] : void 0, lastHtml = lastProp ? lastProp[HTML] : void 0;
                null != nextHtml && lastHtml !== nextHtml && (updatePayload = updatePayload || []).push(propKey, "" + nextHtml);
            } else propKey === CHILDREN ? lastProp === nextProp || "string" != typeof nextProp && "number" != typeof nextProp || (updatePayload = updatePayload || []).push(propKey, "" + nextProp) : propKey === SUPPRESS_CONTENT_EDITABLE_WARNING || (registrationNameModules.hasOwnProperty(propKey) ? (nextProp && // We eagerly listen to this even though we haven't committed yet.
            ensureListeningTo(rootContainerElement, propKey), updatePayload || lastProp === nextProp || (// This is a special case. If any listener updates we need to ensure
            // that the "current" props pointer gets updated so we need a commit
            // to update this element.
            updatePayload = [])) : // For any other property we always add it to the queue and then we
            // filter it out using the whitelist during the commit.
            (updatePayload = updatePayload || []).push(propKey, nextProp));
        }
        return styleUpdates && (updatePayload = updatePayload || []).push(STYLE, styleUpdates), 
        updatePayload;
    },
    // Apply the diff.
    updateProperties: function(domElement, updatePayload, tag, lastRawProps, nextRawProps) {
        // TODO: Ensure that an update gets scheduled if any of the special props
        // changed.
        switch (// Apply the diff.
        updateDOMProperties(domElement, updatePayload, isCustomComponent_1(tag, lastRawProps), isCustomComponent_1(tag, nextRawProps)), 
        tag) {
          case "input":
            // Update the wrapper around inputs *after* updating props. This has to
            // happen after `updateDOMProperties`. Otherwise HTML5 input validations
            // raise warnings and prevent the new value from being assigned.
            ReactDOMFiberInput.updateWrapper(domElement, nextRawProps);
            break;

          case "textarea":
            ReactDOMFiberTextarea.updateWrapper(domElement, nextRawProps);
            break;

          case "select":
            // <select> value update needs to occur after <option> children
            // reconciliation
            ReactDOMFiberSelect.postUpdateWrapper(domElement, nextRawProps);
        }
    },
    diffHydratedProperties: function(domElement, tag, rawProps, rootContainerElement) {
        switch (tag) {
          case "audio":
          case "form":
          case "iframe":
          case "img":
          case "image":
          case "link":
          case "object":
          case "source":
          case "video":
          case "details":
            trapBubbledEventsLocal(domElement, tag);
            break;

          case "input":
            ReactDOMFiberInput.initWrapperState(domElement, rawProps), trapBubbledEventsLocal(domElement, tag), 
            // For controlled components we always need to ensure we're listening
            // to onChange. Even if there is no listener.
            ensureListeningTo(rootContainerElement, "onChange");
            break;

          case "option":
            ReactDOMFiberOption.validateProps(domElement, rawProps);
            break;

          case "select":
            ReactDOMFiberSelect.initWrapperState(domElement, rawProps), trapBubbledEventsLocal(domElement, tag), 
            // For controlled components we always need to ensure we're listening
            // to onChange. Even if there is no listener.
            ensureListeningTo(rootContainerElement, "onChange");
            break;

          case "textarea":
            ReactDOMFiberTextarea.initWrapperState(domElement, rawProps), trapBubbledEventsLocal(domElement, tag), 
            // For controlled components we always need to ensure we're listening
            // to onChange. Even if there is no listener.
            ensureListeningTo(rootContainerElement, "onChange");
        }
        assertValidProps_1(tag, rawProps, getCurrentFiberOwnerName);
        var updatePayload = null;
        for (var propKey in rawProps) if (rawProps.hasOwnProperty(propKey)) {
            var nextProp = rawProps[propKey];
            propKey === CHILDREN ? // For text content children we compare against textContent. This
            // might match additional HTML that is hidden when we read it using
            // textContent. E.g. "foo" will match "f<span>oo</span>" but that still
            // satisfies our requirement. Our requirement is not to produce perfect
            // HTML and attributes. Ideally we should preserve structure but it's
            // ok not to if the visible content is still enough to indicate what
            // even listeners these nodes might be wired up to.
            // TODO: Warn if there is more than a single textNode as a child.
            // TODO: Should we use domElement.firstChild.nodeValue to compare?
            "string" == typeof nextProp ? domElement.textContent !== nextProp && (updatePayload = [ CHILDREN, nextProp ]) : "number" == typeof nextProp && domElement.textContent !== "" + nextProp && (updatePayload = [ CHILDREN, "" + nextProp ]) : registrationNameModules.hasOwnProperty(propKey) && nextProp && ensureListeningTo(rootContainerElement, propKey);
        }
        switch (tag) {
          case "input":
            // TODO: Make sure we check if this is still unmounted or do any clean
            // up necessary since we never stop tracking anymore.
            inputValueTracking_1.trackNode(domElement), ReactDOMFiberInput.postMountWrapper(domElement, rawProps);
            break;

          case "textarea":
            // TODO: Make sure we check if this is still unmounted or do any clean
            // up necessary since we never stop tracking anymore.
            inputValueTracking_1.trackNode(domElement), ReactDOMFiberTextarea.postMountWrapper(domElement, rawProps);
            break;

          case "select":
          case "option":
            // For input and textarea we current always set the value property at
            // post mount to force it to diverge from attributes. However, for
            // option and select we don't quite do the same thing and select
            // is not resilient to the DOM state changing so we don't do that here.
            // TODO: Consider not doing this for input and textarea.
            break;

          default:
            "function" == typeof rawProps.onClick && // TODO: This cast may not be sound for SVG, MathML or custom elements.
            trapClickOnNonInteractiveElement(domElement);
        }
        return updatePayload;
    },
    diffHydratedText: function(textNode, text) {
        return textNode.nodeValue !== text;
    },
    warnForDeletedHydratableElement: function(parentNode, child) {},
    warnForDeletedHydratableText: function(parentNode, child) {},
    warnForInsertedHydratedElement: function(parentNode, tag, props) {},
    warnForInsertedHydratedText: function(parentNode, text) {},
    restoreControlledState: function(domElement, tag, props) {
        switch (tag) {
          case "input":
            return void ReactDOMFiberInput.restoreControlledState(domElement, props);

          case "textarea":
            return void ReactDOMFiberTextarea.restoreControlledState(domElement, props);

          case "select":
            return void ReactDOMFiberSelect.restoreControlledState(domElement, props);
        }
    }
}, ReactDOMFiberComponent_1 = ReactDOMFiberComponent, rAF = void 0, rIC = void 0;

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
}, ARIADOMPropertyConfig = {
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
}, ARIADOMPropertyConfig_1 = ARIADOMPropertyConfig, HostComponent$2 = ReactTypeOfWork.HostComponent;

function getParent(inst) {
    if (void 0 !== inst._hostParent) return inst._hostParent;
    if ("number" == typeof inst.tag) {
        do {
            inst = inst.return;
        } while (inst && inst.tag !== HostComponent$2);
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
}, EventPropagators_1 = EventPropagators, contentKey = null;

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
}, BeforeInputEventPlugin_1 = BeforeInputEventPlugin, supportedInputTypes = {
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
}, HTMLDOMPropertyConfig_1 = HTMLDOMPropertyConfig, NS = {
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

var SVGDOMPropertyConfig_1 = SVGDOMPropertyConfig, TEXT_NODE$3 = HTMLNodeType_1.TEXT_NODE;

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
        if (node.nodeType === TEXT_NODE$3) {
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
}, ReactDOMSelection_1 = ReactDOMSelection, ELEMENT_NODE$2 = HTMLNodeType_1.ELEMENT_NODE;

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
            var ancestors = [], ancestor = priorFocusedElem; ancestor = ancestor.parentNode; ) ancestor.nodeType === ELEMENT_NODE$2 && ancestors.push({
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
}, ReactInputSelection_1 = ReactInputSelection, DOCUMENT_NODE$2 = HTMLNodeType_1.DOCUMENT_NODE, skipSelectionChangeEvent = ExecutionEnvironment.canUseDOM && "documentMode" in document && document.documentMode <= 11, eventTypes$3 = {
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
        var doc = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : nativeEventTarget.nodeType === DOCUMENT_NODE$2 ? nativeEventTarget : nativeEventTarget.ownerDocument;
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
}, CallbackEffect = ReactTypeOfSideEffect.Callback, NoWork = ReactPriorityLevel.NoWork, SynchronousPriority = ReactPriorityLevel.SynchronousPriority, TaskPriority = ReactPriorityLevel.TaskPriority, ClassComponent$1 = ReactTypeOfWork.ClassComponent, HostRoot$2 = ReactTypeOfWork.HostRoot;

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
    return null === updateQueue ? NoWork : fiber.tag !== ClassComponent$1 && fiber.tag !== HostRoot$2 ? NoWork : null !== updateQueue.first ? updateQueue.first.priorityLevel : NoWork;
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

function beginUpdateQueue(current, workInProgress, queue, instance, prevState, props, priorityLevel) {
    if (null !== current && current.updateQueue === queue) {
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
}, isFiberMounted$1 = ReactFiberTreeReflection.isFiberMounted, ClassComponent$2 = ReactTypeOfWork.ClassComponent, HostRoot$3 = ReactTypeOfWork.HostRoot, createCursor = ReactFiberStack.createCursor, pop = ReactFiberStack.pop, push = ReactFiberStack.push, contextStackCursor = createCursor(emptyObject), didPerformWorkStackCursor = createCursor(!1), previousContext = emptyObject;

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
    return fiber.tag === ClassComponent$2 && null != fiber.type.contextTypes;
}

var isContextConsumer_1 = isContextConsumer;

function isContextProvider$1(fiber) {
    return fiber.tag === ClassComponent$2 && null != fiber.type.childContextTypes;
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
    invariant(isFiberMounted$1(fiber) && fiber.tag === ClassComponent$2, "Expected subtree parent to be a mounted class component");
    for (var node = fiber; node.tag !== HostRoot$3; ) {
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
}, IndeterminateComponent = ReactTypeOfWork.IndeterminateComponent, ClassComponent$3 = ReactTypeOfWork.ClassComponent, HostRoot$4 = ReactTypeOfWork.HostRoot, HostComponent$4 = ReactTypeOfWork.HostComponent, HostText$2 = ReactTypeOfWork.HostText, HostPortal = ReactTypeOfWork.HostPortal, CoroutineComponent = ReactTypeOfWork.CoroutineComponent, YieldComponent = ReactTypeOfWork.YieldComponent, Fragment = ReactTypeOfWork.Fragment, NoWork$1 = ReactPriorityLevel.NoWork, NoContext = ReactTypeOfInternalContext.NoContext, NoEffect$1 = ReactTypeOfSideEffect.NoEffect, createFiber = function(tag, key, internalContextTag) {
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
var createWorkInProgress = function(current, renderPriority) {
    var workInProgress = current.alternate;
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
    return null === workInProgress ? (workInProgress = createFiber(current.tag, current.key, current.internalContextTag), 
    workInProgress.type = current.type, workInProgress.stateNode = current.stateNode, 
    workInProgress.alternate = current, current.alternate = workInProgress) : (workInProgress.effectTag = NoWork$1, 
    workInProgress.nextEffect = null, workInProgress.firstEffect = null, workInProgress.lastEffect = null), 
    workInProgress.pendingWorkPriority = renderPriority, workInProgress.child = current.child, 
    workInProgress.memoizedProps = current.memoizedProps, workInProgress.memoizedState = current.memoizedState, 
    workInProgress.updateQueue = current.updateQueue, workInProgress.sibling = current.sibling, 
    workInProgress.index = current.index, workInProgress.ref = current.ref, workInProgress;
}, createHostRootFiber$1 = function() {
    return createFiber(HostRoot$4, null, NoContext);
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
    var fiber = createFiber(HostText$2, null, internalContextTag);
    return fiber.pendingProps = content, fiber.pendingWorkPriority = priorityLevel, 
    fiber;
};

function createFiberFromElementType(type, key, internalContextTag, debugOwner) {
    var fiber = void 0;
    if ("function" == typeof type) fiber = shouldConstruct(type) ? createFiber(ClassComponent$3, key, internalContextTag) : createFiber(IndeterminateComponent, key, internalContextTag), 
    fiber.type = type; else if ("string" == typeof type) fiber = createFiber(HostComponent$4, key, internalContextTag), 
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
    var fiber = createFiber(HostComponent$4, null, NoContext);
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
}, IndeterminateComponent$1 = ReactTypeOfWork.IndeterminateComponent, FunctionalComponent = ReactTypeOfWork.FunctionalComponent, ClassComponent$5 = ReactTypeOfWork.ClassComponent, HostComponent$6 = ReactTypeOfWork.HostComponent;

function describeComponentFrame(name, source, ownerName) {
    return "\n    in " + (name || "Unknown") + (source ? " (at " + source.fileName.replace(/^.*[\\\/]/, "") + ":" + source.lineNumber + ")" : ownerName ? " (created by " + ownerName + ")" : "");
}

function describeFiber(fiber) {
    switch (fiber.tag) {
      case IndeterminateComponent$1:
      case FunctionalComponent:
      case ClassComponent$5:
      case HostComponent$6:
        var owner = fiber._debugOwner, source = fiber._debugSource, name = getComponentName_1(fiber), ownerName = null;
        return owner && (ownerName = getComponentName_1(owner)), describeComponentFrame(name, source, ownerName);

      default:
        return "";
    }
}

// This function can only be called with a work-in-progress fiber and
// only during begin or complete phase. Do not call it under any other
// circumstances.
function getStackAddendumByWorkInProgressFiber$2(workInProgress) {
    var info = "", node = workInProgress;
    do {
        info += describeFiber(node), // Otherwise this return pointer might point to the wrong tree:
        node = node.return;
    } while (node);
    return info;
}

var ReactFiberComponentTreeHook = {
    getStackAddendumByWorkInProgressFiber: getStackAddendumByWorkInProgressFiber$2,
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

var injection$1 = {
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
    injection: injection$1,
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
}, REACT_COROUTINE_TYPE = ReactCoroutine.REACT_COROUTINE_TYPE, REACT_YIELD_TYPE = ReactCoroutine.REACT_YIELD_TYPE, REACT_PORTAL_TYPE = ReactPortal.REACT_PORTAL_TYPE, ReactFeatureFlags$2 = require("ReactFeatureFlags"), createWorkInProgress$2 = ReactFiber.createWorkInProgress, createFiberFromElement$1 = ReactFiber.createFiberFromElement, createFiberFromFragment$1 = ReactFiber.createFiberFromFragment, createFiberFromText$1 = ReactFiber.createFiberFromText, createFiberFromCoroutine$1 = ReactFiber.createFiberFromCoroutine, createFiberFromYield$1 = ReactFiber.createFiberFromYield, createFiberFromPortal$1 = ReactFiber.createFiberFromPortal, isArray = Array.isArray, FunctionalComponent$2 = ReactTypeOfWork.FunctionalComponent, ClassComponent$7 = ReactTypeOfWork.ClassComponent, HostText$4 = ReactTypeOfWork.HostText, HostPortal$3 = ReactTypeOfWork.HostPortal, CoroutineComponent$2 = ReactTypeOfWork.CoroutineComponent, YieldComponent$2 = ReactTypeOfWork.YieldComponent, Fragment$2 = ReactTypeOfWork.Fragment, NoEffect$2 = ReactTypeOfSideEffect.NoEffect, Placement$3 = ReactTypeOfSideEffect.Placement, Deletion$1 = ReactTypeOfSideEffect.Deletion, ITERATOR_SYMBOL = "function" == typeof Symbol && Symbol.iterator, FAUX_ITERATOR_SYMBOL = "@@iterator", REACT_ELEMENT_TYPE = "function" == typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103;

function getIteratorFn(maybeIterable) {
    if (null === maybeIterable || void 0 === maybeIterable) return null;
    var iteratorFn = ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
    return "function" == typeof iteratorFn ? iteratorFn : null;
}

function coerceRef(current, element) {
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
        if (null !== current && null !== current.ref && current.ref._stringRef === stringRef) return current.ref;
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
        var current = newFiber.alternate;
        if (null !== current) {
            var oldIndex = current.index;
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
    function updateTextNode(returnFiber, current, textContent, priority) {
        if (null === current || current.tag !== HostText$4) {
            // Insert
            var created = createFiberFromText$1(textContent, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Update
        var existing = useFiber(current, priority);
        return existing.pendingProps = textContent, existing.return = returnFiber, existing;
    }
    function updateElement(returnFiber, current, element, priority) {
        if (null === current || current.type !== element.type) {
            // Insert
            var created = createFiberFromElement$1(element, returnFiber.internalContextTag, priority);
            return created.ref = coerceRef(current, element), created.return = returnFiber, 
            created;
        }
        // Move based on index
        var existing = useFiber(current, priority);
        return existing.ref = coerceRef(current, element), existing.pendingProps = element.props, 
        existing.return = returnFiber, existing;
    }
    function updateCoroutine(returnFiber, current, coroutine, priority) {
        // TODO: Should this also compare handler to determine whether to reuse?
        if (null === current || current.tag !== CoroutineComponent$2) {
            // Insert
            var created = createFiberFromCoroutine$1(coroutine, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Move based on index
        var existing = useFiber(current, priority);
        return existing.pendingProps = coroutine, existing.return = returnFiber, existing;
    }
    function updateYield(returnFiber, current, yieldNode, priority) {
        if (null === current || current.tag !== YieldComponent$2) {
            // Insert
            var created = createFiberFromYield$1(yieldNode, returnFiber.internalContextTag, priority);
            return created.type = yieldNode.value, created.return = returnFiber, created;
        }
        // Move based on index
        var existing = useFiber(current, priority);
        return existing.type = yieldNode.value, existing.return = returnFiber, existing;
    }
    function updatePortal(returnFiber, current, portal, priority) {
        if (null === current || current.tag !== HostPortal$3 || current.stateNode.containerInfo !== portal.containerInfo || current.stateNode.implementation !== portal.implementation) {
            // Insert
            var created = createFiberFromPortal$1(portal, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Update
        var existing = useFiber(current, priority);
        return existing.pendingProps = portal.children || [], existing.return = returnFiber, 
        existing;
    }
    function updateFragment(returnFiber, current, fragment, priority) {
        if (null === current || current.tag !== Fragment$2) {
            // Insert
            var created = createFiberFromFragment$1(fragment, returnFiber.internalContextTag, priority);
            return created.return = returnFiber, created;
        }
        // Update
        var existing = useFiber(current, priority);
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
        if (null !== currentFirstChild && currentFirstChild.tag === HostText$4) {
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
        var disableNewFiberFeatures = ReactFeatureFlags$2.disableNewFiberFeatures, isObject = "object" == typeof newChild && null !== newChild;
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

var reconcileChildFibers$1 = ChildReconciler(!0, !0), reconcileChildFibersInPlace$1 = ChildReconciler(!1, !0), mountChildFibersInPlace$1 = ChildReconciler(!1, !1), cloneChildFibers$1 = function(current, workInProgress, renderPriority) {
    if (invariant(null === current || workInProgress.child === current.child, "Resuming work not yet implemented."), 
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
}, Update$1 = ReactTypeOfSideEffect.Update, ReactFeatureFlags$3 = require("ReactFeatureFlags"), AsyncUpdates$1 = ReactTypeOfInternalContext.AsyncUpdates, cacheContext$1 = ReactFiberContext.cacheContext, getMaskedContext$2 = ReactFiberContext.getMaskedContext, getUnmaskedContext$2 = ReactFiberContext.getUnmaskedContext, isContextConsumer$1 = ReactFiberContext.isContextConsumer, addUpdate$1 = ReactFiberUpdateQueue.addUpdate, addReplaceUpdate$1 = ReactFiberUpdateQueue.addReplaceUpdate, addForceUpdate$1 = ReactFiberUpdateQueue.addForceUpdate, beginUpdateQueue$2 = ReactFiberUpdateQueue.beginUpdateQueue, _require5$1 = ReactFiberContext, hasContextChanged$2 = _require5$1.hasContextChanged, isMounted$1 = ReactFiberTreeReflection.isMounted, ReactFiberClassComponent = function(scheduleUpdate, getPriorityContext, memoizeProps, memoizeState) {
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
        var current = workInProgress.alternate, instance = workInProgress.stateNode, state = instance.state || null, props = workInProgress.pendingProps;
        invariant(props, "There must be pending props for an initial mount. This error is " + "likely caused by a bug in React. Please file an issue.");
        var unmaskedContext = getUnmaskedContext$2(workInProgress);
        if (instance.props = props, instance.state = state, instance.refs = emptyObject, 
        instance.context = getMaskedContext$2(workInProgress, unmaskedContext), ReactFeatureFlags$3.enableAsyncSubtreeAPI && null != workInProgress.type && !0 === workInProgress.type.unstable_asyncUpdates && (workInProgress.internalContextTag |= AsyncUpdates$1), 
        "function" == typeof instance.componentWillMount) {
            callComponentWillMount(workInProgress, instance);
            // If we had additional state updates during this life-cycle, let's
            // process them now.
            var updateQueue = workInProgress.updateQueue;
            null !== updateQueue && (instance.state = beginUpdateQueue$2(current, workInProgress, updateQueue, instance, state, props, priorityLevel));
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
    function updateClassInstance(current, workInProgress, priorityLevel) {
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
        if (newState = null !== workInProgress.updateQueue ? beginUpdateQueue$2(current, workInProgress, workInProgress.updateQueue, instance, oldState, newProps, priorityLevel) : oldState, 
        !(oldProps !== newProps || oldState !== newState || hasContextChanged$2() || null !== workInProgress.updateQueue && workInProgress.updateQueue.hasForceUpdate)) // If an update was already in progress, we should schedule an Update
        // effect even though we're bailing out, so that cWU/cDU are called.
        return "function" == typeof instance.componentDidUpdate && (oldProps === current.memoizedProps && oldState === current.memoizedState || (workInProgress.effectTag |= Update$1)), 
        !1;
        var shouldUpdate = checkShouldComponentUpdate(workInProgress, oldProps, newProps, oldState, newState, newContext);
        // If an update was already in progress, we should schedule an Update
        // effect even though we're bailing out, so that cWU/cDU are called.
        // If shouldComponentUpdate returned false, we should still update the
        // memoized props/state to indicate that this work can be reused.
        // Update the existing instance's state, props, and context pointers even
        // if shouldComponentUpdate returns false.
        return shouldUpdate ? ("function" == typeof instance.componentWillUpdate && instance.componentWillUpdate(newProps, newState, newContext), 
        "function" == typeof instance.componentDidUpdate && (workInProgress.effectTag |= Update$1)) : ("function" == typeof instance.componentDidUpdate && (oldProps === current.memoizedProps && oldState === current.memoizedState || (workInProgress.effectTag |= Update$1)), 
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
}, mountChildFibersInPlace = ReactChildFiber.mountChildFibersInPlace, reconcileChildFibers = ReactChildFiber.reconcileChildFibers, reconcileChildFibersInPlace = ReactChildFiber.reconcileChildFibersInPlace, cloneChildFibers = ReactChildFiber.cloneChildFibers, beginUpdateQueue$1 = ReactFiberUpdateQueue.beginUpdateQueue, getMaskedContext$1 = ReactFiberContext.getMaskedContext, getUnmaskedContext$1 = ReactFiberContext.getUnmaskedContext, hasContextChanged$1 = ReactFiberContext.hasContextChanged, pushContextProvider$1 = ReactFiberContext.pushContextProvider, pushTopLevelContextObject$1 = ReactFiberContext.pushTopLevelContextObject, invalidateContextProvider$1 = ReactFiberContext.invalidateContextProvider, IndeterminateComponent$2 = ReactTypeOfWork.IndeterminateComponent, FunctionalComponent$1 = ReactTypeOfWork.FunctionalComponent, ClassComponent$6 = ReactTypeOfWork.ClassComponent, HostRoot$6 = ReactTypeOfWork.HostRoot, HostComponent$7 = ReactTypeOfWork.HostComponent, HostText$3 = ReactTypeOfWork.HostText, HostPortal$2 = ReactTypeOfWork.HostPortal, CoroutineComponent$1 = ReactTypeOfWork.CoroutineComponent, CoroutineHandlerPhase = ReactTypeOfWork.CoroutineHandlerPhase, YieldComponent$1 = ReactTypeOfWork.YieldComponent, Fragment$1 = ReactTypeOfWork.Fragment, NoWork$3 = ReactPriorityLevel.NoWork, OffscreenPriority$1 = ReactPriorityLevel.OffscreenPriority, PerformedWork$1 = ReactTypeOfSideEffect.PerformedWork, Placement$2 = ReactTypeOfSideEffect.Placement, ContentReset$1 = ReactTypeOfSideEffect.ContentReset, Err$1 = ReactTypeOfSideEffect.Err, Ref$1 = ReactTypeOfSideEffect.Ref, ReactCurrentOwner$2 = ReactGlobalSharedState_1.ReactCurrentOwner, ReactFiberBeginWork = function(config, hostContext, hydrationContext, scheduleUpdate, getPriorityContext) {
    var shouldSetTextContent = config.shouldSetTextContent, useSyncScheduling = config.useSyncScheduling, shouldDeprioritizeSubtree = config.shouldDeprioritizeSubtree, pushHostContext = hostContext.pushHostContext, pushHostContainer = hostContext.pushHostContainer, enterHydrationState = hydrationContext.enterHydrationState, resetHydrationState = hydrationContext.resetHydrationState, tryToClaimNextHydratableInstance = hydrationContext.tryToClaimNextHydratableInstance, _ReactFiberClassCompo = ReactFiberClassComponent(scheduleUpdate, getPriorityContext, memoizeProps, memoizeState), adoptClassInstance = _ReactFiberClassCompo.adoptClassInstance, constructClassInstance = _ReactFiberClassCompo.constructClassInstance, mountClassInstance = _ReactFiberClassCompo.mountClassInstance, updateClassInstance = _ReactFiberClassCompo.updateClassInstance;
    function reconcileChildren(current, workInProgress, nextChildren) {
        reconcileChildrenAtPriority(current, workInProgress, nextChildren, workInProgress.pendingWorkPriority);
    }
    function reconcileChildrenAtPriority(current, workInProgress, nextChildren, priorityLevel) {
        null === current ? // If this is a fresh new component that hasn't been rendered yet, we
        // won't update its child set by applying minimal side-effects. Instead,
        // we will add them all to the child before it gets rendered. That means
        // we can optimize this reconciliation pass by not tracking side-effects.
        workInProgress.child = mountChildFibersInPlace(workInProgress, workInProgress.child, nextChildren, priorityLevel) : current.child === workInProgress.child ? // If the current child is the same as the work in progress, it means that
        // we haven't yet started any work on these children. Therefore, we use
        // the clone algorithm to create a copy of all the current children.
        // If we had any progressed work already, that is invalid at this point so
        // let's throw it out.
        workInProgress.child = reconcileChildFibers(workInProgress, workInProgress.child, nextChildren, priorityLevel) : // If, on the other hand, it is already using a clone, that means we've
        // already begun some work on this tree and we can continue where we left
        // off by reconciling against the existing children.
        workInProgress.child = reconcileChildFibersInPlace(workInProgress, workInProgress.child, nextChildren, priorityLevel);
    }
    function updateFragment(current, workInProgress) {
        var nextChildren = workInProgress.pendingProps;
        if (hasContextChanged$1()) // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextChildren && (nextChildren = workInProgress.memoizedProps); else if (null === nextChildren || workInProgress.memoizedProps === nextChildren) return bailoutOnAlreadyFinishedWork(current, workInProgress);
        return reconcileChildren(current, workInProgress, nextChildren), memoizeProps(workInProgress, nextChildren), 
        workInProgress.child;
    }
    function markRef(current, workInProgress) {
        var ref = workInProgress.ref;
        null === ref || current && current.ref === ref || (// Schedule a Ref effect
        workInProgress.effectTag |= Ref$1);
    }
    function updateFunctionalComponent(current, workInProgress) {
        var fn = workInProgress.type, nextProps = workInProgress.pendingProps, memoizedProps = workInProgress.memoizedProps;
        if (hasContextChanged$1()) // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextProps && (nextProps = memoizedProps); else {
            if (null === nextProps || memoizedProps === nextProps) return bailoutOnAlreadyFinishedWork(current, workInProgress);
            // TODO: Disable this before release, since it is not part of the public API
            // I use this for testing to compare the relative overhead of classes.
            if ("function" == typeof fn.shouldComponentUpdate && !fn.shouldComponentUpdate(memoizedProps, nextProps)) // Memoize props even if shouldComponentUpdate returns false
            return memoizeProps(workInProgress, nextProps), bailoutOnAlreadyFinishedWork(current, workInProgress);
        }
        var nextChildren, unmaskedContext = getUnmaskedContext$1(workInProgress), context = getMaskedContext$1(workInProgress, unmaskedContext);
        // React DevTools reads this flag.
        return nextChildren = fn(nextProps, context), workInProgress.effectTag |= PerformedWork$1, 
        reconcileChildren(current, workInProgress, nextChildren), memoizeProps(workInProgress, nextProps), 
        workInProgress.child;
    }
    function updateClassComponent(current, workInProgress, priorityLevel) {
        // Push context providers early to prevent context stack mismatches.
        // During mounting we don't know the child context yet as the instance doesn't exist.
        // We will invalidate the child context in finishClassComponent() right after rendering.
        var hasContext = pushContextProvider$1(workInProgress), shouldUpdate = void 0;
        // In the initial pass we might need to construct the instance.
        return null === current ? workInProgress.stateNode ? invariant(!1, "Resuming work not yet implemented.") : (constructClassInstance(workInProgress, workInProgress.pendingProps), 
        mountClassInstance(workInProgress, priorityLevel), shouldUpdate = !0) : shouldUpdate = updateClassInstance(current, workInProgress, priorityLevel), 
        finishClassComponent(current, workInProgress, shouldUpdate, hasContext);
    }
    function finishClassComponent(current, workInProgress, shouldUpdate, hasContext) {
        if (// Refs should update even if shouldComponentUpdate returns false
        markRef(current, workInProgress), !shouldUpdate) return bailoutOnAlreadyFinishedWork(current, workInProgress);
        var instance = workInProgress.stateNode;
        // Rerender
        ReactCurrentOwner$2.current = workInProgress;
        var nextChildren = void 0;
        // React DevTools reads this flag.
        // Memoize props and state using the values we just used to render.
        // TODO: Restructure so we never read values from the instance.
        // The context might have changed so we need to recalculate it.
        return nextChildren = instance.render(), workInProgress.effectTag |= PerformedWork$1, 
        reconcileChildren(current, workInProgress, nextChildren), memoizeState(workInProgress, instance.state), 
        memoizeProps(workInProgress, instance.props), hasContext && invalidateContextProvider$1(workInProgress), 
        workInProgress.child;
    }
    function updateHostRoot(current, workInProgress, priorityLevel) {
        var root = workInProgress.stateNode;
        root.pendingContext ? pushTopLevelContextObject$1(workInProgress, root.pendingContext, root.pendingContext !== root.context) : root.context && // Should always be set
        pushTopLevelContextObject$1(workInProgress, root.context, !1), pushHostContainer(workInProgress, root.containerInfo);
        var updateQueue = workInProgress.updateQueue;
        if (null !== updateQueue) {
            var prevState = workInProgress.memoizedState, state = beginUpdateQueue$1(current, workInProgress, updateQueue, null, prevState, null, priorityLevel);
            if (prevState === state) // If the state is the same as before, that's a bailout because we had
            // no work matching this priority.
            return resetHydrationState(), bailoutOnAlreadyFinishedWork(current, workInProgress);
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
            return null !== current && null !== current.child || !enterHydrationState(workInProgress) ? (resetHydrationState(), 
            reconcileChildren(current, workInProgress, element)) : (workInProgress.effectTag |= Placement$2, 
            workInProgress.child = mountChildFibersInPlace(workInProgress, workInProgress.child, element, priorityLevel)), 
            memoizeState(workInProgress, state), workInProgress.child;
        }
        // If there is no update queue, that's a bailout because the root has no props.
        return resetHydrationState(), bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
    function updateHostComponent(current, workInProgress, renderPriority) {
        pushHostContext(workInProgress), null === current && tryToClaimNextHydratableInstance(workInProgress);
        var type = workInProgress.type, memoizedProps = workInProgress.memoizedProps, nextProps = workInProgress.pendingProps;
        null === nextProps && (nextProps = memoizedProps, invariant(null !== nextProps, "We should always have pending or current props. This error is " + "likely caused by a bug in React. Please file an issue."));
        var prevProps = null !== current ? current.memoizedProps : null;
        if (hasContextChanged$1()) ; else if (null === nextProps || memoizedProps === nextProps) return bailoutOnAlreadyFinishedWork(current, workInProgress);
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
        markRef(current, workInProgress), renderPriority !== OffscreenPriority$1 && !useSyncScheduling && shouldDeprioritizeSubtree(type, nextProps) ? (workInProgress.pendingWorkPriority = OffscreenPriority$1, 
        null) : (reconcileChildren(current, workInProgress, nextChildren), memoizeProps(workInProgress, nextProps), 
        workInProgress.child);
    }
    function updateHostText(current, workInProgress) {
        null === current && tryToClaimNextHydratableInstance(workInProgress);
        var nextProps = workInProgress.pendingProps;
        // Nothing to do here. This is terminal. We'll do the completion step
        // immediately after.
        return null === nextProps && (nextProps = workInProgress.memoizedProps), memoizeProps(workInProgress, nextProps), 
        null;
    }
    function mountIndeterminateComponent(current, workInProgress, priorityLevel) {
        invariant(null === current, "An indeterminate component should never have mounted. This error is " + "likely caused by a bug in React. Please file an issue.");
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
            finishClassComponent(current, workInProgress, !0, hasContext);
        }
        // Proceed under the assumption that this is a functional component
        return workInProgress.tag = FunctionalComponent$1, reconcileChildren(current, workInProgress, value), 
        memoizeProps(workInProgress, props), workInProgress.child;
    }
    function updateCoroutineComponent(current, workInProgress) {
        var nextCoroutine = workInProgress.pendingProps;
        hasContextChanged$1() ? // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextCoroutine && (nextCoroutine = current && current.memoizedProps, invariant(null !== nextCoroutine, "We should always have pending or current props. This error is " + "likely caused by a bug in React. Please file an issue.")) : null !== nextCoroutine && workInProgress.memoizedProps !== nextCoroutine || (nextCoroutine = workInProgress.memoizedProps);
        var nextChildren = nextCoroutine.children, priorityLevel = workInProgress.pendingWorkPriority;
        // This doesn't take arbitrary time so we could synchronously just begin
        // eagerly do the work of workInProgress.child as an optimization.
        // The following is a fork of reconcileChildrenAtPriority but using
        // stateNode to store the child.
        return null === current ? workInProgress.stateNode = mountChildFibersInPlace(workInProgress, workInProgress.stateNode, nextChildren, priorityLevel) : current.child === workInProgress.child ? workInProgress.stateNode = reconcileChildFibers(workInProgress, workInProgress.stateNode, nextChildren, priorityLevel) : workInProgress.stateNode = reconcileChildFibersInPlace(workInProgress, workInProgress.stateNode, nextChildren, priorityLevel), 
        memoizeProps(workInProgress, nextCoroutine), workInProgress.stateNode;
    }
    function updatePortalComponent(current, workInProgress) {
        pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
        var priorityLevel = workInProgress.pendingWorkPriority, nextChildren = workInProgress.pendingProps;
        if (hasContextChanged$1()) // Normally we can bail out on props equality but if context has changed
        // we don't do the bailout and we have to reuse existing props instead.
        null === nextChildren && (nextChildren = current && current.memoizedProps, invariant(null != nextChildren, "We should always have pending or current props. This error is " + "likely caused by a bug in React. Please file an issue.")); else if (null === nextChildren || workInProgress.memoizedProps === nextChildren) return bailoutOnAlreadyFinishedWork(current, workInProgress);
        // Portals are special because we don't append the children during mount
        // but at commit. Therefore we need to track insertions which the normal
        // flow doesn't do during mount. This doesn't happen at the root because
        // the root always starts with a "current" with a null child.
        // TODO: Consider unifying this with how the root works.
        return null === current ? (workInProgress.child = reconcileChildFibersInPlace(workInProgress, workInProgress.child, nextChildren, priorityLevel), 
        memoizeProps(workInProgress, nextChildren)) : (reconcileChildren(current, workInProgress, nextChildren), 
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
    function bailoutOnAlreadyFinishedWork(current, workInProgress) {
        var renderPriority = workInProgress.pendingWorkPriority;
        return cloneChildFibers(current, workInProgress, renderPriority), workInProgress.child;
    }
    function bailoutOnLowPriority(current, workInProgress) {
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
    function beginWork(current, workInProgress, priorityLevel) {
        if (workInProgress.pendingWorkPriority === NoWork$3 || workInProgress.pendingWorkPriority > priorityLevel) return bailoutOnLowPriority(current, workInProgress);
        switch (workInProgress.tag) {
          case IndeterminateComponent$2:
            return mountIndeterminateComponent(current, workInProgress, priorityLevel);

          case FunctionalComponent$1:
            return updateFunctionalComponent(current, workInProgress);

          case ClassComponent$6:
            return updateClassComponent(current, workInProgress, priorityLevel);

          case HostRoot$6:
            return updateHostRoot(current, workInProgress, priorityLevel);

          case HostComponent$7:
            return updateHostComponent(current, workInProgress, priorityLevel);

          case HostText$3:
            return updateHostText(current, workInProgress);

          case CoroutineHandlerPhase:
            // This is a restart. Reset the tag to the initial phase.
            workInProgress.tag = CoroutineComponent$1;

          // Intentionally fall through since this is now the same.
            case CoroutineComponent$1:
            return updateCoroutineComponent(current, workInProgress);

          case YieldComponent$1:
            // A yield component is just a placeholder, we can just run through the
            // next one immediately.
            return null;

          case HostPortal$2:
            return updatePortalComponent(current, workInProgress);

          case Fragment$1:
            return updateFragment(current, workInProgress);

          default:
            invariant(!1, "Unknown unit of work tag. This error is likely caused by a bug in " + "React. Please file an issue.");
        }
    }
    function beginFailedWork(current, workInProgress, priorityLevel) {
        if (invariant(workInProgress.tag === ClassComponent$6 || workInProgress.tag === HostRoot$6, "Invalid type of work. This error is likely caused by a bug in React. " + "Please file an issue."), 
        // Add an error effect so we can handle the error during the commit phase
        workInProgress.effectTag |= Err$1, // This is a weird case where we do "resume" work — work that failed on
        // our first attempt. Because we no longer have a notion of "progressed
        // deletions," reset the child to the current child to make sure we delete
        // it again. TODO: Find a better way to handle this, perhaps during a more
        // general overhaul of error handling.
        null === current ? workInProgress.child = null : workInProgress.child !== current.child && (workInProgress.child = current.child), 
        workInProgress.pendingWorkPriority === NoWork$3 || workInProgress.pendingWorkPriority > priorityLevel) return bailoutOnLowPriority(current, workInProgress);
        if (// If we don't bail out, we're going be recomputing our children so we need
        // to drop our effect list.
        workInProgress.firstEffect = null, workInProgress.lastEffect = null, reconcileChildrenAtPriority(current, workInProgress, null, priorityLevel), 
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
}, reconcileChildFibers$2 = ReactChildFiber.reconcileChildFibers, popContextProvider$2 = ReactFiberContext.popContextProvider, IndeterminateComponent$3 = ReactTypeOfWork.IndeterminateComponent, FunctionalComponent$3 = ReactTypeOfWork.FunctionalComponent, ClassComponent$8 = ReactTypeOfWork.ClassComponent, HostRoot$7 = ReactTypeOfWork.HostRoot, HostComponent$8 = ReactTypeOfWork.HostComponent, HostText$5 = ReactTypeOfWork.HostText, HostPortal$4 = ReactTypeOfWork.HostPortal, CoroutineComponent$3 = ReactTypeOfWork.CoroutineComponent, CoroutineHandlerPhase$1 = ReactTypeOfWork.CoroutineHandlerPhase, YieldComponent$3 = ReactTypeOfWork.YieldComponent, Fragment$3 = ReactTypeOfWork.Fragment, Placement$4 = ReactTypeOfSideEffect.Placement, Ref$2 = ReactTypeOfSideEffect.Ref, Update$2 = ReactTypeOfSideEffect.Update, OffscreenPriority$2 = ReactPriorityLevel.OffscreenPriority, ReactFiberCompleteWork = function(config, hostContext, hydrationContext) {
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
            if (node.tag === HostComponent$8 || node.tag === HostText$5 || node.tag === HostPortal$4) invariant(!1, "A coroutine cannot have host component children."); else if (node.tag === YieldComponent$3) yields.push(node.type); else if (null !== node.child) {
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
    function moveCoroutineToHandlerPhase(current, workInProgress) {
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
        var fn = coroutine.handler, props = coroutine.props, nextChildren = fn(props, yields), currentFirstChild = null !== current ? current.child : null, priority = workInProgress.pendingWorkPriority;
        return workInProgress.child = reconcileChildFibers$2(workInProgress, currentFirstChild, nextChildren, priority), 
        workInProgress.child;
    }
    function appendAllChildren(parent, workInProgress) {
        for (// We only have the top Fiber that was created but we need recurse down its
        // children to find all the terminal nodes.
        var node = workInProgress.child; null !== node; ) {
            if (node.tag === HostComponent$8 || node.tag === HostText$5) appendInitialChild(parent, node.stateNode); else if (node.tag === HostPortal$4) ; else if (null !== node.child) {
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
    function completeWork(current, workInProgress, renderPriority) {
        var newProps = workInProgress.pendingProps;
        switch (null === newProps ? newProps = workInProgress.memoizedProps : workInProgress.pendingWorkPriority === OffscreenPriority$2 && renderPriority !== OffscreenPriority$2 || (// Reset the pending props, unless this was a down-prioritization.
        workInProgress.pendingProps = null), workInProgress.tag) {
          case FunctionalComponent$3:
            return null;

          case ClassComponent$8:
            // We are leaving this subtree, so pop context if any.
            return popContextProvider$2(workInProgress), null;

          case HostRoot$7:
            // TODO: Pop the host container after #8607 lands.
            var fiberRoot = workInProgress.stateNode;
            // If we hydrated, pop so that we can delete any remaining children
            // that weren't hydrated.
            // This resets the hacky state to fix isMounted before committing.
            // TODO: Delete this when we delete isMounted and findDOMNode.
            return fiberRoot.pendingContext && (fiberRoot.context = fiberRoot.pendingContext, 
            fiberRoot.pendingContext = null), null !== current && null !== current.child || (popHydrationState(workInProgress), 
            workInProgress.effectTag &= ~Placement$4), null;

          case HostComponent$8:
            popHostContext(workInProgress);
            var rootContainerInstance = getRootHostContainer(), type = workInProgress.type;
            if (null !== current && null != workInProgress.stateNode) {
                // If we have an alternate, that means this is an update and we need to
                // schedule a side-effect to do the updates.
                var oldProps = current.memoizedProps, instance = workInProgress.stateNode, currentHostContext = getHostContext(), updatePayload = prepareUpdate(instance, type, oldProps, newProps, rootContainerInstance, currentHostContext);
                // TODO: Type this specific to this type of component.
                workInProgress.updateQueue = updatePayload, // If the update payload indicates that there is a change or if there
                // is a new ref we mark this as an update.
                updatePayload && markUpdate(workInProgress), current.ref !== workInProgress.ref && markRef(workInProgress);
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

          case HostText$5:
            var newText = newProps;
            if (current && null != workInProgress.stateNode) {
                // If we have an alternate, that means this is an update and we need
                // to schedule a side-effect to do the updates.
                current.memoizedProps !== newText && markUpdate(workInProgress);
            } else {
                if ("string" != typeof newText) // This can happen when we abort work.
                return invariant(null !== workInProgress.stateNode, "We must have new props for new mounts. This error is likely " + "caused by a bug in React. Please file an issue."), 
                null;
                var _rootContainerInstance = getRootHostContainer(), _currentHostContext2 = getHostContext();
                popHydrationState(workInProgress) ? prepareToHydrateHostTextInstance(workInProgress) && markUpdate(workInProgress) : workInProgress.stateNode = createTextInstance(newText, _rootContainerInstance, _currentHostContext2, workInProgress);
            }
            return null;

          case CoroutineComponent$3:
            return moveCoroutineToHandlerPhase(current, workInProgress);

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
}, rendererID = null, injectInternals$1 = null, onCommitRoot$1 = null, onCommitUnmount$1 = null;

if ("undefined" != typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && __REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber) {
    var inject$1 = __REACT_DEVTOOLS_GLOBAL_HOOK__.inject, onCommitFiberRoot = __REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot, onCommitFiberUnmount = __REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberUnmount;
    injectInternals$1 = function(internals) {
        warning(null == rendererID, "Cannot inject into DevTools twice."), rendererID = inject$1(internals);
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

var injectInternals_1 = injectInternals$1, onCommitRoot_1 = onCommitRoot$1, onCommitUnmount_1 = onCommitUnmount$1, ReactFiberDevToolsHook = {
    injectInternals: injectInternals_1,
    onCommitRoot: onCommitRoot_1,
    onCommitUnmount: onCommitUnmount_1
}, ClassComponent$9 = ReactTypeOfWork.ClassComponent, HostRoot$8 = ReactTypeOfWork.HostRoot, HostComponent$9 = ReactTypeOfWork.HostComponent, HostText$6 = ReactTypeOfWork.HostText, HostPortal$5 = ReactTypeOfWork.HostPortal, CoroutineComponent$4 = ReactTypeOfWork.CoroutineComponent, commitCallbacks$1 = ReactFiberUpdateQueue.commitCallbacks, onCommitUnmount = ReactFiberDevToolsHook.onCommitUnmount, Placement$5 = ReactTypeOfSideEffect.Placement, Update$3 = ReactTypeOfSideEffect.Update, Callback$1 = ReactTypeOfSideEffect.Callback, ContentReset$2 = ReactTypeOfSideEffect.ContentReset, ReactFiberCommitWork = function(config, captureError) {
    var commitMount = config.commitMount, commitUpdate = config.commitUpdate, resetTextContent = config.resetTextContent, commitTextUpdate = config.commitTextUpdate, appendChild = config.appendChild, appendChildToContainer = config.appendChildToContainer, insertBefore = config.insertBefore, insertInContainerBefore = config.insertInContainerBefore, removeChild = config.removeChild, removeChildFromContainer = config.removeChildFromContainer, getPublicInstance = config.getPublicInstance;
    function safelyCallComponentWillUnmount(current, instance) {
        try {
            instance.componentWillUnmount();
        } catch (unmountError) {
            captureError(current, unmountError);
        }
    }
    function safelyDetachRef(current) {
        var ref = current.ref;
        if (null !== ref) {
            try {
                ref(null);
            } catch (refError) {
                captureError(current, refError);
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
        return fiber.tag === HostComponent$9 || fiber.tag === HostRoot$8 || fiber.tag === HostPortal$5;
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
            for (node.sibling.return = node.return, node = node.sibling; node.tag !== HostComponent$9 && node.tag !== HostText$6; ) {
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
          case HostComponent$9:
            parent = parentFiber.stateNode, isContainer = !1;
            break;

          case HostRoot$8:
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
            if (node.tag === HostComponent$9 || node.tag === HostText$6) before ? isContainer ? insertInContainerBefore(parent, node.stateNode, before) : insertBefore(parent, node.stateNode, before) : isContainer ? appendChildToContainer(parent, node.stateNode) : appendChild(parent, node.stateNode); else if (node.tag === HostPortal$5) ; else if (null !== node.child) {
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
    function unmountHostComponents(current) {
        for (// We only have the top Fiber that was inserted but we need recurse down its
        var node = current, currentParentIsValid = !1, currentParent = void 0, currentParentIsContainer = void 0; !0; ) {
            if (!currentParentIsValid) {
                var parent = node.return;
                findParent: for (;!0; ) {
                    switch (invariant(null !== parent, "Expected to find a host parent. This error is likely caused by " + "a bug in React. Please file an issue."), 
                    parent.tag) {
                      case HostComponent$9:
                        currentParent = parent.stateNode, currentParentIsContainer = !1;
                        break findParent;

                      case HostRoot$8:
                      case HostPortal$5:
                        currentParent = parent.stateNode.containerInfo, currentParentIsContainer = !0;
                        break findParent;
                    }
                    parent = parent.return;
                }
                currentParentIsValid = !0;
            }
            if (node.tag === HostComponent$9 || node.tag === HostText$6) commitNestedUnmounts(node), 
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
            if (node === current) return;
            for (;null === node.sibling; ) {
                if (null === node.return || node.return === current) return;
                node = node.return, node.tag === HostPortal$5 && (// When we go out of the portal, we need to restore the parent.
                // Since we don't keep a stack of them, we will search for it.
                currentParentIsValid = !1);
            }
            node.sibling.return = node.return, node = node.sibling;
        }
    }
    function commitDeletion(current) {
        // Recursively delete all host nodes from the parent.
        // Detach refs and call componentWillUnmount() on the whole subtree.
        unmountHostComponents(current), // Cut off the return pointers to disconnect it from the tree. Ideally, we
        // should clear the child pointer of the parent alternate to let this
        // get GC:ed but we don't know which for sure which parent is the current
        // one so we'll settle for GC:ing the subtree of this child. This child
        // itself will be GC:ed when the parent updates the next time.
        current.return = null, current.child = null, current.alternate && (current.alternate.child = null, 
        current.alternate.return = null);
    }
    // User-originating errors (lifecycles and refs) should not interrupt
    // deletion, so don't let them throw. Host-originating errors should
    // interrupt deletion, so it's okay
    function commitUnmount(current) {
        switch ("function" == typeof onCommitUnmount && onCommitUnmount(current), current.tag) {
          case ClassComponent$9:
            safelyDetachRef(current);
            var instance = current.stateNode;
            return void ("function" == typeof instance.componentWillUnmount && safelyCallComponentWillUnmount(current, instance));

          case HostComponent$9:
            return void safelyDetachRef(current);

          case CoroutineComponent$4:
            return void commitNestedUnmounts(current.stateNode);

          case HostPortal$5:
            // TODO: this is recursive.
            // We are also not using this parent because
            // the portal will get pushed immediately.
            return void unmountHostComponents(current);
        }
    }
    function commitWork(current, finishedWork) {
        switch (finishedWork.tag) {
          case ClassComponent$9:
            return;

          case HostComponent$9:
            var instance = finishedWork.stateNode;
            if (null != instance) {
                // Commit the work prepared earlier.
                var newProps = finishedWork.memoizedProps, oldProps = null !== current ? current.memoizedProps : newProps, type = finishedWork.type, updatePayload = finishedWork.updateQueue;
                finishedWork.updateQueue = null, null !== updatePayload && commitUpdate(instance, updatePayload, type, oldProps, newProps, finishedWork);
            }
            return;

          case HostText$6:
            invariant(null !== finishedWork.stateNode, "This should have a text node initialized. This error is likely " + "caused by a bug in React. Please file an issue.");
            var textInstance = finishedWork.stateNode, newText = finishedWork.memoizedProps, oldText = null !== current ? current.memoizedProps : newText;
            return void commitTextUpdate(textInstance, oldText, newText);

          case HostRoot$8:
          case HostPortal$5:
            return;

          default:
            invariant(!1, "This unit of work tag should not have side-effects. This error is " + "likely caused by a bug in React. Please file an issue.");
        }
    }
    function commitLifeCycles(current, finishedWork) {
        switch (finishedWork.tag) {
          case ClassComponent$9:
            var instance = finishedWork.stateNode;
            if (finishedWork.effectTag & Update$3) if (null === current) instance.componentDidMount(); else {
                var prevProps = current.memoizedProps, prevState = current.memoizedState;
                instance.componentDidUpdate(prevProps, prevState);
            }
            return void (finishedWork.effectTag & Callback$1 && null !== finishedWork.updateQueue && commitCallbacks$1(finishedWork, finishedWork.updateQueue, instance));

          case HostRoot$8:
            var updateQueue = finishedWork.updateQueue;
            if (null !== updateQueue) {
                var _instance = finishedWork.child && finishedWork.child.stateNode;
                commitCallbacks$1(finishedWork, updateQueue, _instance);
            }
            return;

          case HostComponent$9:
            var _instance2 = finishedWork.stateNode;
            // Renderers may schedule work to be done after host components are mounted
            // (eg DOM renderer may schedule auto-focus for inputs and form controls).
            // These effects should only be committed when components are first mounted,
            // aka when there is no current/alternate.
            if (null === current && finishedWork.effectTag & Update$3) {
                var type = finishedWork.type, props = finishedWork.memoizedProps;
                commitMount(_instance2, type, props, finishedWork);
            }
            return;

          case HostText$6:
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
              case HostComponent$9:
                ref(getPublicInstance(instance));
                break;

              default:
                ref(instance);
            }
        }
    }
    function commitDetachRef(current) {
        var currentRef = current.ref;
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
}, HostComponent$10 = ReactTypeOfWork.HostComponent, HostText$7 = ReactTypeOfWork.HostText, HostRoot$9 = ReactTypeOfWork.HostRoot, Deletion$2 = ReactTypeOfSideEffect.Deletion, Placement$6 = ReactTypeOfSideEffect.Placement, createFiberFromHostInstanceForDeletion$1 = ReactFiber.createFiberFromHostInstanceForDeletion, ReactFiberHydrationContext = function(config) {
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
          case HostComponent$10:
            var type = fiber.type, props = fiber.pendingProps;
            return canHydrateInstance(nextInstance, type, props);

          case HostText$7:
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
        for (var parent = fiber.return; null !== parent && parent.tag !== HostComponent$10 && parent.tag !== HostRoot$9; ) parent = parent.return;
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
        if (fiber.tag !== HostComponent$10 || "head" !== type && "body" !== type && !shouldSetTextContent(type, fiber.memoizedProps)) for (var nextInstance = nextHydratableInstance; nextInstance; ) deleteHydratableInstance(fiber, nextInstance), 
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
}, popContextProvider$1 = ReactFiberContext.popContextProvider, reset$1 = ReactFiberStack.reset, getStackAddendumByWorkInProgressFiber$1 = ReactFiberComponentTreeHook.getStackAddendumByWorkInProgressFiber, logCapturedError = ReactFiberErrorLogger.logCapturedError, ReactCurrentOwner$1 = ReactGlobalSharedState_1.ReactCurrentOwner, createWorkInProgress$1 = ReactFiber.createWorkInProgress, largerPriority$1 = ReactFiber.largerPriority, onCommitRoot = ReactFiberDevToolsHook.onCommitRoot, NoWork$2 = ReactPriorityLevel.NoWork, SynchronousPriority$1 = ReactPriorityLevel.SynchronousPriority, TaskPriority$1 = ReactPriorityLevel.TaskPriority, HighPriority = ReactPriorityLevel.HighPriority, LowPriority = ReactPriorityLevel.LowPriority, OffscreenPriority = ReactPriorityLevel.OffscreenPriority, AsyncUpdates = ReactTypeOfInternalContext.AsyncUpdates, PerformedWork = ReactTypeOfSideEffect.PerformedWork, Placement$1 = ReactTypeOfSideEffect.Placement, Update = ReactTypeOfSideEffect.Update, PlacementAndUpdate = ReactTypeOfSideEffect.PlacementAndUpdate, Deletion = ReactTypeOfSideEffect.Deletion, ContentReset = ReactTypeOfSideEffect.ContentReset, Callback = ReactTypeOfSideEffect.Callback, Err = ReactTypeOfSideEffect.Err, Ref = ReactTypeOfSideEffect.Ref, HostRoot$5 = ReactTypeOfWork.HostRoot, HostComponent$5 = ReactTypeOfWork.HostComponent, HostPortal$1 = ReactTypeOfWork.HostPortal, ClassComponent$4 = ReactTypeOfWork.ClassComponent, getUpdatePriority$1 = ReactFiberUpdateQueue.getUpdatePriority, _require14 = ReactFiberContext, resetContext$1 = _require14.resetContext, ReactFiberInstrumentation$1, timeHeuristicForUnitOfWork = 1, ReactFiberScheduler = function(config) {
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
                var current = nextEffect.alternate;
                null !== current && commitDetachRef(current);
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
                var current = nextEffect.alternate;
                commitLifeCycles(current, nextEffect);
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
            var current = workInProgress.alternate, next = completeWork(current, workInProgress, nextPriorityLevel), returnFiber = workInProgress.return, siblingFiber = workInProgress.sibling;
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
        var current = workInProgress.alternate, next = beginWork(current, workInProgress, nextPriorityLevel);
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
        var current = workInProgress.alternate, next = beginFailedWork(current, workInProgress, nextPriorityLevel);
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
        if (failedWork.tag === HostRoot$5) boundary = failedWork, isFailedBoundary(failedWork) && (// If this root already failed, there must have been an error when
        // attempting to unmount it. This is a worst-case scenario and
        // should only be possible if there's a bug in the renderer.
        fatalError = error); else for (var node = failedWork.return; null !== node && null === boundary; ) {
            if (node.tag === ClassComponent$4) {
                var instance = node.stateNode;
                "function" == typeof instance.unstable_handleError && (errorBoundaryFound = !0, 
                errorBoundaryName = getComponentName_1(node), // Found an error boundary!
                boundary = node, willRetry = !0);
            } else node.tag === HostRoot$5 && (// Treat the root like a no-op error boundary.
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
            var _componentStack = getStackAddendumByWorkInProgressFiber$1(failedWork), _componentName = getComponentName_1(failedWork);
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

          case HostRoot$5:
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

              case HostComponent$5:
                popHostContext(node);
                break;

              case HostRoot$5:
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
                if (node.tag !== HostRoot$5) return;
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

var getContextForSubtree_1 = getContextForSubtree, ReactFeatureFlags$1 = require("ReactFeatureFlags"), addTopLevelUpdate = ReactFiberUpdateQueue.addTopLevelUpdate, findCurrentUnmaskedContext = ReactFiberContext.findCurrentUnmaskedContext, isContextProvider = ReactFiberContext.isContextProvider, processChildContext = ReactFiberContext.processChildContext, createFiberRoot = ReactFiberRoot.createFiberRoot, HostComponent$3 = ReactTypeOfWork.HostComponent, findCurrentHostFiber$1 = ReactFiberTreeReflection.findCurrentHostFiber;

getContextForSubtree_1._injectFiber(function(fiber) {
    var parentContext = findCurrentUnmaskedContext(fiber);
    return isContextProvider(fiber) ? processChildContext(fiber, parentContext, !1) : parentContext;
});

var ReactFiberReconciler = function(config) {
    var getPublicInstance = config.getPublicInstance, _ReactFiberScheduler = ReactFiberScheduler(config), scheduleUpdate = _ReactFiberScheduler.scheduleUpdate, getPriorityContext = _ReactFiberScheduler.getPriorityContext, performWithPriority = _ReactFiberScheduler.performWithPriority, batchedUpdates = _ReactFiberScheduler.batchedUpdates, unbatchedUpdates = _ReactFiberScheduler.unbatchedUpdates, syncUpdates = _ReactFiberScheduler.syncUpdates, deferredUpdates = _ReactFiberScheduler.deferredUpdates;
    function scheduleTopLevelUpdate(current, element, callback) {
        var forceAsync = ReactFeatureFlags$1.enableAsyncSubtreeAPI && null != element && null != element.type && !0 === element.type.unstable_asyncUpdates, priorityLevel = getPriorityContext(current, forceAsync), nextState = {
            element: element
        };
        callback = void 0 === callback ? null : callback, addTopLevelUpdate(current, nextState, callback, priorityLevel), 
        scheduleUpdate(current, priorityLevel);
    }
    return {
        createContainer: function(containerInfo) {
            return createFiberRoot(containerInfo);
        },
        updateContainer: function(element, container, parentComponent, callback) {
            // TODO: If this is a nested container, this won't be the root.
            var current = container.current, context = getContextForSubtree_1(parentComponent);
            null === container.context ? container.context = context : container.pendingContext = context, 
            scheduleTopLevelUpdate(current, element, callback);
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
              case HostComponent$3:
                return getPublicInstance(containerFiber.child.stateNode);

              default:
                return containerFiber.child.stateNode;
            }
        },
        findHostInstance: function(fiber) {
            var hostFiber = findCurrentHostFiber$1(fiber);
            return null === hostFiber ? null : hostFiber.stateNode;
        }
    };
}, ReactVersion = "16.0.0-alpha.13", ELEMENT_NODE$3 = HTMLNodeType_1.ELEMENT_NODE, findFiber = function(arg) {
    invariant(!1, "Missing injection for fiber findDOMNode");
}, findStack = function(arg) {
    invariant(!1, "Missing injection for stack findDOMNode");
}, findDOMNode = function(componentOrElement) {
    if (null == componentOrElement) return null;
    if (componentOrElement.nodeType === ELEMENT_NODE$3) return componentOrElement;
    var inst = ReactInstanceMap_1.get(componentOrElement);
    if (inst) return "number" == typeof inst.tag ? findFiber(inst) : findStack(inst);
    "function" == typeof componentOrElement.render ? invariant(!1, "Unable to find node on an unmounted component.") : invariant(!1, "Element appears to be neither ReactComponent nor DOMNode. Keys: %s", Object.keys(componentOrElement));
};

findDOMNode._injectFiber = function(fn) {
    findFiber = fn;
}, findDOMNode._injectStack = function(fn) {
    findStack = fn;
};

var findDOMNode_1 = findDOMNode, ReactFeatureFlags = require("ReactFeatureFlags"), ReactDOMFeatureFlags = require("ReactDOMFeatureFlags"), isValidElement = React.isValidElement, injectInternals = ReactFiberDevToolsHook.injectInternals, ELEMENT_NODE = HTMLNodeType_1.ELEMENT_NODE, TEXT_NODE = HTMLNodeType_1.TEXT_NODE, COMMENT_NODE = HTMLNodeType_1.COMMENT_NODE, DOCUMENT_NODE = HTMLNodeType_1.DOCUMENT_NODE, DOCUMENT_FRAGMENT_NODE = HTMLNodeType_1.DOCUMENT_FRAGMENT_NODE, ID_ATTRIBUTE_NAME = DOMProperty_1.ID_ATTRIBUTE_NAME, createElement = ReactDOMFiberComponent_1.createElement, getChildNamespace = ReactDOMFiberComponent_1.getChildNamespace, setInitialProperties = ReactDOMFiberComponent_1.setInitialProperties, diffProperties = ReactDOMFiberComponent_1.diffProperties, updateProperties = ReactDOMFiberComponent_1.updateProperties, diffHydratedProperties = ReactDOMFiberComponent_1.diffHydratedProperties, diffHydratedText = ReactDOMFiberComponent_1.diffHydratedText, warnForDeletedHydratableElement = ReactDOMFiberComponent_1.warnForDeletedHydratableElement, warnForDeletedHydratableText = ReactDOMFiberComponent_1.warnForDeletedHydratableText, warnForInsertedHydratedElement = ReactDOMFiberComponent_1.warnForInsertedHydratedElement, warnForInsertedHydratedText = ReactDOMFiberComponent_1.warnForInsertedHydratedText, precacheFiberNode = ReactDOMComponentTree_1.precacheFiberNode, updateFiberProps = ReactDOMComponentTree_1.updateFiberProps;

ReactDOMInjection.inject(), ReactControlledComponent_1.injection.injectFiberControlledHostComponent(ReactDOMFiberComponent_1), 
findDOMNode_1._injectFiber(function(fiber) {
    return DOMRenderer.findHostInstance(fiber);
});

var eventsEnabled = null, selectionInformation = null;

/**
 * True if the supplied DOM node is a valid node element.
 *
 * @param {?DOMElement} node The candidate DOM node.
 * @return {boolean} True if the DOM is a valid DOM node.
 * @internal
 */
function isValidContainer(node) {
    return !(!node || node.nodeType !== ELEMENT_NODE && node.nodeType !== DOCUMENT_NODE && node.nodeType !== DOCUMENT_FRAGMENT_NODE && (node.nodeType !== COMMENT_NODE || " react-mount-point-unstable " !== node.nodeValue));
}

function getReactRootElementInContainer(container) {
    return container ? container.nodeType === DOCUMENT_NODE ? container.documentElement : container.firstChild : null;
}

function shouldReuseContent(container) {
    var rootElement = getReactRootElementInContainer(container);
    return !(!rootElement || rootElement.nodeType !== ELEMENT_NODE || !rootElement.hasAttribute(ID_ATTRIBUTE_NAME));
}

function shouldAutoFocusHostComponent(type, props) {
    switch (type) {
      case "button":
      case "input":
      case "select":
      case "textarea":
        return !!props.autoFocus;
    }
    return !1;
}

var DOMRenderer = ReactFiberReconciler({
    getRootHostContext: function(rootContainerInstance) {
        var type = void 0, namespace = void 0;
        if (rootContainerInstance.nodeType === DOCUMENT_NODE) {
            type = "#document";
            var root = rootContainerInstance.documentElement;
            namespace = root ? root.namespaceURI : getChildNamespace(null, "");
        } else {
            var container = rootContainerInstance.nodeType === COMMENT_NODE ? rootContainerInstance.parentNode : rootContainerInstance, ownNamespace = container.namespaceURI || null;
            type = container.tagName, namespace = getChildNamespace(ownNamespace, type);
        }
        return namespace;
    },
    getChildHostContext: function(parentHostContext, type) {
        return getChildNamespace(parentHostContext, type);
    },
    getPublicInstance: function(instance) {
        return instance;
    },
    prepareForCommit: function() {
        eventsEnabled = ReactBrowserEventEmitter_1.isEnabled(), selectionInformation = ReactInputSelection_1.getSelectionInformation(), 
        ReactBrowserEventEmitter_1.setEnabled(!1);
    },
    resetAfterCommit: function() {
        ReactInputSelection_1.restoreSelection(selectionInformation), selectionInformation = null, 
        ReactBrowserEventEmitter_1.setEnabled(eventsEnabled), eventsEnabled = null;
    },
    createInstance: function(type, props, rootContainerInstance, hostContext, internalInstanceHandle) {
        var parentNamespace = void 0;
        parentNamespace = hostContext;
        var domElement = createElement(type, props, rootContainerInstance, parentNamespace);
        return precacheFiberNode(internalInstanceHandle, domElement), updateFiberProps(domElement, props), 
        domElement;
    },
    appendInitialChild: function(parentInstance, child) {
        parentInstance.appendChild(child);
    },
    finalizeInitialChildren: function(domElement, type, props, rootContainerInstance) {
        return setInitialProperties(domElement, type, props, rootContainerInstance), shouldAutoFocusHostComponent(type, props);
    },
    prepareUpdate: function(domElement, type, oldProps, newProps, rootContainerInstance, hostContext) {
        return diffProperties(domElement, type, oldProps, newProps, rootContainerInstance);
    },
    commitMount: function(domElement, type, newProps, internalInstanceHandle) {
        domElement.focus();
    },
    commitUpdate: function(domElement, updatePayload, type, oldProps, newProps, internalInstanceHandle) {
        // Update the props handle so that we know which props are the ones with
        // with current event handlers.
        updateFiberProps(domElement, newProps), // Apply the diff to the DOM node.
        updateProperties(domElement, updatePayload, type, oldProps, newProps);
    },
    shouldSetTextContent: function(type, props) {
        return "textarea" === type || "string" == typeof props.children || "number" == typeof props.children || "object" == typeof props.dangerouslySetInnerHTML && null !== props.dangerouslySetInnerHTML && "string" == typeof props.dangerouslySetInnerHTML.__html;
    },
    resetTextContent: function(domElement) {
        domElement.textContent = "";
    },
    shouldDeprioritizeSubtree: function(type, props) {
        return !!props.hidden;
    },
    createTextInstance: function(text, rootContainerInstance, hostContext, internalInstanceHandle) {
        var textNode = document.createTextNode(text);
        return precacheFiberNode(internalInstanceHandle, textNode), textNode;
    },
    commitTextUpdate: function(textInstance, oldText, newText) {
        textInstance.nodeValue = newText;
    },
    appendChild: function(parentInstance, child) {
        parentInstance.appendChild(child);
    },
    appendChildToContainer: function(container, child) {
        container.nodeType === COMMENT_NODE ? container.parentNode.insertBefore(child, container) : container.appendChild(child);
    },
    insertBefore: function(parentInstance, child, beforeChild) {
        parentInstance.insertBefore(child, beforeChild);
    },
    insertInContainerBefore: function(container, child, beforeChild) {
        container.nodeType === COMMENT_NODE ? container.parentNode.insertBefore(child, beforeChild) : container.insertBefore(child, beforeChild);
    },
    removeChild: function(parentInstance, child) {
        parentInstance.removeChild(child);
    },
    removeChildFromContainer: function(container, child) {
        container.nodeType === COMMENT_NODE ? container.parentNode.removeChild(child) : container.removeChild(child);
    },
    canHydrateInstance: function(instance, type, props) {
        return instance.nodeType === ELEMENT_NODE && type === instance.nodeName.toLowerCase();
    },
    canHydrateTextInstance: function(instance, text) {
        return "" !== text && instance.nodeType === TEXT_NODE;
    },
    getNextHydratableSibling: function(instance) {
        // Skip non-hydratable nodes.
        for (var node = instance.nextSibling; node && node.nodeType !== ELEMENT_NODE && node.nodeType !== TEXT_NODE; ) node = node.nextSibling;
        return node;
    },
    getFirstHydratableChild: function(parentInstance) {
        // Skip non-hydratable nodes.
        for (var next = parentInstance.firstChild; next && next.nodeType !== ELEMENT_NODE && next.nodeType !== TEXT_NODE; ) next = next.nextSibling;
        return next;
    },
    hydrateInstance: function(instance, type, props, rootContainerInstance, internalInstanceHandle) {
        // TODO: Possibly defer this until the commit phase where all the events
        // get attached.
        return precacheFiberNode(internalInstanceHandle, instance), updateFiberProps(instance, props), 
        diffHydratedProperties(instance, type, props, rootContainerInstance);
    },
    hydrateTextInstance: function(textInstance, text, internalInstanceHandle) {
        return precacheFiberNode(internalInstanceHandle, textInstance), diffHydratedText(textInstance, text);
    },
    didNotHydrateInstance: function(parentInstance, instance) {
        1 === instance.nodeType ? warnForDeletedHydratableElement(parentInstance, instance) : warnForDeletedHydratableText(parentInstance, instance);
    },
    didNotFindHydratableInstance: function(parentInstance, type, props) {
        warnForInsertedHydratedElement(parentInstance, type, props);
    },
    didNotFindHydratableTextInstance: function(parentInstance, text) {
        warnForInsertedHydratedText(parentInstance, text);
    },
    scheduleDeferredCallback: ReactDOMFrameScheduling.rIC,
    useSyncScheduling: !ReactDOMFeatureFlags.fiberAsyncScheduling
});

ReactGenericBatching_1.injection.injectFiberBatchedUpdates(DOMRenderer.batchedUpdates);

function renderSubtreeIntoContainer(parentComponent, children, container, callback) {
    invariant(isValidContainer(container), "Target container is not a DOM element.");
    var root = container._reactRootContainer;
    if (root) DOMRenderer.updateContainer(children, root, parentComponent, callback); else {
        // First clear any existing content.
        // TODO: Figure out the best heuristic here.
        if (!shouldReuseContent(container)) for (var rootSibling = void 0; rootSibling = container.lastChild; ) container.removeChild(rootSibling);
        var newRoot = DOMRenderer.createContainer(container);
        root = container._reactRootContainer = newRoot, // Initial mount should not be batched.
        DOMRenderer.unbatchedUpdates(function() {
            DOMRenderer.updateContainer(children, newRoot, parentComponent, callback);
        });
    }
    return DOMRenderer.getPublicRootInstance(root);
}

var ReactDOMFiber = {
    render: function(element, container, callback) {
        // Top-level check occurs here instead of inside child reconciler
        // because requirements vary between renderers. E.g. React Art
        // allows arrays.
        // Check if it quacks like an element
        return ReactFeatureFlags.disableNewFiberFeatures && (isValidElement(element) || ("string" == typeof element ? invariant(!1, "ReactDOM.render(): Invalid component element. Instead of " + "passing a string like 'div', pass " + "React.createElement('div') or <div />.") : "function" == typeof element ? invariant(!1, "ReactDOM.render(): Invalid component element. Instead of " + "passing a class like Foo, pass React.createElement(Foo) " + "or <Foo />.") : null != element && void 0 !== element.props ? invariant(!1, "ReactDOM.render(): Invalid component element. This may be " + "caused by unintentionally loading two independent copies " + "of React.") : invariant(!1, "ReactDOM.render(): Invalid component element."))), 
        renderSubtreeIntoContainer(null, element, container, callback);
    },
    unstable_renderSubtreeIntoContainer: function(parentComponent, element, containerNode, callback) {
        return invariant(null != parentComponent && ReactInstanceMap_1.has(parentComponent), "parentComponent must be a valid React Component"), 
        renderSubtreeIntoContainer(parentComponent, element, containerNode, callback);
    },
    unmountComponentAtNode: function(container) {
        return invariant(isValidContainer(container), "unmountComponentAtNode(...): Target container is not a DOM element."), 
        !!container._reactRootContainer && (DOMRenderer.unbatchedUpdates(function() {
            renderSubtreeIntoContainer(null, null, container, function() {
                container._reactRootContainer = null;
            });
        }), !0);
    },
    findDOMNode: findDOMNode_1,
    unstable_createPortal: function(children, container) {
        var key = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null;
        // TODO: pass ReactDOM portal implementation as third argument
        return ReactPortal.createPortal(children, container, null, key);
    },
    unstable_batchedUpdates: ReactGenericBatching_1.batchedUpdates,
    unstable_deferredUpdates: DOMRenderer.deferredUpdates,
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
        // For TapEventPlugin which is popular in open source
        EventPluginHub: EventPluginHub_1,
        // Used by test-utils
        EventPluginRegistry: EventPluginRegistry_1,
        EventPropagators: EventPropagators_1,
        ReactControlledComponent: ReactControlledComponent_1,
        ReactDOMComponentTree: ReactDOMComponentTree_1,
        ReactDOMEventListener: ReactDOMEventListener_1
    }
};

"function" == typeof injectInternals && injectInternals({
    findFiberByHostInstance: ReactDOMComponentTree_1.getClosestInstanceFromNode,
    findHostInstanceByFiber: DOMRenderer.findHostInstance,
    // This is an enum because we may add more (e.g. profiler build)
    bundleType: 0,
    version: ReactVersion
});

var ReactDOMFiberEntry = ReactDOMFiber;

Object.assign(ReactDOMFiberEntry.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, {
    // These are real internal dependencies that are trickier to remove:
    ReactBrowserEventEmitter: ReactBrowserEventEmitter_1,
    ReactErrorUtils: ReactErrorUtils_1,
    ReactFiberErrorLogger: ReactFiberErrorLogger,
    ReactFiberTreeReflection: ReactFiberTreeReflection,
    ReactDOMComponentTree: ReactDOMComponentTree_1,
    ReactInstanceMap: ReactInstanceMap_1,
    // This is used for ajaxify on www:
    DOMProperty: DOMProperty_1,
    // These are dependencies of TapEventPlugin:
    EventPluginUtils: EventPluginUtils_1,
    EventPropagators: EventPropagators_1,
    SyntheticUIEvent: SyntheticUIEvent_1
});

var ReactDOMFiberFBEntry = ReactDOMFiberEntry;

module.exports = ReactDOMFiberFBEntry;
