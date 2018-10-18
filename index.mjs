//. # Warped Components
//.
//. [![Build Status](https://travis-ci.com/wearereasonablepeople/warped-components.svg?branch=master)](https://travis-ci.com/wearereasonablepeople/warped-components)
//. [![Greenkeeper Enabled](https://badges.greenkeeper.io/wearereasonablepeople/warped-components.svg)](https://greenkeeper.io/)
//.
//. An opinionated way to build frontend applications.
//. Works nicely with [Warped Reducers][1].
//.
//. ```console
//. $ npm install --save warped-components react xstream
//. ```
//.
//. ## In a nutshell
//.
//. - The view is handled by React.
//. - The state is handled by Redux.
//. - The effects are handled by Cycle with XStream.
//. - The wiring is handled by Warped Components.
//.
//. Warped Components does two things to facilitate your application:
//.
//. 1. It manages the creation of your Redux store, and uses [React Redux][5]
//.    to connect your components to the global state. But instead of taking
//.    `mapStateToProps` and `mapDispatchToProps` functions, it takes
//.    a `selectors` object whose values are functions that map the state to
//.    individual properties, and an `actions` object whose values are
//.    functions that given a payload, return a Redux Standard Action.
//. 1. It lets you associate your Cycle applications and Redux reducers with
//.    specific React components. Then, whenever React renders those
//.    components, Warped Components will update the global Redux reducer to
//.    contain only the reducers found in the tree, and it will shut down and
//.    start up the appropriate Cycle applications based on which are present
//.    in the tree. All of this is achieved by using [React Collect][2].
//.
//. This approach has the following benefits:
//.
//. 1. An architectural benefit, where all the logic related to a component,
//.    including asynchronous side-effects and state transformations, are all
//.    kept in a single place. This means that most changes to the application
//.    will be centred around a single directory in your source code.
//. 1. If you use code-splitting and multiple entry points, this approach
//.    facilitates a smaller main bundle, because the reducers and effects for
//.    components outside of the initial render tree don't have to be included.
//. 1. Your Redux reducers and Cycle applications are "hot by design". This
//.    means that if you use `module.hot`, your reducer logic and side-effect
//.    logic is also automatically hot-reloaded (given that you don't remount
//.    the WarpedApp, but only its children).

import React from 'react';
import Redux from 'redux';
import ReactRedux from 'react-redux';
import xstream from 'xstream';
import {Collector, collect} from 'react-collect';
import Cycle from '@cycle/run';

var Stream = xstream.Stream;
var Provider = ReactRedux.Provider;
var connect = ReactRedux.connect;

// compose :: (b -> c, a -> b) -> a -> c
export function compose(f, g) {
  return function(x) {
    return f (g (x));
  };
}

// identity :: a -> a
export function identity(x) {
  return x;
}

// thrush :: a -> (a -> b) -> b
export function thrush(x) {
  return function(f) {
    return f (x);
  };
}

// collectChanges :: Array { reducer? :: (a, Action) -> a,
//                           effects? :: StrMap Any -> StrMap Stream }
//                ->       { reducers :: Array ((a, Action) -> a),
//                           effects :: Array (StrMap Any -> StrMap Stream) }
export function collectChanges(collection) {
  var reducers = [];
  var effects = [];
  for (var idx = 0; idx < collection.length; idx += 1) {
    if (collection[idx].reducer) reducers.push (collection[idx].reducer);
    if (collection[idx].effects) effects.push (collection[idx].effects);
  }
  return {reducers: reducers, effects: effects};
}

// makeStateDriver :: ReduxStore -> () -> Stream
export function makeStateDriver(store) {
  return function stateDriver() {
    var unsubscribe = identity;
    return Stream.createWithMemory ({
      start: function(listener) {
        unsubscribe = store.subscribe (function() {
          listener.next (store.getState ());
        });
      },
      stop: function() {
        unsubscribe ();
      }
    });
  };
}

//. ## API
//.
//. ### Automatic wiring
//.
//# warped :: WarpedOptions -> ReactComponent -> ReactComponent
//.
//. Does zero to two distinct things to a component, depending on the options:
//.
//. - Connects it to the state using the given selectors and actions.
//. - Associates a Redux reducer and a Cycle application with the component.
//.
//. The options (all optional, though at least one should be provided) are:
//.
//. * `selectors`: An object whose keys correspond to properties, and values
//.   are functions that receive the state and return the value for the
//.   property.
//. * `actions`: A hash-map of action creators. The underlying component will
//.   receive them as props, and when called, the resulting action is
//.   dispatched to the store.
//. * `reducer`: A Redux reducer - a function which takes a state and an
//.   action, and returns a new state. Warped Components makes sure that
//.   whenever the connected component is mounted, this reducer will act as
//.   part of the reducers of your store.
//. * `effects`: A Cycle application - a function which takes a mapping of
//.   stream / stream-producers, and returns a mapping of streams.
//.
//. If you would just like the reducer or effects to be mounted without a
//. "view", for example when a reducer is in change of handling some state
//. shared between multiple components, then pass `null` as the ReactComponent.
//. The returned ReactComponent can still be rendered anywhere in the tree to
//. have its reducer and/or effects be mounted.
//.
//. For the definition of `actions` and `reducer`, we recommend using
//. [Warped Reducers][1], and for the definition of the selectors, we highly
//. recommend using an Optics library like [Ramda][3]'s `lens` related
//. functions or [partial.lenses][4].
//.
//. ```js
//. import {warped} from 'warped-components';
//. import {createReducer, noopAction} from 'warped-reducers';
//. import {lensProp, compose, set, view} from 'ramda';
//. import React from 'react';
//.
//. // We use a lens to describe our slice of the global state.
//. // How you do it is up to you, though.
//. export const dataState = compose (
//.   lensProp ('app'),
//.   lensProp ('data')
//. );
//.
//. // We use warped-reducers to create our reducer and actions.
//. export const {types, actions, reducer} = createReducer ('App') ({
//.   loadData: noopAction,
//.   setData: set (dataState)
//. });
//.
//. // A small Cycle app describes the side-effects of our component.
//. export const effects = ({action, http}) => ({
//.   http: action.filter (({type}) => type === types.loadData).mapTo ({
//.     url: 'https://api.github.com/users/Avaq',
//.     category: types.loadData
//.   }),
//.   action: http.select (types.loadData).flatten ().map (({body: {name}}) =>
//.     actions.setData (name)
//.   )
//. });
//.
//. // The selectors are used to map the global state to component props.
//. export const selectors = {
//.   data: view (dataState)
//. };
//.
//. // This is our view.
//. export const App = ({data, loadData}) => (
//.   <div>
//.     <h1>{data || 'name unknown'}</h1>
//.     <button onClick={loadData}>Load!</button>
//.   </div>
//. );
//.
//. // Warped Components wires the view to all of the above.
//. export default warped ({reducer, effects, selectors, actions}) (App);
//. ```
export function warped(def) {
  var connector = (def.selectors || def.actions) ?
                  (connect (compileSelectors (def.selectors || {}),
                            compileDispatchers (def.actions || {}))) :
                  identity;

  var collector = (def.reducer || def.effects) ?
                  (collect ({reducer: def.reducer, effects: def.effects})) :
                  identity;

  return compose (connector, collector);
}

//# WarpedApp :: ReactComponent
//.
//. This component does the wiring for your application:
//.
//. * Setting up your Redux store, and swapping out its `reducer` as needed.
//. * Setting up your Cycle application, and swapping out its `main` as needed.
//. * Linking the Redux Store and Cycle apps by adding two drivers:
//.     1. `state`: A read-only driver exposing a memory stream of the latest
//.        Redux state.
//.     2. `action`: A read-write driver exposing a stream of dispatched
//.        actions and allowing other actions to be dispatched.
//.
//. It takes the following optional props:
//.
//. * `initialState`: Some initial state for your store.
//. * `enhancer`: Store enhancer, allows middleware, debug tooling, etcetera.
//. * `drivers`: Cycle drivers determine what kind of effects can occur.
//.
//. ```js
//. import {WarpedApp} from 'warped-components';
//. import {devToolsEnhancer} from 'redux-devtools-extension';
//. import {makeHTTPDriver} from '@cycle/http';
//. import {render} from 'react-dom';
//. import React from 'react';
//. import App from './my-app';
//.
//. const drivers = {http: makeHTTPDriver ()};
//.
//. render (
//.   <WarpedApp enhancer={devToolsEnhancer ()} drivers={drivers}>
//.     <App />
//.   </WarpedApp>,
//.   document.getElementById ('app')
//. );
//. ```
export function WarpedApp(props) {
  var self = this;
  React.Component.call (self, props);

  var action$ = Stream.never ();

  function onNext(action) {
    self.store.dispatch (action);
  }

  function actionDriver(sink$) {
    sink$.addListener ({next: onNext, error: identity, complete: identity});
    return {select: function select(handler) {
      var type = handler.type;
      return action$.filter (function(action) {
        return action.type === type;
      });
    }};
  }

  function cycleMiddleware() {
    return function(next) {
      return function(action) {
        var res = next (action);
        action$.shamefullySendNext (action);
        return res;
      };
    };
  }

  self.store = Redux.createStore (
    identity,
    props.initialState,
    compose (Redux.applyMiddleware (cycleMiddleware), props.enhancer)
  );

  self.drivers = {
    action: actionDriver,
    state: makeStateDriver (self.store)
  };

  self.cycle = Cycle.setupReusable (
    Object.assign ({}, props.drivers, self.drivers)
  );

  self.effects = new Map ();

  self.onChange = function(collection) {
    var result = collectChanges (collection);
    var newEffects = new Set (result.effects);
    self.store.replaceReducer (combineReducers (result.reducers));
    self.effects.forEach (function(dispose, main) {
      if (!newEffects.has (main)) {
        dispose ();
        self.effects.delete (main);
      }
    });
    newEffects.forEach (function(main) {
      if (!self.effects.has (main)) {
        self.effects.set (main, self.cycle.run (main (self.cycle.sources)));
      }
    });
  };
}

WarpedApp.prototype = Object.create (React.Component.prototype);

WarpedApp.prototype.componentWillUnmount = function() {
  this.effects.forEach (function(dispose) { dispose (); });
  this.effects.clear ();
  this.cycle.dispose ();
};

WarpedApp.prototype.render = function() {
  return React.createElement (Provider, {store: this.store}, (
    React.createElement (Collector, {onChange: this.onChange}, (
      this.props.children
    ))
  ));
};

WarpedApp.defaultProps = {
  enhancer: identity,
  drivers: {}
};

//. ### Redux Utilities
//.
//. If you prefer using [React Redux][5] and [Redux][6] directly, rather than
//. using the [`WarpedApp`](#WarpedApp), you can use these utilities to ease
//. the interaction with [Warped Reducers][1].
//.
//# compileSelectors :: StrMap ((a, b) -> c) -> (a, b) -> StrMap c
//.
//. Given a mapping of selectors, returns a `mapStateToProps` function, as
//. accepted by `connect` from React Redux.
//.
//. The selectors are given the state (and previous props), and are expected
//. to return a slice of the state. We recommend using Optics, such as the
//. `lens`-related functions from [Ramda][2], to create the selectors.
export function compileSelectors(selectors) {
  return function mapStateToProps(state, prevProps) {
    var props = {};
    Object.entries (selectors).forEach (function(entry) {
      props[entry[0]] = entry[1] (state, prevProps);
    });
    return props;
  };
}

//# compileDispatchers :: StrMap (a -> b) -> (b -> c) -> StrMap (a -> c)
//.
//. Given a mapping of action creators, as returned from
//. [createReducer](#createReducer), returns a `mapDispatchToProps` function,
//. as accepted by `connect` from React Redux.
export function compileDispatchers(actions) {
  return function mapDispatchToProps(dispatch) {
    var props = {};
    Object.entries (actions).forEach (function(entry) {
      props[entry[0]] = function dispatchAction(payload) {
        return dispatch (entry[1] (payload));
      };
    });
    return props;
  };
}

//# combineReducers :: Array ((a, b) -> a) -> (a, b) -> a
//.
//. Given an array of reducers, returns a single reducer which transforms the
//. state by calling all reducers in sequence.
export function combineReducers(reducers) {
  return function rootReducer(rootState, action) {
    return reducers.reduce (function reduceReducers(state, reducer) {
      return reducer (state, action);
    }, rootState);
  };
}

//. ### Cycle utilities
//.
//# combineCycles :: Array (StrMap Any -> StrMap Stream) -> StrMap Any -> StrMap Stream
//.
//. Given an array of `main` functions that take sources and return sinks,
//. returns a single `main` function which combines the effects of each.
export function combineCycles(mains) {
  return function main(sources) {
    return mains.map (thrush (sources)).reduce (function(prevSinks, sink) {
      var combined = Object.assign ({}, prevSinks);
      Object.keys (sink).forEach (function(driver) {
        combined[driver] = (combined[driver]) ?
                           (Stream.merge (combined[driver], sink[driver])) :
                           (sink[driver]);
      });
      return combined;
    }, {});
  };
}

//. [1]: https://github.com/wearereasonablepeople/warped-reducers
//. [2]: https://github.com/wearereasonablepeople/react-collect
//. [3]: http://ramdajs.com/
//. [4]: https://github.com/calmm-js/partial.lenses
//. [5]: https://github.com/reactjs/react-redux
//. [6]: http://redux.js.org/
