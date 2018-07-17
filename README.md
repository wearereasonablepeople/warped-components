# Warped Components

[![Build Status](https://travis-ci.com/wearereasonablepeople/warped-components.svg?branch=master)](https://travis-ci.com/wearereasonablepeople/warped-components)

An opinionated alternative to react-redux.

Works nicely with [Warped Reducers][1].

Usage in Node depends on `--experimental-modules`.
With older Node versions, use [`esm`][2].

## API

#### <a name="connect" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.1.1/index.mjs#L67">`connect :: ConnectOptions -⁠> ReactComponent -⁠> ReactComponent`</a>

Connects a component and its associated reducer to the store, using the
given options to map the state to component properties. All options are
optional.

The options are:

* `selectors`: An object whose keys correspond to properties, and values
  are functions that receive the state and return the value for the
  property.
* `actions`: A hashmap of action creators. The underlying component will
  receive them as props, and when called, the resuling action is
  dispatched to the store.
* `reducer`: A Redux reducer - a function which takes a state and an
  action, and returns a new state. Warped Components makes sure than
  whenever the connected component is mounted, this reducer will act as
  part of the reducers of your store.

If you would like a reducer to be mounted without a "view", for example
when a reducer is in change of handling some state shared between multiple
components, then pass `null` as the ReactComponent. The returned
ReactComponent can be rendered anywhere in the tree to have its reducer be
mounted.

```js
import {connect} from 'warped-components';

const MyComponent = ({stuff, setStuff}) => (
  <div>
    <span>{stuff}</span>
    <button onClick={() => setStuff (`${stuff}!`)}>exclaim</button>
  </div>
);

const MyConnectedComponent = connect ({
  selectors: {
    stuff: state => state.stuff
  },
  actions: {
    getStuff: payload => ({type: 'SET_STUFF', payload})
  },
  reducer: (state, {type, payload}) => (
    type === 'SET_STUFF' ? ({...state, stuff: payload}) : state
  )
}) (MyComponent);
```

For the definition of `actions` and `reducer`, we recommend using
[Warped Reducers][1], and for the definition of the selectors, we highly
recommend using an Optics library like [Ramda][3]'s `lens` related
functions or [partial.lenses][4].

#### <a name="Provider" href="https://github.com/wearereasonablepeople/warped-components/blob/v0.1.1/index.mjs#L197">`Provider :: ReactComponent`</a>

This component wraps your tree and ensures that any connected children will
be able to read from the store.

Expects a single property `store` - the Redux store.

Note that the reducer given to the store is automatically replaced after
the first render with the set of reducers associated with the currently
mounted connected components. Most of the time, you can just use `identity`
as the initial reducer.

```jsx
import {render} from 'react-dom';
import {Provider} from 'warped-components';
import {createStore} from 'redux';
import App from './my-app';

const store = createStore (x => x);

render (
  <Provider store={store}><App /></Provider>,
  document.getElementById ('app')
);
```

[1]: https://github.com/wearereasonablepeople/warped-reducers
[2]: https://github.com/standard-things/esm
[3]: http://ramdajs.com/
[4]: https://github.com/calmm-js/partial.lenses
