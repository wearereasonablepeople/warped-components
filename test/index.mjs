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
  collectChanges,
  identity,
  makeStateDriver,
  thrush,
  warped,
  WarpedApp
} from '..';

var Stream = xstream.Stream;
var el = React.createElement;
var render = TestRenderer.create;

function wait(ms) {
  return new Promise (function(res) { setTimeout (res, ms); });
}

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
    state: sources.state,
    action: sources.action && sources.action.select ({type: 'increment'}).map (function() { return mockAction (1); })
  };
}

function actionAllCycle(sources) {
  return {
    action: sources.action.all ().filter (function(action) {
      return action.type === 'decrement';
    }).map (function() { return mockAction (-1); })
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
         Object.assign ({}, state, {count: state.count + action.payload}) :
         state;
}

function mockSelector(state) {
  return String (state.count);
}

function MockComponent(props) {
  return el ('div', {},
    el (
      'button',
      {onClick: function() { props.increment (); }},
      'increment'
    ),
    el (
      'button',
      {onClick: function() { props.decrement (); }},
      'decrement'
    )
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
     ({lastAction: 'MOCK', count: 43});
});

test ('combineCycles', function() {
  var main = combineCycles ([mockCycle]);
  eq (typeof main) ('function');
  var sinks = main ({state: Stream.of (42)});
  eq (typeof sinks) ('object');
  eq (typeof sinks.state) ('object');
  eq (sinks.state instanceof Stream) (true);
  return new Promise (function(res, rej) {
    var value;
    sinks.state.addListener ({
      error: rej,
      next: function(_value) { value = _value; },
      complete: function() {
        eq (value) (42);
        res ();
      }
    });
  });
});

test ('collectChanges', function() {
  var changes = collectChanges ([
    {reducer: mockReducer, effects: mockCycle},
    {reducer: mockReducerCount},
    {}
  ]);

  eq (typeof changes) ('object');
  eq (changes.reducers) ([mockReducer, mockReducerCount]);
  eq (changes.effects) ([mockCycle]);
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
  var PartlyWarped = warped ({reducer: mockReducer}) (null);
  var Warped = warped ({
    reducer: mockReducerCount,
    effects: combineCycles ([mockCycle, actionAllCycle]),
    selectors: {text: mockSelector},
    actions: {
      increment: function() { return mockAction (1); },
      decrement: function() { return mockAction (-1); }
    }
  }) (MockComponent);

  eq (Warped.displayName) ('Connect(Collecting(MockComponent))');
  eq (PartlyWarped.displayName) ('Collecting(<Null>)');

  var renderer = render (
    el (WarpedApp, {initialState: {count: 0}}, (
      el (Warped, {foo: 'bar'})
    ))
  );

  var mockComponent = renderer.root.findByType (MockComponent);

  eq (mockComponent.props.text) ('0');
  eq (typeof mockComponent.props.increment) ('function');
  eq (mockComponent.parent.type.displayName) ('CollectorManager(MockComponent)');

  return wait (40).then (function() {
    mockComponent.find ((a) => a.children[0] === 'increment').props.onClick ();
    eq (mockComponent.props.text) ('1');
    mockComponent.find ((a) => a.children[0] === 'decrement').props.onClick ();
    eq (mockComponent.props.text) ('0');
    renderer.unmount ();
  });

});
