/* eslint-disable @typescript-eslint/no-empty-object-type */

import {check} from '@augment-vir/assert';
import {
    getObjectTypedEntries,
    HttpStatus,
    isErrorHttpStatus,
    typedObjectFromEntries,
    type AnyObject,
    type BivariantFunction,
    type ErrorHttpStatus,
    type ExtractKeysWithMatchingValues,
    type IsEqual,
    type MaybePromise,
    type RequireExactlyOne,
    type Values,
} from '@augment-vir/common';
import {assertValidShape, type Shape} from 'object-shape-tester';
import {
    extractEndpointMethodDefinition,
    type DefaultErrorResponseType,
    type DefaultResponseHeadersType,
    type DefinableHttpMethod,
    type EndpointDefinition,
    type EndpointMethodDefinition,
    type EndpointMethodDefinitionResponseStatuses,
    type EndpointResponseHeadersType,
    type ExtractEndpointMethodDefinition,
    type ResponseStatusDefinition,
} from '../api/endpoint.js';
import {parseJsonWithUndefined} from '../augments/json.js';
import {removeClientHeaders} from '../util/client-headers.js';
import {restVirApiNameHeader} from '../util/find-dev-port.js';
import {extractHttpStatus} from '../util/http-status.js';
import {type NoParam} from '../util/no-param.js';

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type WithResponse<IncludeResponse extends boolean | NoParam = NoParam> =
    IsEqual<IncludeResponse, NoParam> extends true
        ? {
              response?: Response | undefined;
          }
        : IsEqual<IncludeResponse, true> extends true
          ? {response: Response}
          : {response?: never};

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type DefinedEndpointFetchOutputs<
    Endpoint extends EndpointDefinition | NoParam = NoParam,
    Method extends DefinableHttpMethod | NoParam = NoParam,
    IncludeResponse extends boolean | NoParam = NoParam,
> = {
    [Status in EndpointMethodDefinitionResponseStatuses<
        ExtractEndpointMethodDefinition<Endpoint, Method>
    > as HttpStatusByKey<Status>]: DefinedEndpointFetchStatusOutput<
        Endpoint,
        Method,
        Status,
        IncludeResponse
    >;
};

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type DefinedEndpointFetchStatusOutput<
    Endpoint extends EndpointDefinition | NoParam = NoParam,
    Method extends DefinableHttpMethod | NoParam = NoParam,
    Status extends HttpStatus | NoParam = NoParam,
    IncludeResponse extends boolean | NoParam = NoParam,
> = {
    status: IsEqual<Status, NoParam> extends true ? HttpStatus : Status;
    responseData:
        | DefinedEndpointFetchOutputResponseData<Endpoint, Method, Status>
        | (Status extends ErrorHttpStatus ? string | undefined : never);
    headers: EndpointResponseHeadersType<Endpoint, Method, Extract<Status, HttpStatus>>;
} & WithResponse<IncludeResponse>;

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type DefinedEndpointFetchOutputResponseData<
    Endpoint extends EndpointDefinition | NoParam = NoParam,
    Method extends DefinableHttpMethod | NoParam = NoParam,
    Status extends HttpStatus | NoParam = NoParam,
> =
    ExtractEndpointMethodDefinition<Endpoint, Method> extends infer EndpointMethod extends
        EndpointMethodDefinition
        ? EndpointMethod['responses'] extends AnyObject
            ? ResolveShapeType<NonNullable<EndpointMethod['responses'][Status]>['responseData']>
            : any
        : any;

/**
 * @category Util : Client
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type EndpointFetchOutput<
    Endpoint extends EndpointDefinition | NoParam = NoParam,
    Method extends DefinableHttpMethod | NoParam = NoParam,
    IncludeResponse extends boolean | NoParam = NoParam,
> = RequireExactlyOne<
    DefinedEndpointFetchOutputs<Endpoint, Method, IncludeResponse> & {
        unexpectedError: UnknownFetchOutput<IncludeResponse>;
    }
>;

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type UnknownFetchOutput<IncludeResponse extends boolean | NoParam = NoParam> = {
    status: HttpStatus;
    responseData: DefaultErrorResponseType;
    headers: DefaultResponseHeadersType;
} & WithResponse<IncludeResponse>;

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type ResolveShapeType<InnerShape extends Shape | undefined> = InnerShape extends Shape
    ? InnerShape['runtimeType']
    : undefined;

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type HandleDeclaredResponseStatusOverrideParams = {
    endpoint: EndpointDefinition;
    response: Response;
    responseDefinition: ResponseStatusDefinition;
};

/** Extracts a fetch result no matter what status it came in under. */

/**
 * @category Util : Client
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export function extractEndpointResult<Output extends Readonly<EndpointFetchOutput>>(
    fetchResult: Output,
): NonNullable<Values<Output>> {
    const entries = Object.entries(fetchResult);

    if (!check.isLengthAtLeast(entries, 1)) {
        throw new Error('No fetch result contents.');
    }

    return entries[0][1];
}

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type HandleDeclaredResponseStatusOverride = BivariantFunction<
    [Readonly<HandleDeclaredResponseStatusOverrideParams>],
    MaybePromise<unknown>
>;

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export async function createEndpointResponseOutput<
    Endpoint extends EndpointDefinition,
    Method extends DefinableHttpMethod,
    IncludeResponse extends boolean,
>({
    endpoint,
    method,
    response,
    handleDeclaredResponseStatusOverride,
    includeResponse,
    shouldCondenseResponse,
}: Readonly<{
    endpoint: Endpoint;
    method: Method;
    response: Response;
    /**
     * - If set to `true`: the returned result includes the response object.
     * - If set to `false`: the returned result does not include the response object.
     */
    includeResponse: IncludeResponse;
    shouldCondenseResponse: boolean;
    handleDeclaredResponseStatusOverride?: HandleDeclaredResponseStatusOverride | undefined;
}>): Promise<EndpointFetchOutput<Endpoint, Method, IncludeResponse>> {
    const methodDefinition = extractEndpointMethodDefinition(endpoint, method);
    const status = extractHttpStatus(response.status);

    const responseDefinition = methodDefinition?.responses[status];

    const baseResponseResult: Omit<DefinedEndpointFetchStatusOutput, 'responseData' | 'headers'> = {
        status,
        ...(includeResponse
            ? {
                  response,
              }
            : {}),
    };

    if (responseDefinition) {
        const responseData = await (
            handleDeclaredResponseStatusOverride || defaultHandleDeclaredResponseStatus
        )({
            endpoint,
            responseDefinition,
            response,
        });

        if (shouldCondenseResponse) {
            condenseResponse(response);
        }

        return {
            [httpStatusToKey[status]]: {
                ...baseResponseResult,
                responseData,
                headers: readResponseHeaders(response.headers),
            },
        } satisfies Partial<DefinedEndpointFetchOutputs> as EndpointFetchOutput<
            Endpoint,
            Method,
            IncludeResponse
        >;
    } else if (isErrorHttpStatus(status)) {
        const responseData = await readResponseBodyAsText(response);

        if (shouldCondenseResponse) {
            condenseResponse(response);
        }

        const unexpectedErrorOutput: Partial<Record<'unexpectedError', UnknownFetchOutput>> = {
            unexpectedError: {
                ...baseResponseResult,
                responseData,
                headers: readResponseHeaders(response.headers),
            },
        };

        return unexpectedErrorOutput as EndpointFetchOutput<Endpoint, Method, IncludeResponse>;
    } else {
        throw new Error(
            `Received unexpected successful response status from endpoint '${endpoint.path}': ${status}`,
        );
    }
}

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export async function defaultHandleDeclaredResponseStatus({
    response,
    responseDefinition,
    endpoint,
}: Readonly<HandleDeclaredResponseStatusOverrideParams>): Promise<unknown> {
    const responseData = await readResponseBodyAsJsonOrText(response);

    if (responseDefinition.responseData) {
        assertValidShape(
            responseData,
            responseDefinition.responseData,
            {
                allowExtraKeys: true,
            },
            `Response from endpoint '${endpoint.path}' has invalid data.`,
        );
    } else if (responseData !== undefined) {
        throw new Error(`Response from endpoint '${endpoint.path}' has unexpectedly present data.`);
    }

    return responseData;
}

/**
 * Strips a response of parts that are just noise when testing. This mutates the given `response`.
 *
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export function condenseResponse(response: Response): void {
    removeClientHeaders(response.headers, [
        'access-control-allow-credentials',
        'access-control-allow-origin',
        'access-control-expose-headers',
        'connection',
        'content-length',
        'content-type',
        'date',
        'keep-alive',
        'vary',
        restVirApiNameHeader,
    ]);
}

/**
 * @category Util : Client
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export function readResponseHeaders(headers: Headers): Record<string, string> {
    return Object.fromEntries(headers.entries());
}

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type HttpStatusByKey<Status extends HttpStatus> = ExtractKeysWithMatchingValues<
    typeof HttpStatus,
    Status
>;

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export const httpStatusToKey = typedObjectFromEntries(
    getObjectTypedEntries(HttpStatus).map(
        ([
            key,
            status,
        ]) => {
            return [
                status,
                key,
            ];
        },
    ),
) satisfies Record<HttpStatus, keyof typeof HttpStatus> as {
    [Status in HttpStatus]: ExtractKeysWithMatchingValues<typeof HttpStatus, Status>;
};

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type DefinedEndpointFetchStreamOutputs<
    Endpoint extends EndpointDefinition,
    Method extends DefinableHttpMethod,
> = Endpoint['requests'][Method] extends infer EndpointMethod extends EndpointMethodDefinition
    ? EndpointMethod['responses'] extends AnyObject
        ? {
              [Status in EndpointMethodDefinitionResponseStatuses<EndpointMethod> as HttpStatusByKey<Status>]: {
                  status: Status;
                  responseData:
                      | ReadableStream<Uint8Array>
                      | (Status extends ErrorHttpStatus ? string | undefined : never);
                  headers: EndpointResponseHeadersType<
                      Endpoint,
                      Method,
                      Extract<Status, HttpStatus>
                  >;
                  response: Response;
              };
          }
        : {}
    : {};

/**
 * @category Internal
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export async function readResponseBodyAsText(response: Readonly<Response>) {
    return (await response.clone().text()) || undefined;
}

/**
 * Read the response body as text, then JSON-parse it. Falls back to the raw text when JSON parsing
 * fails.
 *
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export async function readResponseBodyAsJsonOrText(response: Readonly<Response>): Promise<unknown> {
    const responseText = await readResponseBodyAsText(response);

    return responseText ? parseJsonWithUndefined(responseText) : responseText;
}

/**
 * @category Util : Client
 * @category Package : @rest-vir/api
 * @package [`@rest-vir/api`](https://www.npmjs.com/package/@rest-vir/api)
 */
export type EndpointFetchStreamOutput<
    Endpoint extends EndpointDefinition,
    Method extends DefinableHttpMethod,
> = RequireExactlyOne<
    DefinedEndpointFetchStreamOutputs<Endpoint, Method> & {
        unexpectedError: UnknownFetchOutput<true>;
    }
>;
