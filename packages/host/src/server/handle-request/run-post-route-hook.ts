import {assert, check} from '@augment-vir/assert';
import {type HttpStatus} from '@augment-vir/common';
import {type BaseSearchParams, definableHttpMethods} from '@rest-vir/api';
import {type ApiImplementation} from '../../implementation/implement-api.js';
import {
    type PostRouteHook,
    type PostRouteHookParams,
} from '../../implementation/post-route-hook.js';
import {type RunningServerInfo} from '../../implementation/raw-route-data.js';
import {type ServerLogger} from '../../implementation/server-logger.js';
import {extractMatchedRoutePath} from '../util/matched-route.js';
import {type HandledOutput, type RouteHandlerParams} from './endpoint-handler.js';
import {buildHandlerParams} from './handler-params.js';

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export async function runPostRouteHook(
    this: void,
    {
        request,
        response,
        attachId,
        server,
        postHook,
        api,
        originalBody,
        originalStatus,
        serverLogger,
    }: Readonly<
        Omit<RouteHandlerParams, 'route'> & {
            attachId: string;
            server: Readonly<RunningServerInfo>;
            postHook: PostRouteHook;
            originalBody: unknown;
            originalStatus: HttpStatus;
            api: Readonly<ApiImplementation>;
            serverLogger: ServerLogger;
        }
    >,
): Promise<HandledOutput> {
    const method = request.method.toUpperCase();

    if (!check.isIn(method, definableHttpMethods)) {
        return undefined;
    }
    const restVirContext = request.restVirContext?.[attachId];
    assert.isDefined(restVirContext, 'restVirContext is not defined');

    const context = restVirContext.context;
    const requestData = restVirContext.requestData;
    const searchParams: BaseSearchParams = restVirContext.searchParams || {};

    const matchedRoutePath = extractMatchedRoutePath({
        request,
        attachId,
    });

    /* node:coverage ignore next 10 */
    if (!matchedRoutePath) {
        return undefined;
    }
    const endpointDefinition = api.definition.endpoints[matchedRoutePath];
    const webSocketDefinition = request.ws
        ? api.definition.webSockets[matchedRoutePath]
        : undefined;

    const postHookParams: PostRouteHookParams = {
        ...buildHandlerParams({
            request,
            requestData,
            response,
            server,
        }),

        api,
        method,
        endpointDefinition,
        webSocketDefinition,
        context,
        serverLogger,
        searchParams,
        originalResponseData: originalBody,
        originalStatus,
    };

    const result = await postHook(postHookParams);

    if (result) {
        return {
            body: 'responseData' in result ? result.responseData : originalBody,
            statusCode: 'statusCode' in result ? result.statusCode : originalStatus,
            headers: result.headers,
        };
    } else {
        return undefined;
    }
}
