import { Observable } from 'rxjs';

export interface ITextInput {
    text: string; // plain text for matchers that use such things
}

export type Observizeable<T> = T | Observable<T> | Promise<T>

export interface MatchResult<T> {
    score: number;
    args: T;
}

export interface Matcher<S> {
    (input: S): Observizeable<MatchResult<any>>; // When we have default generics the result will be typed
}

export interface Action<S> {
    (input: S, args?: any): Observizeable<any>; // When we have default generics the args & result will be typed
}

export interface Match {
    score: number,
    action: () => Observizeable<any>;
}

export interface Rule<S> {
    (input: S): Observizeable<Match>;
}

// export const defaultRule = <S>(action: Action<S>): Rule<S> => (input: S) => action(input);

export const arrayize = <T>(stuff: T | T[]) => Array.isArray(stuff) ? stuff : [stuff];

export const observize = <T>(t: Observizeable<T>) => {
    if (t instanceof Observable)
        return t;
    if (t instanceof Promise)
        return Observable.fromPromise<T>(t)
    return Observable.of(t)
}

export const rule = <S>(matcher: Matcher<S>, action: Action<S>): Rule<S> => (input) => 
    observize(matcher(input))
    .do(result => console.log("matcher result", result))
    .filter(result => result !== undefined && result !== null)
    .map(args => ({
        score: args.score,
        action: () => {
            console.log(`resolving action`);

            return observize(action(input, args))
            .do(result => console.log("action result", result))
            .take(1) // because actions may emit more than one value
        }
    } as Match));

export const doRule = <S>(input: S, rule: Rule<S>) =>
    observize(rule(input))
    .flatMap(match => observize(match.action()));

export const firstMatch$ = <S>(rule$: Observable<Rule<S>>): Rule<S> => (input) => 
    rule$
    .do(_ => console.log("firstMatch: trying rule"))
    .switchMap(rule => observize(rule(input)))
    .take(1); // so that we don't keep going through rules

export const firstMatch = <S>(... rules: Rule<S>[]): Rule<S> => (input) =>
    firstMatch$(Observable.from(rules))(input);

export const bestMatch$ = <S>(rule$: Observable<Rule<S>>) => (input) => 
    rule$
    .do(_ => console.log("bestMatch$: trying rule"))
    .flatMap(rule => observize(rule(input)))
    .takeWhile(match => match.score !== 1)
    .reduce<Match>((prev, current) => prev && prev.score > current.score ? prev : current);
    // TODO: don't call reduce if current.score === 1

export const bestMatch = <S>(... rules: Rule<S>[]) => (input) => 
    bestMatch$(Observable.from(rules))(input);

export interface Query<S> {
    (input: S): Observizeable<boolean>;
}

export interface Queries<S> {
    [name: string]: Query<S>
}

export const filter = <S>(query: Query<S>, rule: Rule<S>): Rule<S> => (input) => 
    observize(query(input))
    .filter(result => !!result)
    .flatMap(_ => observize(rule(input)));
