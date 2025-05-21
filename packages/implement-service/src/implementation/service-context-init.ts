import {type HttpMethod, type MaybePromise, type Values} from '@augment-vir/common';
import {
    type BaseSearchParams,
    type BaseServiceEndpointsInit,
    type BaseServiceWebSocketsInit,
    type EndpointDefinition,
    type EndpointPathBase,
    type MinimalService,
    type NoParam,
    type PathParams,
    type WebSocketDefinition,
    type WithFinalEndpointProps,
    type WithFinalWebSocketProps,
} from '@rest-vir/define-service';
import {type IncomingHttpHeaders} from 'node:http';
import {type RequireExactlyOne} from 'type-fest';
import {type ServerRequest, type ServerResponse} from '../util/data.js';
import {type ReplaceUndefinedWithEmptyObject} from '../util/types.js';
import {
    type EndpointImplementationErrorOutput,
    type RunningServerInfo,
} from './implement-endpoint.js';

/**
 * Output of {@link ContextInit}.
 *
 * @category Internal
 * @category Package : @rest-vir/implement-service
 * @package [`@rest-vir/implement-service`](https://www.npmjs.com/package/@rest-vir/implement-service)
 */
export type ContextInitOutput<Context> = RequireExactlyOne<{
    /** The context created for this request. */
    context: Context;
    /**
     * Instead of creating a context object for the current request, instead, reject the request
     * with the specified status code and other options.
     */
    reject: EndpointImplementationErrorOutput;
}>;

/**
 * User-defined service implementation Context generator.
 *
 * @category Internal
 * @category Package : @rest-vir/implement-service
 * @package [`@rest-vir/implement-service`](https://www.npmjs.com/package/@rest-vir/implement-service)
 */
export type ContextInit<
    Context,
    ServiceName extends string,
    EndpointsInit extends BaseServiceEndpointsInit | NoParam,
    WebSocketsInit extends BaseServiceWebSocketsInit | NoParam,
> = (
    params: Readonly<ContextInitParams<ServiceName, EndpointsInit, WebSocketsInit>>,
) => MaybePromise<ContextInitOutput<Context>>;

/**
 * Parameters for {@link ContextInit}.
 *
 * @category Internal
 * @category Package : @rest-vir/implement-service
 * @package [`@rest-vir/implement-service`](https://www.npmjs.com/package/@rest-vir/implement-service)
 */
export type ContextInitParams<
    ServiceName extends string = any,
    EndpointsInit extends BaseServiceEndpointsInit | NoParam = NoParam,
    WebSocketsInit extends BaseServiceWebSocketsInit | NoParam = NoParam,
> = {
    pathParams: EndpointsInit extends NoParam
        ? Readonly<Record<string, string>>
        : PathParams<WithFinalWebSocketProps<Values<WebSocketsInit>, any>['path']> extends string
          ? Readonly<
                Record<
                    PathParams<WithFinalWebSocketProps<Values<WebSocketsInit>, any>['path']>,
                    string
                >
            >
          : Readonly<Record<string, string>>;
    searchParams: ReplaceUndefinedWithEmptyObject<
        | (WebSocketsInit extends NoParam
              ? BaseSearchParams | undefined
              : WithFinalWebSocketProps<Values<WebSocketsInit>, any>['SearchParamsType'])
        | (EndpointsInit extends NoParam
              ? BaseSearchParams | undefined
              : WithFinalEndpointProps<Values<EndpointsInit>, any>['SearchParamsType'])
    >;
    service: MinimalService<ServiceName>;
    requestHeaders: IncomingHttpHeaders;
    method: HttpMethod;
    requestData: EndpointsInit extends NoParam
        ? unknown
        : WithFinalEndpointProps<
              Values<EndpointsInit>,
              Extract<keyof EndpointsInit, EndpointPathBase>
          >['RequestType'];

    request: ServerRequest;
    response: ServerResponse;
    /** The actual running server info. */
    server: RunningServerInfo;

    endpointDefinition?:
        | (EndpointsInit extends NoParam
              ? EndpointDefinition
              : WithFinalEndpointProps<
                    Values<EndpointsInit>,
                    Extract<keyof EndpointsInit, EndpointPathBase>
                >)
        | undefined;
    webSocketDefinition?:
        | (WebSocketsInit extends NoParam
              ? WebSocketDefinition
              : WithFinalWebSocketProps<
                    Values<WebSocketsInit>,
                    Extract<keyof WebSocketsInit, EndpointPathBase>
                >)
        | undefined;
};
