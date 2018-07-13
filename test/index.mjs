import React from 'react';
import assert from 'assert';
import TestRenderer from 'react-test-renderer';
import show from 'sanctuary-show';
import Z from 'sanctuary-type-classes';
import Redux from 'redux';
import test from 'oletus';
import xstream from 'xstream';

import {
  combineCycles,
  combineReducers,
  compileDispatchers,
  compileSelectors,
  compose,
  computeFunctions,
  identity,
  makeStateDriver,
  thrush,
  warped,
  WarpedApp
} from '..';

var Stream = xstream.Stream;
var el = React.createElement;
var render = TestRenderer.create;

function eq(actual) {
  return function eqq(expected) {
    try {
      assert.strictEqual (show (actual), show (expected));
      assert.strictEqual (Z.equals (actual, expected), true);
    } catch (e) {
      Error.captureStackTrace (e, eqq);
      throw e;
    }
  };
}

function mockAction(payload) {
  return {type: 'MOCK', payload: payload};
}

function mockCycle(sources) {
  return {
    action: sources.action.map (mockAction)
  };
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

function MockComponent(props) {
  return el (
    'button',
    {onClick: function() { props.increment (); }},
    props.text
  );
}

test ('compose', function() {
  eq (typeof compose (mockAction, mockSelector)) ('function');
  eq (compose (mockAction, mockSelector) ({count: 42})) ({type: 'MOCK', payload: '42'});
});

test ('identity', function() {
  eq (identity (42)) (42);
});

test ('thrush', function() {
  eq (thrush (42) (mockAction)) ({type: 'MOCK', payload: 42});
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

test ('combineCycles', function() {
  var main = combineCycles ([mockCycle]);
  eq (typeof main) ('function');
  var sinks = main ({action: Stream.of (42)});
  eq (typeof sinks) ('object');
  eq (typeof sinks.action) ('object');
  eq (sinks.action instanceof Stream) (true);
  return new Promise (function(res, rej) {
    var value;
    sinks.action.addListener ({
      error: rej,
      next: function(_value) { value = _value; },
      complete: function() {
        eq (value) ({type: 'MOCK', payload: 42});
        res ();
      }
    });
  });
});

test ('computeFunctions', function() {
  var fns = computeFunctions ([
    {reducer: mockReducer, effects: mockCycle},
    {reducer: mockReducerCount},
    {}
  ]);

  eq (typeof fns) ('object');
  eq (typeof fns.reducer) ('function');
  eq (typeof fns.effects) ('function');
});

test ('makeStateDriver', function() {
  var store = Redux.createStore (mockReducer);
  var driver = makeStateDriver (store);

  eq (typeof driver) ('function');
  eq (typeof driver ()) ('object');
  eq (driver () instanceof Stream) (true);
});

test ('WarpedApp', function() {
  var app = new WarpedApp ({enhancer: identity, drivers: {}});

  eq (typeof app.store) ('object');
  eq (typeof app.drivers) ('object');
  eq (typeof app.drivers.action) ('function');
  eq (typeof app.drivers.state) ('function');
});

test ('warped', function() {
  var Warped = warped ({
    reducer: mockReducerCount,
    effects: mockCycle,
    selectors: {text: mockSelector},
    actions: {increment: mockAction}
  }) (MockComponent);

  eq (Warped.displayName) ('Connect(Collecting(MockComponent))');

  var renderer1 = render (
    el (WarpedApp, {initialState: {count: 0}}, (
      el (Warped, {foo: 'bar'})
    ))
  );

  var mockComponent = renderer1.root.findByType (MockComponent);

  eq (mockComponent.props.text) ('0');
  eq (typeof mockComponent.props.increment) ('function');
  eq (mockComponent.parent.type.displayName) ('CollectorManager(MockComponent)');

  mockComponent.findByType ('button').props.onClick ();

  eq (mockComponent.props.text) ('1');

  renderer1.unmount ();

  var PartlyConnected = warped ({reducer: mockReducer}) (null);

  eq (PartlyConnected.displayName) ('Collecting(<Null>)');
});
