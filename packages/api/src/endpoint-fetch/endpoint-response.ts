/* eslint-disable @typescript-eslint/no-empty-object-type */

import {
    getObjectTypedEntries,
    HttpStatus,
    isErrorHttpStatus,
    typedObjectFromEntries,
    type AnyObject,
    type BivariantFunction,
    type ErrorHttpStatus,
    type ExtractKeysWithMatchingValues,
    type MaybePromise,
} from '@augment-vir/common';
import {assertValidShape, type Shape} from 'object-shape-tester';
import {type IsEqual, type RequireExactlyOne} from 'type-fest';
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
import {isJsonContentType, readHeaderValue, removeClientHeaders} from '../util/client-headers.js';
import {restVirApiNameHeader} from '../util/find-dev-port.js';
import {extractHttpStatus} from '../util/http-status.js';
import {type NoParam} from '../util/no-param.js';

export type WithResponse<IncludeResponse extends boolean | NoParam = NoParam> =
    IsEqual<IncludeResponse, NoParam> extends true
        ? {
              response?: Response | undefined;
          }
        : IsEqual<IncludeResponse, true> extends true
          ? {response: Response}
          : {response?: never};

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

export type EndpointFetchOutput<
    Endpoint extends EndpointDefinition | NoParam = NoParam,
    Method extends DefinableHttpMethod | NoParam = NoParam,
    IncludeResponse extends boolean | NoParam = NoParam,
> = RequireExactlyOne<
    DefinedEndpointFetchOutputs<Endpoint, Method, IncludeResponse> & {
        unexpectedError: UnknownFetchOutput<IncludeResponse>;
    }
>;

export type UnknownFetchOutput<IncludeResponse extends boolean | NoParam = NoParam> = {
    status: HttpStatus;
    responseData: DefaultErrorResponseType;
    headers: DefaultResponseHeadersType;
} & WithResponse<IncludeResponse>;

export type ResolveShapeType<InnerShape extends Shape | undefined> = InnerShape extends Shape
    ? InnerShape['runtimeType']
    : undefined;

export type HandleDeclaredResponseStatusOverrideParams = {
    endpoint: EndpointDefinition;
    response: Response;
    responseDefinition: ResponseStatusDefinition;
};

export type HandleDeclaredResponseStatusOverride = BivariantFunction<
    [Readonly<HandleDeclaredResponseStatusOverrideParams>],
    MaybePromise<unknown>
>;

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

        const unexpectedError: UnknownFetchOutput = {
            ...baseResponseResult,
            responseData,
            headers: readResponseHeaders(response.headers),
        };

        return {
            unexpectedError,
        } satisfies EndpointFetchOutput as EndpointFetchOutput<Endpoint, Method, IncludeResponse>;
    } else {
        throw new Error(
            `Received unexpected successful response status from endpoint '${endpoint.path}': ${status}`,
        );
    }
}

export async function defaultHandleDeclaredResponseStatus({
    response,
    responseDefinition,
    endpoint,
}: Readonly<HandleDeclaredResponseStatusOverrideParams>): Promise<unknown> {
    const responseData = await readResponseBodyAsJsonOrText(
        response,
        readResponseHeaders(response.headers),
    );

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

export function readResponseHeaders(headers: Headers): Record<string, string> {
    return Object.fromEntries(headers.entries());
}

export type HttpStatusByKey<Status extends HttpStatus> = ExtractKeysWithMatchingValues<
    typeof HttpStatus,
    Status
>;

export const httpStatusToKey = typedObjectFromEntries(
    getObjectTypedEntries(HttpStatus).map(
        ([
            key,
            status,
        ]) => [
            status,
            key,
        ],
    ),
) satisfies Record<HttpStatus, keyof typeof HttpStatus> as {
    [Status in HttpStatus]: ExtractKeysWithMatchingValues<typeof HttpStatus, Status>;
};

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

export async function readResponseBodyAsText(response: Readonly<Response>) {
    return (await response.clone().text()) || undefined;
}

/**
 * Read the response body as text, then JSON-parse it if the response advertises a JSON
 * `content-type`. Falls back to the raw text when JSON parsing yields nothing.
 */
export async function readResponseBodyAsJsonOrText(
    response: Readonly<Response>,
    headers: DefaultResponseHeadersType,
): Promise<unknown> {
    const responseText = await readResponseBodyAsText(response);

    /**
     * `readHeaderValue` always returns an array. Check whether _any_ entry's content-type string
     * contains `json` — covers both single-valued (typical) and the rare multi-valued case.
     */
    const hasJsonContentType = readHeaderValue(headers, 'content-type').some(isJsonContentType);

    const parsed: unknown =
        hasJsonContentType && responseText ? parseJsonWithUndefined(responseText) : undefined;

    return parsed === undefined ? responseText : parsed;
}

export type EndpointFetchStreamOutput<
    Endpoint extends EndpointDefinition,
    Method extends DefinableHttpMethod,
> = RequireExactlyOne<
    DefinedEndpointFetchStreamOutputs<Endpoint, Method> & {
        unexpectedError: UnknownFetchOutput;
    }
>;
