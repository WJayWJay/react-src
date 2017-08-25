/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule instantiateReactComponent
 */

'use strict';

var ReactCompositeComponent = require('ReactCompositeComponent');
var ReactEmptyComponent = require('ReactEmptyComponent');
var ReactHostComponent = require('ReactHostComponent');

var invariant = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

var nextDebugID = 1;

// To avoid a cyclic dependency, we create the final class in this module
var ReactCompositeComponentWrapper = function(element) {
  this.construct(element);
};

function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return '\n\nCheck the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * Check if the type reference is a known internal type. I.e. not a user
 * provided composite type.
 * 检查这个类型引用是否是一个知名的内部类型。 I.e 而不是一个用户提供的组合类型
 *
 * @param {function} type
 * @return {boolean} Returns true if this is a valid internal type.
 */
function isInternalComponentType(type) {
  return (
    typeof type === 'function' &&
    typeof type.prototype !== 'undefined' &&
    typeof type.prototype.mountComponent === 'function' &&
    typeof type.prototype.receiveComponent === 'function'
  );
}

/**
 * Given a ReactNode, create an instance that will actually be mounted.
 * 给定ReactNode, 创建一个真是挂载的实例
 *
 * @param {ReactNode} node
 * @param {boolean} shouldHaveDebugID
 * @return {object} A new instance of the element's constructor. 返回一个元素构造的新实例
 * @protected
 */
function instantiateReactComponent(node, shouldHaveDebugID) {
  var instance;

  if (node === null || node === false) {
    // 创建空组件实例
    instance = ReactEmptyComponent.create(instantiateReactComponent);
  } else if (typeof node === 'object') {
    var element = node;
    var type = element.type;
    if (typeof type !== 'function' && typeof type !== 'string') {
      var info = '';
      if (__DEV__) {
        if (
          type === undefined ||
          (typeof type === 'object' &&
            type !== null &&
            Object.keys(type).length === 0)
        ) {
          info +=
            ' You likely forgot to export your component from the file ' +
            "it's defined in.";
            // 你很有可能忘记从你定义的文件中输出你的组件
        }
      }
      info += getDeclarationErrorAddendum(element._owner);
      invariant(
        false,
        'Element type is invalid: expected a string (for built-in components) ' +
          'or a class/function (for composite components) but got: %s.%s',
          // 元素类型无效。期待一个字符串，内置的(div,span), 或者一个类/函数(组合组件)
        type == null ? type : typeof type,
        info,
      );
    }

    // Special case string values
    if (typeof element.type === 'string') {
      instance = ReactHostComponent.createInternalComponent(element);
    } else if (isInternalComponentType(element.type)) {
      // This is temporarily available for custom components that are not string
      // representations. I.e. ART. Once those are updated to use the string
      // representation, we can drop this code path.
      // 这是临时可用，对于那些不是字符串呈现的传统组件，I.e. ART. 一旦这些被更新，为字符串呈现，我们可以卸掉 这个代码路径
      instance = new element.type(element);

      // We renamed this. Allow the old name for compat. :(
      // 我们重命名这个，允许老名字组合
      if (!instance.getHostNode) {
        instance.getHostNode = instance.getNativeNode;
      }
    } else {
      instance = new ReactCompositeComponentWrapper(element);
    }
  } else if (typeof node === 'string' || typeof node === 'number') {
    instance = ReactHostComponent.createInstanceForText(node);
  } else {
    invariant(false, 'Encountered invalid React node of type %s', typeof node);
  }

  if (__DEV__) {
    warning(
      typeof instance.mountComponent === 'function' &&
        typeof instance.receiveComponent === 'function' &&
        typeof instance.getHostNode === 'function' &&
        typeof instance.unmountComponent === 'function',
      'Only React Components can be mounted.',
    );
  }

  // These two fields are used by the DOM and ART diffing algorithms
  // respectively. Instead of using expandos on components, we should be
  // storing the state needed by the diffing algorithms elsewhere.
  instance._mountIndex = 0;
  instance._mountImage = null;

  if (__DEV__) {
    instance._debugID = shouldHaveDebugID ? nextDebugID++ : 0;
  }

  // Internal instances should fully constructed at this point, so they should
  // not get any new fields added to them at this point.
  if (__DEV__) {
    if (Object.preventExtensions) {
      Object.preventExtensions(instance);
    }
  }

  return instance;
}

Object.assign(
  ReactCompositeComponentWrapper.prototype,
  ReactCompositeComponent,
  {
    _instantiateReactComponent: instantiateReactComponent,
  },
);

module.exports = instantiateReactComponent;
