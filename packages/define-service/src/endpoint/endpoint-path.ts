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
 * Converts an endpoint path into the fetch params needed for its to operate.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type ConstructPathParams<EndpointPath extends string | NoParam> =
    EndpointPath extends NoParam
        ? GenericPathParams
        : (IsEqual<PathParams<Exclude<EndpointPath, NoParam>>['hasWildcard'], true> extends true
              ? Readonly<{
                    wildcard: string;
                }>
              : IsEqual<
                      PathParams<Exclude<EndpointPath, NoParam>>['hasWildcard'],
                      false
                  > extends true
                ? Readonly<{
                      wildcard?: undefined;
                  }>
                : Readonly<{
                      wildcard?: string | undefined;
                  }>) &
              (IsNever<PathParams<Exclude<EndpointPath, NoParam>>['namedParams']> extends true
                  ? Readonly<{
                        pathParams?: undefined;
                    }>
                  : PathParams<Exclude<EndpointPath, NoParam>>['namedParams'] extends string
                    ? Readonly<{
                          pathParams: Readonly<
                              Record<
                                  PathParams<Exclude<EndpointPath, NoParam>>['namedParams'],
                                  string
                              >
                          >;
                      }>
                    : Readonly<{
                          pathParams?: undefined;
                      }>);

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
