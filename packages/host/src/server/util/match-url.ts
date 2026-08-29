import {getObjectTypedKeys, type RequireAtLeastOne} from '@augment-vir/common';
import {type ApiDefinition, type BaseRoutePath} from '@rest-vir/api';
import Router, {type Handler, type HTTPMethod, type HTTPVersion} from 'find-my-way';

/**
 * `find-my-way` is Fastify's own router, and this reuses it rather than matching with a second
 * implementation. Any other matcher has to reproduce Fastify's URL handling exactly: which
 * percent-encoded spellings decode before the match, whether a trailing slash or a duplicated slash
 * still matches, whether a path parameter may be empty. Every one of those was a real disagreement
 * before this, and a request that Fastify routed but the second matcher rejected reached its
 * endpoint implementation with no request context at all.
 *
 * Router options are left at their defaults, which are the same defaults Fastify applies to its own
 * router (`ignoreTrailingSlash`, `ignoreDuplicateSlashes`, and `allowUnsafeRegex` off,
 * `caseSensitive` on, `maxParamLength` 100). If `startApiServer` ever passes router options through
 * to Fastify, they have to be passed here too or the two drift apart again.
 */
function createRouteMatcher(paths: ReadonlyArray<BaseRoutePath>) {
    const router = Router();
    /**
     * `find` reports which handler matched but types its `store` as `any`, so the path is recovered
     * through the handler's identity instead. That keeps the lookup free of a cast.
     */
    const handlerPaths = new WeakMap<Handler<HTTPVersion.V1>, BaseRoutePath>();

    paths.forEach((path) => {
        const handler: Handler<HTTPVersion.V1> = () => undefined;
        handlerPaths.set(handler, path);
        /**
         * Registered for every method because callers ask only about the path. Method handling is
         * the endpoint definition's job, not the router's.
         */
        router.all(path, handler);
    });

    return function matchPath(url: string): BaseRoutePath | undefined {
        /**
         * Pass the raw URL, exactly as Fastify hands `request.url` to `lookup`. `find` does its own
         * query-string strip and percent-decoding, and pre-decoding here would decode one level too
         * far: a `%2F` would turn into a path separator that Fastify would never have matched.
         */
        const found = router.find('GET' satisfies HTTPMethod, url);

        return found ? handlerPaths.get(found.handler) : undefined;
    };
}

type ApiRouteMatchers = {
    endpoints: ReturnType<typeof createRouteMatcher>;
    webSockets: ReturnType<typeof createRouteMatcher>;
};

/**
 * Building a router walks every route path, so the result is kept per API definition. Weakly held
 * so a discarded definition does not pin its routers.
 */
const apiRouteMatchers = new WeakMap<ApiDefinition, ApiRouteMatchers>();

function getApiRouteMatchers(api: ApiDefinition): ApiRouteMatchers {
    const cached = apiRouteMatchers.get(api);

    if (cached) {
        return cached;
    }

    /**
     * Endpoints and WebSockets get their own router because the same path may be registered as both
     * and a single router rejects a duplicate route.
     */
    const created: ApiRouteMatchers = {
        endpoints: createRouteMatcher(getObjectTypedKeys(api.endpoints)),
        webSockets: createRouteMatcher(getObjectTypedKeys(api.webSockets)),
    };

    apiRouteMatchers.set(api, created);

    return created;
}

/**
 * Given a raw path or URL, finds an endpoint or WebSocket path that will match in the given
 * service. If no match is found, this returns `undefined`. Matches exactly what Fastify's router
 * would match for the same URL.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export function matchUrlToRoute(
    this: void,
    api: ApiDefinition,
    /** The URL or path to match against. */
    url: string,
): MatchedServicePath | undefined {
    const matchers = getApiRouteMatchers(api);

    const endpointPath = matchers.endpoints(url);
    const webSocketPath = matchers.webSockets(url);

    if (!endpointPath && !webSocketPath) {
        return undefined;
    }
    /**
     * Both endpoint and websocket can be registered at the same path (e.g. `/chat` with a GET
     * endpoint and a websocket upgrade on the same URL). Return whichever side matched so callers
     * can decide based on `request.ws` whether to dispatch the websocket implementation or the
     * endpoint implementation.
     */
    return {
        ...(endpointPath
            ? {
                  endpointPath,
              }
            : {}),
        ...(webSocketPath
            ? {
                  webSocketPath,
              }
            : {}),
    };
}

/**
 * Output for {@link matchUrlToRoute}.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type MatchedServicePath = RequireAtLeastOne<{
    webSocketPath: BaseRoutePath;
    endpointPath: BaseRoutePath;
}>;
