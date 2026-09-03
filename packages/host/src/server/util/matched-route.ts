import {type BaseRoutePath} from '@rest-vir/api';
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
 * Used when not even Fastify has a route template to report, which shouldn't be reachable from any
 * request hook (Fastify's router has already run by then) but keeps the error message honest
 * instead of printing `'undefined'`.
 *
 * @category Internal
 */
const unknownRoutePath = '<unknown route>';

/**
 * The route template to name in an error message for this request.
 *
 * Deliberately never `request.originalUrl`: that carries the query string, which may hold tokens,
 * auth params, or signed-URL signatures, and error messages get forwarded to error trackers and
 * other third parties far more readily than logs do. The route template is what makes an error
 * findable anyway; the query adds nothing a responder uses. This also drops any CR/LF an attacker
 * might smuggle into the URL.
 *
 * Prefers this attachment's own registered route path, then falls back to Fastify's matched route
 * template, which covers routes registered by a _different_ `attachApi` call (the
 * `@fastify/websocket` error handler is registered only once per Fastify instance, so it sees those
 * too).
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
    }: Readonly<{
        request: Readonly<ServerRequest>;
        attachId: string;
    }>,
): string {
    return (
        extractMatchedRoutePath({
            request,
            attachId,
        }) ||
        request.routeOptions.url ||
        unknownRoutePath
    );
}
