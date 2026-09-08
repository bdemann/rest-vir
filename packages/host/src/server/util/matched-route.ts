import {omitObjectKeys} from '@augment-vir/common';
import {type BaseRoutePath} from '@rest-vir/api';
import {searchParamsToString, UrlEncoding} from 'url-vir';
import {type ServerRequest} from '../../implementation/raw-route-data.js';

/**
 * Identifies the route that `attachApi` registered with Fastify. Stashed on each route's Fastify
 * config at registration time so later lifecycle steps can recover the route path from Fastify's
 * own match instead of running a second router over the URL.
 *
 * `attachApi` can be called more than once on the same Fastify instance, so the attach id records
 * which attachment owns the route. A step belonging to a different attachment must treat the route
 * as none of its business.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type RestVirRouteConfig = {
    attachId: string;
    routePath: BaseRoutePath;
};

/**
 * The route path Fastify matched this request to, or `undefined` when the request went to a route
 * that the given `attachApi` call did not register.
 *
 * Fastify has already run its router by the time any request hook fires, so this reads that result
 * rather than deciding again. Matching the URL a second time is what allowed the two routers to
 * disagree: Fastify accepts spellings like a percent-encoded character inside a static segment
 * (`/some-route/%73tuff`) and an empty path parameter (`/user/`), and a second matcher that rejects
 * them leaves the request dispatched but without a context.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export function extractMatchedRoutePath(
    this: void,
    {
        request,
        attachId,
    }: Readonly<{
        request: Readonly<ServerRequest>;
        attachId: string;
    }>,
): BaseRoutePath | undefined {
    const routeConfig = request.routeOptions.config.restVirRoute;

    if (!routeConfig || routeConfig.attachId !== attachId) {
        return undefined;
    }

    return routeConfig.routePath;
}

/**
 * The route path that error messages should name for this request, with each search param listed in
 * `excludedSearchParams` omitted from its search string.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export function extractErrorRoutePath(
    this: void,
    {
        request,
        attachId,
        excludedSearchParams,
    }: Readonly<{
        request: Readonly<ServerRequest>;
        attachId: string;
        excludedSearchParams?: ReadonlyArray<string> | undefined;
    }>,
): string {
    const routePath =
        extractMatchedRoutePath({
            request,
            attachId,
        }) ||
        request.routeOptions.url ||
        '<unknown route>';

    const keptSearchParams = omitObjectKeys(
        (request.query || {}) as Readonly<Record<string, string | string[]>>,
        excludedSearchParams || [],
    );

    /**
     * Fastify hands over already-decoded search param values, so encode them on the way back out:
     * that escapes any CR/LF an attacker smuggled through the query string, which would otherwise
     * let a request forge whole log entries.
     */
    return `${routePath}${searchParamsToString(keptSearchParams, {
        encoding: UrlEncoding.Encode,
    })}`;
}
