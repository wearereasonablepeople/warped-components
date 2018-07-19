# Warped Components

[![Build Status](https://travis-ci.com/wearereasonablepeople/warped-components.svg?branch=master)](https://travis-ci.com/wearereasonablepeople/warped-components)
[![Greenkeeper Enabled](https://badges.greenkeeper.io/wearereasonablepeople/warped-components.svg)](https://greenkeeper.io/)

An opinionated way to build frontend applications.
Works nicely with [Warped Reducers][1].

## In a nutshell

- The view is handled by React.
- The state is handled by Redux.
- The effects are handled by Cycle.
- The wiring is handled by Warped Components.

Warped Components does two things to facilitate your application:

1. It manages the creation of your Redux store, and uses [React Redux][5]
   to connect your components to the global state. But instead of taking
   `mapStateToProps` and `mapDispatchToProps` functions, it takes
   a `selectors` object whose values are functions that map the state to
   individual properties, and an `actions` object whose values are
   functions that given a payload, return a Redux Standard Action.
1. It lets you associate your Cycle applications and Redux reducers with
   specific React components. Then, whenever React renders those
   components, Warped Components will update the global Redux reducer to
   contain only the reducers found in the tree, and it will shut down and
   start up the appropriate Cycle applications based on which are present
   in the tree. All of this is achieved by using [React Collect][2].

This approach has the following benefits:

1. An architectural benefit, where all the logic related to a component,
   including asynchronous side-effects and state transformations, are all
   kept in a single place. This means that most changes to the application
   will be centred around a single directory in your source code.
1. If you use code-splitting and multiple entry points, this approach
   facilitates a smaller main bundle, because the reducers and effects for
   components outside of the initial render tree don't have to be included.
1. Your Redux reducers and Cycle applications are "hot by design". This
   means that if you use `module.hot`, your reducer logic and side-effect
   logic is also automatically hot-reloaded (given that you don't remount
   the WarpedApp, but only its children).

## API

### Automatic wiring

#### <a name="warped" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.2.3/index.mjs#L110">`warped :: WarpedOptions -⁠> ReactComponent -⁠> ReactComponent`</a>

Does zero to two distinct things to a component, depending on the options:

- Connects it to the state using the given selectors and actions.
- Associates a Redux reducer and a Cycle application with the component.

The options (all optional, though at least one should be provided) are:

* `selectors`: An object whose keys correspond to properties, and values
  are functions that receive the state and return the value for the
  property.
* `actions`: A hash-map of action creators. The underlying component will
  receive them as props, and when called, the resulting action is
  dispatched to the store.
* `reducer`: A Redux reducer - a function which takes a state and an
  action, and returns a new state. Warped Components makes sure than
  whenever the connected component is mounted, this reducer will act as
  part of the reducers of your store.
* `effects`: A Cycle application - a function which takes a mapping of
  stream / stream-producers, and returns a mapping of streams.

If you would just like the reducer or effects to be mounted without a
"view", for example when a reducer is in change of handling some state
shared between multiple components, then pass `null` as the ReactComponent.
The returned ReactComponent can still be rendered anywhere in the tree to
have its reducer and/or effects be mounted.

For the definition of `actions` and `reducer`, we recommend using
[Warped Reducers][1], and for the definition of the selectors, we highly
recommend using an Optics library like [Ramda][3]'s `lens` related
functions or [partial.lenses][4].

```js
import {warped} from 'warped-components';
import {createReducer, noopAction} from 'warped-reducers';
import {lensProp, compose, set, view} from 'ramda';

// We use a lens to describe our slice of the global state.
// How you do it is up to you, though.
export const dataState = compose (
  lensProp ('app'),
  lensProp ('data')
);

// We use warped-reducers to create our reducer and actions.
export const {types, actions, reducer} = createReducer ('App') ({
  loadData: noopAction,
  setData: set (dataState)
});

// A small Cycle app describes the side-effects of our component.
export const effects = ({action, http}) => ({
  http: action.filter (({type}) => type === types.loadData).mapTo ({
    url: 'https://api.github.com/users/Avaq',
    category: types.loadData
  }),
  action: http.select (types.loadData).flatten ().map (({name}) =>
    actions.setData (name)
  )
});

// The selectors are used to map the global state to component props.
export const selectors = {
  data: view (dataState)
};

// This is our view.
export const App = ({data, loadData}) => (
  <div>
    <h1>{data || 'name unknown'}</h1>
    <button onClick={loadData}>Load!</button>
  </div>
);

// Warped Components wires the view to all of the above.
export default warped ({reducer, effects, selectors, actions}) (App);
```

#### <a name="WarpedApp" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.2.3/index.mjs#L201">`WarpedApp :: ReactComponent`</a>

This component does the wiring for your application:

* Setting up your Redux store, and swapping out its `reducer` as needed.
* Setting up your Cycle application, and swapping out its `main` as needed.
* Linking the Redux Store and Cycle apps by adding two drivers:
    1. `state`: A read-only driver exposing a memory stream of the latest
       Redux state.
    2. `action`: A read-write driver exposing a stream of dispatched
       actions and allowing other actions to be dispatched.

It takes the following optional props:

* `initialState`: Some initial state for your store.
* `enhancer`: Store enhancer, allows middleware, debug tooling, etcetera.
* `drivers`: Cycle drivers determine what kind of effects can occur.

```js
import {WarpedApp} from 'warped-components';
import {devToolsEnhancer} from 'redux-devtools-extension';
import {makeHTTPDriver} from '@cycle/http';
import {render} from 'react-dom';
import App from './my-app';

const initialState = {some: 'state'};
const drivers = {http: makeHTTPDriver ()};

render (
  <WarpedApp enhancer={devToolsEnhancer} drivers={drivers}>
    <App />
  </WarpedApp>,
  document.findElementById ('app')
);
```

### Redux Utilities

If you prefer using [React Redux][5] and [Redux][6] directly, rather than
using the [`WarpedApp`](#WarpedApp), you can use these utilities to ease
the interaction with [Warped Reducers][1].

#### <a name="compileSelectors" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.2.3/index.mjs#L323">`compileSelectors :: StrMap ((a, b) -⁠> c) -⁠> (a, b) -⁠> StrMap c`</a>

Given a mapping of selectors, returns a `mapStateToProps` function, as
accepted by `connect` from React Redux.

The selectors are given the state (and previous props), and are expected
to return a slice of the state. We recommend using Optics, such as the
`lens`-related functions from [Ramda][2], to create the selectors.

#### <a name="compileDispatchers" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.2.3/index.mjs#L341">`compileDispatchers :: StrMap (a -⁠> b) -⁠> (b -⁠> c) -⁠> StrMap (a -⁠> c)`</a>

Given a mapping of action creators, as returned from
[createReducer](#createReducer), returns a `mapDispatchToProps` function,
as accepted by `connect` from React Redux.

#### <a name="combineReducers" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.2.3/index.mjs#L358">`combineReducers :: Array ((a, b) -⁠> a) -⁠> (a, b) -⁠> a`</a>

Given an array of reducers, returns a single reducer which transforms the
state by calling all reducers in sequence.

### Cycle utilities

#### <a name="combineCycles" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.2.3/index.mjs#L372">`combineCycles :: Array (StrMap Any -⁠> StrMap Stream) -⁠> StrMap Any -⁠> StrMap Stream`</a>

Given an array of `main` functions that take sources and return sinks,
returns a single `main` function which combines the effects of each.

[1]: https://github.com/wearereasonablepeople/warped-reducers
[2]: https://github.com/wearereasonablepeople/react-collect
[3]: http://ramdajs.com/
[4]: https://github.com/calmm-js/partial.lenses
[5]: https://github.com/reactjs/react-redux
[6]: http://redux.js.org/
