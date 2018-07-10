//. # Warped Components
//.
//. [![Build Status](https://travis-ci.com/wearereasonablepeople/warped-components.svg?branch=master)](https://travis-ci.com/wearereasonablepeople/warped-components)
//.
//. An opinionated alternative to react-redux.
//.
//. Works nicely with [Warped Reducers][1].
//.
//. Usage in Node depends on `--experimental-modules`.
//. With older Node versions, use [`esm`][2].

import PropTypes from 'prop-types';
import React from 'react';

var Component = React.Component;
var createElement = React.createElement;

var Consumer = React.createContext ();

// identity :: a -> a
export function identity(x) {
  return x;
}

// getComponentName :: ReactComponent? -> String
export function getComponentName(Component) {
  return Component == null ?
         '<Null>' :
         (Component.displayName || Component.name || '<Anonymous>');
}

// compileSelectors :: StrMap ((a, b) -> c) -> (a, b) -> StrMap c
export function compileSelectors(selectors) {
  return function mapStateToProps(state, prevProps) {
    const props = Object.create (null);
    Object.entries (selectors).forEach (function(entry) {
      props[entry[0]] = entry[1] (state, prevProps);
    });
    return props;
  };
}

// compileDispatchers :: StrMap (a -> b) -> (b -> c) -> StrMap (a -> c)
export function compileDispatchers(actions) {
  return function mapDispatchToProps(dispatch) {
    const props = Object.create (null);
    Object.entries (actions).forEach (function(entry) {
      props[entry[0]] = function dispatchAction(payload) {
        return dispatch (entry[1] (payload));
      };
    });
    return props;
  };
}

// combineReducers :: Array ((a, b) -> a) -> (a, b) -> a
export function combineReducers(reducers) {
  return function rootReducer(rootState, action) {
    return reducers.reduce (function reduceReducers(state, reducer) {
      return reducer (state, action);
    }, rootState);
  };
}

//. ## API
//.
//# connect :: ConnectOptions -> ReactComponent -> ReactComponent
//.
//. Connects a component and its associated reducer to the store, using the
//. given options to map the state to component properties. All options are
//. optional.
//.
//. The options are:
//.
//. * `selectors`: An object whose keys correspond to properties, and values
//.   are functions that receive the state and return the value for the
//.   property.
//. * `actions`: A hashmap of action creators. The underlying component will
//.   receive them as props, and when called, the resuling action is
//.   dispatched to the store.
//. * `reducer`: A Redux reducer - a function which takes a state and an
//.   action, and returns a new state. Warped Components makes sure than
//.   whenever the connected component is mounted, this reducer will act as
//.   part of the reducers of your store.
//.
//. If you would like a reducer to be mounted without a "view", for example
//. when a reducer is in change of handling some state shared between multiple
//. components, then pass `null` as the ReactComponent. The returned
//. ReactComponent can be rendered anywhere in the tree to have its reducer be
//. mounted.
//.
//. ```js
//. import {connect} from 'warped-components';
//.
//. const MyComponent = ({stuff, setStuff}) => (
//.   <div>
//.     <span>{stuff}</span>
//.     <button onClick={() => setStuff (`${stuff}!`)}>exclaim</button>
//.   </div>
//. );
//.
//. const MyConnectedComponent = connect ({
//.   selectors: {
//.     stuff: state => state.stuff
//.   },
//.   actions: {
//.     getStuff: payload => ({type: 'SET_STUFF', payload})
//.   },
//.   reducer: (state, {type, payload}) => (
//.     type === 'SET_STUFF' ? ({...state, stuff: payload}) : state
//.   )
//. }) (MyComponent);
//. ```
//.
//. For the definition of `actions` and `reducer`, we recommend using
//. [Warped Reducers][1], and for the definition of the selectors, we highly
//. recommend using an Optics library like [Ramda][3]'s `lens` related
//. functions or [partial.lenses][4].
export function connect(def) {
  var selectors = def.selectors || {};
  var actions = def.actions || {};
  var reducer = def.reducer || identity;

  var mapState = compileSelectors (selectors);
  var mapDispatch = compileDispatchers (actions);

  function ReducerManager(props) {
    Component.call (this, props);

    var self = this;
    var dispatchers = mapDispatch (dispatch);

    props.addReducer (reducer);
    this.state = computeState ();
    self.unsubscribe = self.props.store.subscribe (setComputedState);

    function computeState() {
      var state = self.props.store.getState ();
      return Object.assign (
        {},
        dispatchers,
        mapState (state),
        self.props.props
      );
    }

    function setComputedState() {
      self.setState (computeState ());
    }

    function dispatch(action) {
      self.props.store.dispatch (action);
    }
  }

  ReducerManager.prototype = Object.create (Component.prototype);

  ReducerManager.prototype.componentWillUnmount = function() {
    this.props.removeReducer (reducer);
    this.unsubscribe ();
  };

  return function(UserComponent) {

    var name = getComponentName (UserComponent);

    function WarpedManager(props) {
      ReducerManager.call (this, props);
    }

    WarpedManager.prototype = Object.create (ReducerManager.prototype);

    WarpedManager.prototype.render = function() {
      return UserComponent && createElement (UserComponent, this.state);
    };

    WarpedManager.displayName = 'WarpedManager(' + name + ')';

    function WarpedComponent(props) {
      return createElement (Consumer, {}, function(context) {
        return createElement (WarpedManager, {
          props: props,
          store: context.store,
          addReducer: context.addReducer,
          removeReducer: context.removeReducer
        });
      });
    }

    WarpedComponent.displayName = 'WarpedComponent(' + name + ')';

    return WarpedComponent;

  };
}

//# Provider :: ReactComponent
//.
//. This component wraps your tree and ensures that any connected children will
//. be able to read from the store.
//.
//. Expects a single property `store` - the Redux store.
//.
//. Note that the reducer given to the store is automatically replaced after
//. the first render with the set of reducers associated with the currently
//. mounted connected components. Most of the time, you can just use `identity`
//. as the initial reducer.
//.
//. ```jsx
//. import {render} from 'react-dom';
//. import {Provider} from 'warped-components';
//. import {createStore} from 'redux';
//. import App from './my-app';
//.
//. const store = createStore (x => x);
//.
//. render (
//.   <Provider store={store}><App /></Provider>,
//.   document.getElementById ('app')
//. );
//. ```
export function Provider(props) {
  Component.call (this, props);
  this.reducers = new Set ();
}

Provider.prototype = Object.create (Component.prototype);

Provider.prototype.addReducer = function(reducer) {
  if (!this.reducers.has (reducer)) {
    this.reducers.add (reducer);
    this.forceUpdate ();
  }
};

Provider.prototype.removeReducer = function(reducer) {
  if (this.reducers.has (reducer)) {
    this.reducers.delete (reducer);
    this.forceUpdate ();
  }
};

Provider.prototype.componentDidUpdate = function() {
  this.props.store.replaceReducer (
    combineReducers (Array.from (this.reducers))
  );
};

Provider.prototype.componentWillUnmount = function() {
  this.props.store.replaceReducer (identity);
};

Provider.prototype.render = function() {
  return createElement (
    Consumer.Provider,
    {value: {
      store: this.props.store,
      addReducer: this.addReducer.bind (this),
      removeReducer: this.removeReducer.bind (this)
    }},
    this.props.children
  );
};

Provider.propTypes = {
  children: PropTypes.node.isRequired,
  store: PropTypes.shape ({
    getState: PropTypes.func.isRequired,
    dispatch: PropTypes.func.isRequired,
    subscribe: PropTypes.func.isRequired,
    replaceReducer: PropTypes.func.isRequired
  }).isRequired
};

//. [1]: https://github.com/wearereasonablepeople/warped-reducers
//. [2]: https://github.com/standard-things/esm
//. [3]: http://ramdajs.com/
//. [4]: https://github.com/calmm-js/partial.lenses
