import {assert, assertWrap} from '@augment-vir/assert';
import {ensureErrorAndPrependMessage, HttpStatus, isErrorHttpStatus} from '@augment-vir/common';
import {
    createRestVirHandlerErrorPrefix,
    type EndpointImplementationOutput,
    type EndpointImplementationParams,
    HttpMethod,
    type ImplementedEndpoint,
    RestVirHandlerError,
    type RunningServerInfo,
} from '@rest-vir/implement-service';
import {assertValidShape} from 'object-shape-tester';
import {type RestVirRequestContext} from '../start-service/attach-service.js';
import {type EndpointHandlerParams, type HandledOutput} from './endpoint-handler.js';
import {buildHandlerParams} from './handler-params.js';

/**
 * Handles an endpoint's implementation execution.
 *
 * @category Internal
 * @category Package : @rest-vir/run-service
 * @package [`@rest-vir/run-service`](https://www.npmjs.com/package/@rest-vir/run-service)
 */
export async function handleEndpointRequest(
    this: void,
    {
        endpoint,
        request,
        response,
        attachId,
        server,
    }: Readonly<
        Omit<EndpointHandlerParams, 'route'> & {
            attachId: string;
            endpoint: Readonly<ImplementedEndpoint>;
            server: Readonly<RunningServerInfo>;
        }
    >,
): Promise<HandledOutput> {
    try {
        // by this point in the request lifecycle, we know that these properties have been set.
        const restVirContext = request.restVirContext?.[attachId] as
            | undefined
            | RestVirRequestContext;
        assert.isDefined(restVirContext, 'restVirContext is not defined');

        const context = restVirContext.context;
        const requestData = restVirContext.requestData;

        const searchParams = restVirContext.searchParams;

        const endpointParams: EndpointImplementationParams = {
            ...buildHandlerParams({
                request,
                requestData,
                response,
                server,
            }),

            method: assertWrap.isEnumValue(request.method.toUpperCase(), HttpMethod),
            service: endpoint.service,
            endpoint,
            log: endpoint.service.logger,
            context,
            searchParams,
        };

        const endpointResult = (await endpoint.implementation(
            endpointParams,
        )) as EndpointImplementationOutput;

        /** If the dev forgets to set a status code. */
        if (!(endpointResult.statusCode as any)) {
            throw new RestVirHandlerError(endpoint, 'Missing response status code.');
        }

        if (isErrorHttpStatus(endpointResult.statusCode)) {
            endpoint.service.logger.error(
                new RestVirHandlerError(
                    endpoint,
                    `Endpoint implementation returned error status: ${endpointResult.statusCode}`,
                    endpointResult.statusCode,
                ),
            );
            return {
                statusCode: endpointResult.statusCode,
                body: endpointResult.responseErrorMessage,
                headers: endpointResult.headers,
            };
        } else if (endpointResult.responseData) {
            if (endpoint.responseDataShape == undefined) {
                throw new RestVirHandlerError(endpoint, 'Got response data but none was expected.');
            }

            if (!endpoint.bypassResponseValidation) {
                assertValidShape(
                    endpointResult.responseData,
                    endpoint.responseDataShape,
                    {allowExtraKeys: true},
                    'invalid response data',
                );
            }

            return {
                headers: {
                    'content-type': endpointResult.dataType || 'application/json',
                    ...endpointResult.headers,
                },
                statusCode: HttpStatus.Ok,
                body: endpointResult.responseData,
            };
        } else {
            return {
                statusCode: HttpStatus.Ok,
                headers: endpointResult.headers,
            };
        }
    } catch (error) {
        throw ensureErrorAndPrependMessage(error, createRestVirHandlerErrorPrefix(endpoint));
    }
}
