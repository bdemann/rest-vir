import {assert} from '@augment-vir/assert';
import {type IsEqual, type IsNever} from 'type-fest';
import {type NoParam} from '../util/no-param.js';

/**
 * Extracts all named path parameters from an endpoint path.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type NamedPathParams<EndpointPath extends string> = string extends EndpointPath
    ? string
    : EndpointPath extends `${string}:${infer Param}/${infer Rest}`
      ? Param | NamedPathParams<`/${Rest}`>
      : EndpointPath extends `${string}:${infer Param}`
        ? Param
        : IsEqual<`/${string}`, EndpointPath> extends true
          ? string
          : never;

/**
 * Determines if the given endpoint path has a trailing wildcard.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type HasWildcardParam<EndpointPath extends string> = string extends EndpointPath
    ? boolean
    : EndpointPath extends `${string}/*`
      ? true
      : IsEqual<`/${string}`, EndpointPath> extends true
        ? boolean
        : false;

/**
 * Extracts named and wildcard path params.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type PathParams<EndpointPath extends string> = {
    namedParams: NamedPathParams<EndpointPath>;
    hasWildcard: HasWildcardParam<EndpointPath>;
};

export type GenericPathParams = {
    pathParams: Readonly<Record<string, string>>;
    wildcard: string | undefined;
};

/**
 * Resolves the wildcard portion of path params. Extracted to avoid re-evaluating `HasWildcardParam`
 * multiple times inside {@link ConstructPathParams}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type ResolveWildcard<HasWildcard extends boolean> = [HasWildcard] extends [true]
    ? Readonly<{
          wildcard: string;
      }>
    : [HasWildcard] extends [false]
      ? Readonly<{
            wildcard?: undefined;
        }>
      : Readonly<{
            wildcard?: string | undefined;
        }>;

/**
 * Resolves the pathParams portion of path params. Extracted to avoid re-evaluating
 * `NamedPathParams` multiple times inside {@link ConstructPathParams}.
 *
 * Tuple wrapping (`[Named] extends [string]`) prevents distributive conditional behavior so that a
 * union like `'a' | 'b'` produces a single `Record<'a' | 'b', string>` instead of `Record<'a',
 * string> | Record<'b', string>`.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type ResolveNamedParams<Named extends string> =
    IsNever<Named> extends true
        ? Readonly<{
              pathParams?: undefined;
          }>
        : [Named] extends [string]
          ? Readonly<{
                pathParams: Readonly<Record<Named, string>>;
            }>
          : Readonly<{
                pathParams?: undefined;
            }>;

/**
 * Converts an endpoint path into the fetch params needed for its to operate.
 *
 * Fast-paths simple paths (no `:` or `/*`) to avoid recursive template literal parsing.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type ConstructPathParams<EndpointPath extends string | NoParam> =
    EndpointPath extends NoParam
        ? GenericPathParams
        : Exclude<EndpointPath, NoParam> extends infer Path extends string
          ? Path extends `${string}:${string}` | `${string}/*`
              ? ResolveWildcard<HasWildcardParam<Path>> & ResolveNamedParams<NamedPathParams<Path>>
              : /**
                 * Guard against generic pattern types like `/${string}` which don't match the literal param
                 * patterns above but still need full evaluation.
                 */
                IsEqual<`/${string}`, Path> extends true
                ? ResolveWildcard<HasWildcardParam<Path>> &
                      ResolveNamedParams<NamedPathParams<Path>>
                : /** Fast path: concrete literal with no `:param` or `/*` segments. */
                  Readonly<{
                      wildcard?: undefined;
                      pathParams?: undefined;
                  }>
          : GenericPathParams;

/**
 * Base requirement for endpoint paths.
 *
 * Note that this whole thing should be lowercase. Technically, we should use `Lowercase<string>`
 * because of that. However, that makes the type requirements way too strict and hard to deal with.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type EndpointPathBase = `/${string}` | '/';

/**
 * Asserts that the given endpoint or WebSocket path is valid.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export function assertValidEndpointPath(path: string) {
    if (path !== '/') {
        assert.startsWith(path, '/', 'Path does not start with /');
        assert.endsWithout(path, '/', 'Path cannot end with /');
    }
}
