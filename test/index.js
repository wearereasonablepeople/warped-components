import React from 'react';
import assert from 'assert';
import TestRenderer from 'react-test-renderer';
import show from 'sanctuary-show';
import Z from 'sanctuary-type-classes';
import {createStore} from 'redux';

import {
  identity,
  getComponentName,
  compileSelectors,
  compileDispatchers,
  connect,
  combineReducers,
  Provider
} from '..';


var el = React.createElement;
var render = TestRenderer.create;

function eq(actual) {
  return function eqq(expected) {
    assert.strictEqual (show (actual), show (expected));
    assert.strictEqual (Z.equals (actual, expected), true);
  };
}

function mockAction(payload) {
  return {type: 'MOCK', payload: payload};
}

function mockDispatch(payload) {
  return {dispatched: payload};
}

function mockReducer(state, action) {
  return Object.assign ({}, state, {lastAction: action.type});
}

function mockReducerCount(state, action) {
  return action.type === 'MOCK' ?
         Object.assign ({}, state, {count: state.count + 1}) :
         state;
}

function mockSelector(state) {
  return String (state.count);
}

function noop() {}

function MockComponent(props) {
  return el (
    'button',
    {onClick: function() { props.increment (); }},
    props.text
  );
}

test ('identity', function() {
  eq (identity (42)) (42);
});

test ('getComponentName', function() {
  eq (getComponentName ({displayName: 'Test'})) ('Test');
  eq (getComponentName (MockComponent)) ('MockComponent');
  eq (getComponentName ({})) ('<Anonymous>');
  eq (getComponentName (null)) ('<Null>');
});

test ('compileSelectors', function() {
  var mapState = compileSelectors ({test: mockSelector});
  eq (typeof mapState) ('function');
  eq (mapState ({count: 42})) ({test: '42'});
});

test ('compileDispatchers', function() {
  var mapDispatch = compileDispatchers ({test: mockAction});
  eq (typeof mapDispatch) ('function');
  var dispatchers = mapDispatch (mockDispatch);
  eq (typeof dispatchers) ('object');
  eq (typeof dispatchers.test) ('function');
  eq (dispatchers.test (42)) ({dispatched: {type: 'MOCK', payload: 42}});
});

test ('combineReducers', function() {
  var zeroReducers = combineReducers ([]);
  var oneReducer = combineReducers ([mockReducer]);
  var twoReducers = combineReducers ([mockReducer, mockReducerCount]);

  eq (zeroReducers ({}, mockAction (42))) ({});
  eq (oneReducer ({}, mockAction (42))) ({lastAction: 'MOCK'});
  eq (twoReducers ({count: 1}, mockAction (42)))
     ({lastAction: 'MOCK', count: 2});
});

test ('Provider', function() {
  var store = createStore (x => x, {count: 0});
  var provider = new Provider ({store: store});

  provider.forceUpdate = noop;

  eq (Array.from (provider.reducers)) ([]);

  provider.addReducer (mockReducer);
  provider.addReducer (mockReducer);

  eq (Array.from (provider.reducers)) ([mockReducer]);

  provider.removeReducer (mockReducer);
  provider.removeReducer (mockReducer);

  eq (Array.from (provider.reducers)) ([]);
});

test ('connect', function() {
  var store = createStore (x => x, {count: 0});

  var FullyConnected = connect ({
    reducer: mockReducerCount,
    selectors: {text: mockSelector},
    actions: {increment: mockAction}
  }) (MockComponent);

  eq (FullyConnected.displayName) ('WarpedComponent(MockComponent)');

  var renderer1 = render (
    el (Provider, {store: store}, (
      el (FullyConnected, {foo: 'bar'})
    ))
  );

  var mockComponent = renderer1.root.findByType (MockComponent);

  eq (mockComponent.props.text) ('0');
  eq (typeof mockComponent.props.increment) ('function');
  eq (mockComponent.parent.type.displayName) ('WarpedManager(MockComponent)');

  mockComponent.findByType ('button').props.onClick ();

  eq (store.getState ()) ({count: 1});
  eq (mockComponent.props.text) ('1');

  store.dispatch (mockAction ());

  eq (store.getState ()) ({count: 2});
  eq (mockComponent.props.text) ('2');

  renderer1.unmount ();
  store.dispatch (mockAction ());

  eq (store.getState ()) ({count: 2});

  var PartlyConnected = connect ({}) (null);

  eq (PartlyConnected.displayName) ('WarpedComponent(<Null>)');
});
