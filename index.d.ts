import * as react from 'react';
import * as redux from 'redux';
import {Stream} from 'xstream';
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
type StrMap<T> = Record<string, T>;

export type Selector<TState> = (state: TState) => any;
export type Selectors<TState> = StrMap<Selector<TState>>;
export type ActionCreator<TPayload> = (
  payload: TPayload,
) => StandardAction<TPayload>;

export interface StandardAction<TPayload> {
  type: string; payload: TPayload;
}

/** Utility to retrieve a payload type from an ActionCreator */
export type PayloadType<T extends ActionCreator<any>>
  = T extends ActionCreator<infer P> ? P : any;

/** Obtain the injected props of a partially-applied `warped` function */
export type Warped<W extends ComponentWarper<any>>
  = W extends ComponentWarper<infer P> ? P : any;

export interface ActionSource<TPayloads> {
  select<P extends TPayloads>(handler: {
    type: string;
    action?: ActionCreator<P>;
  }): Stream<{
    type: string;
    payload: P;
  }>;
  all(): Stream<{type: string; payload: TPayloads}>;
}

type GetProps<C extends react.ComponentType<any>> =
  C extends react.ComponentType<infer P> ? P : never;

type ComponentWarper<P> = <C extends react.ComponentType<P & GetProps<C>>>(component: C) =>
    react.ComponentType<JSX.LibraryManagedAttributes<C, Omit<GetProps<C>, keyof P>>>;

/* Utilities for warped() */

type CycleMain<So extends StrMap<any>, Si extends StrMap<Stream<any>>> = (sources: So) => Si;

export interface WarpedSources<TState, TPayloads> {
  action: ActionSource<TPayloads>;
  state: Stream<TState>;
}

type WarpedProps<A extends StrMap<ActionCreator<any>>, S extends Selectors<any>> =
  {[Ka in keyof A]: A[Ka]} & {[Ks in keyof S]: ReturnType<S[Ks]>};

/**
 * Associates a Redux reducer and a Cycle application with a Component
 * and connects it to the state using the given selectors and actions.
 *
 * See https://github.com/wearereasonablepeople/warped-components#warped
 *
 * @param options.reducer A Redux reducer - a function which takes a state and an
 *  action, and returns a new state. Warped Components makes sure that
 *  whenever the connected component is mounted, this reducer will act as
 *  part of the reducers of your store.
 * @param options.selectors An object whose keys correspond to properties, and values
 * are functions that receive the state and return the value for the
 * property.
 * @param options.actions A hash-map of action creators. The underlying component will
 * receive them as props, and when called, the resulting action is
 * dispatched to the store.
 * @param options.effects A Cycle application - a function which takes a mapping of
 *  stream / stream-producers, and returns a mapping of streams.
 */
export interface WarpedFn {
  <TState>(options: {
    reducer: redux.Reducer<TState>;
    effects: CycleMain<any, any>;
  }): (component: null) => react.ComponentType;

  <TState, S extends Selectors<TState>, A extends StrMap<ActionCreator<any>>>(options: {
    reducer?: redux.Reducer<TState, StandardAction<PayloadType<A[keyof A]>>>;
    selectors: S;
    actions: A;
    effects?: CycleMain<WarpedSources<TState, PayloadType<A[keyof A]>>, any>;
  }): ComponentWarper<WarpedProps<A, S>>;
}

export declare const warped: WarpedFn;

/**
 * This component does the wiring for your application:
 *
 * - Setting up your Redux store, and swapping out its `reducer` as needed.
 * - Setting up your Cycle application, and swapping out its `main` as needed.
 * - Linking the Redux Store and Cycle apps by adding two drivers:
 *   1. `state`: A read-only driver exposing a memory stream of the latest
 *    Redux state.
 *   2. `action`: A read-write driver exposing a stream of dispatched
 *    actions and allowing other actions to be dispatched.
 *
 * See https://github.com/wearereasonablepeople/warped-components#WarpedApp
 */
export declare const WarpedApp: react.SFC<{
  initialState?: any;
  enhancer?: redux.StoreEnhancer;
  drivers?: StrMap<Driver<Stream<any>, any>>;
}>;

/**
 * Given a mapping of selectors, returns a `mapStateToProps` function, as
 * accepted by `connect` from React Redux.
 * See https://github.com/wearereasonablepeople/warped-components#compileSelectors
 */
export declare function compileSelectors<TState, S extends Selectors<TState>>(selectors: S):
  (state: TState, prevProps: any) => {[K in keyof S]: ReturnType<S[K]>};

/**
 * Given a mapping of action creators, as returned from
 * {@link createReducer}, returns a `mapDispatchToProps` function,
 * as accepted by `connect` from React Redux.
 * See https://github.com/wearereasonablepeople/warped-components#compileDispatchers
 */
export declare function compileDispatchers<T extends StrMap<any>>(actions: T):
  (dispatch: (...args: any[]) => any) => {[K in keyof T]: T[K]};

/**
 * Given an array of reducers, returns a single reducer which transforms the
 * state by calling all reducers in sequence.
 * See https://github.com/wearereasonablepeople/warped-components#combineReducers
 */
export declare function combineReducers<T>(reducers: [redux.Reducer<T>]):
  redux.Reducer<T>;

type Driver<Si , So> = (stream: Si, driverName?: string) => So;

/** Obtain the return types from a map of functions */
export type ReturnTypes<T extends StrMap<(...args: any[]) => any>> = {
  [K in keyof T]: ReturnType<T[K]>
};

/**
 * Given an array of `main` functions that take sources and return sinks,
 * returns a single `main` function which combines the effects of each.
 * See https://github.com/wearereasonablepeople/warped-components#compileCycles
 */
export declare function combineCycles<
  So extends StrMap<any>,
  Si extends StrMap<Stream<any>>,
  mainSinks extends Si,
>(mains: Array<(sources: So) => Partial<Si>>): CycleMain<So, Si>;
