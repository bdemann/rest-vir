import {
    type HttpStatus,
    type MaybePromise,
    type SetOptionalWithUndefined,
    type Values,
} from '@augment-vir/common';
import {
    type BaseServiceEndpointsInit,
    type BaseServiceWebSocketsInit,
    type EndpointPathBase,
    type NoParam,
    type WithFinalEndpointProps,
} from '@rest-vir/define-service';
import {type EndpointImplementationOutput} from './implement-endpoint.js';
import {type ContextInitParams} from './service-context-init.js';

/**
 * Params for {@link PostHook}.
 *
 * @category Internal
 * @category Package : @rest-vir/implement-service
 * @package [`@rest-vir/implement-service`](https://www.npmjs.com/package/@rest-vir/implement-service)
 */
export type PostHookParams<
    Context = any,
    ServiceName extends string = any,
    EndpointsInit extends BaseServiceEndpointsInit | NoParam = NoParam,
    WebSocketsInit extends BaseServiceWebSocketsInit | NoParam = NoParam,
> = SetOptionalWithUndefined<
    ContextInitParams<ServiceName, EndpointsInit, WebSocketsInit> & {
        originalResponseData: EndpointsInit extends NoParam
            ? unknown
            : WithFinalEndpointProps<
                  Values<EndpointsInit>,
                  Extract<keyof EndpointsInit, EndpointPathBase>
              >['ResponseType'];
        originalStatus: HttpStatus;
        /** This will be `undefined` if your `createContext` method rejects the request. */
        context: Context;
    },
    'context' | 'searchParams'
>;

/**
 * Type for `ServiceImplementationsParams.postHook`.
 *
 * @category Internal
 * @category Package : @rest-vir/implement-service
 * @package [`@rest-vir/implement-service`](https://www.npmjs.com/package/@rest-vir/implement-service)
 */
export type PostHook<
    Context = any,
    ServiceName extends string = any,
    EndpointsInit extends BaseServiceEndpointsInit | NoParam = NoParam,
    WebSocketsInit extends BaseServiceWebSocketsInit | NoParam = NoParam,
> = (
    params: PostHookParams<Context, ServiceName, EndpointsInit, WebSocketsInit>,
) => MaybePromise<Partial<EndpointImplementationOutput> | undefined | void>;
