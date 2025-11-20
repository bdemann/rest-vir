import {check} from '@augment-vir/assert';
import {
    addPrefix,
    filterMap,
    getObjectTypedEntries,
    HttpMethod,
    mapObject,
    type ExtractKeysWithMatchingValues,
    type KeyCount,
    type MaybePromise,
    type PartialWithUndefined,
    type RequiredKeysOf,
    type SelectFrom,
} from '@augment-vir/common';
import {type OutgoingHttpHeaders} from 'node:http';
import {assertValidShape} from 'object-shape-tester';
import {type IsEqual, type IsNever} from 'type-fest';
import {buildUrl} from 'url-vir';
import {parseJsonWithUndefined} from '../augments/json.js';
import {type ConstructPathParams, type GenericPathParams} from '../endpoint/endpoint-path.js';
import {
    type EndpointDefinition,
    type EndpointExecutorData,
    type GenericEndpointDefinition,
} from '../endpoint/endpoint.js';
import {type NoParam} from '../util/no-param.js';
import {type BaseSearchParams} from '../util/search-params.js';

/**
 * A general version of {@link FetchEndpointParams} to be used when accepting _any_ endpoint (like in
 * tests).
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type GenericFetchEndpointParams = PartialWithUndefined<GenericPathParams> & {
    requestData?: any;
    searchParams?: BaseSearchParams | undefined;
    bypassResponseValidation?: undefined | boolean;
    method?: HttpMethod | undefined;
    options?: Omit<RequestInit, 'body' | 'method'> | undefined;
    /**
     * A custom fetch implementation. Useful for debugging or unit testing. This can safely be
     * omitted to use the default JavaScript built-in global `fetch` function.
     */
    fetch?:
        | ((
              url: string,
              requestInit: RequestInit,
              endpoint?: GenericEndpointDefinition | undefined,
          ) => MaybePromise<Response>)
        | undefined;
};

function defaultFetch(
    ...[
        url,
        requestInit,
    ]: Parameters<NonNullable<GenericFetchEndpointParams['fetch']>>
) {
    return fetch(url, requestInit);
}

/**
 * Type that determines which HTTP request methods can be used for the given endpoint definition.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type FetchMethod<EndpointToFetch extends Pick<EndpointDefinition, 'methods'>> =
    IsEqual<
        KeyCount<Record<ExtractKeysWithMatchingValues<EndpointToFetch['methods'], true>, boolean>>,
        1
    > extends true
        ? never
        :
              | Extract<HttpMethod, ExtractKeysWithMatchingValues<EndpointToFetch['methods'], true>>
              | `${Extract<HttpMethod, ExtractKeysWithMatchingValues<EndpointToFetch['methods'], true>>}`;

/**
 * All type safe parameters for sending a request to an endpoint using {@link fetchEndpoint}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type FetchEndpointParams<
    EndpointToFetch extends SelectFrom<
        EndpointDefinition,
        {
            path: true;
            requestDataShape: true;
            responseDataShape: true;
            methods: true;
        }
    >,
    AllowFetchMock extends boolean = true,
> = EndpointToFetch extends EndpointDefinition
    ? Readonly<
          ConstructPathParams<EndpointToFetch['path']> &
              (EndpointToFetch['SearchParamsType'] extends undefined
                  ? {
                        searchParams?: Record<string, string[]>;
                    }
                  : {
                        searchParams: EndpointToFetch['SearchParamsType'] &
                            Record<string, string[]>;
                    }) &
              (EndpointExecutorData<EndpointToFetch>['request'] extends undefined
                  ? {
                        /**
                         * This endpoint does not accept any request data, so there is none to be
                         * set.
                         */
                        requestData?: never;
                    }
                  : {
                        requestData: EndpointExecutorData<EndpointToFetch>['request'];
                    }) &
              (IsNever<FetchMethod<EndpointToFetch>> extends true
                  ? {
                        /**
                         * This endpoint only allows one method so it does not need to be
                         * configured.
                         */
                        method?: never;
                    }
                  : {
                        method: FetchMethod<EndpointToFetch>;
                    }) &
              (AllowFetchMock extends true
                  ? Pick<
                        GenericFetchEndpointParams,
                        'options' | 'fetch' | 'bypassResponseValidation'
                    >
                  : Pick<GenericFetchEndpointParams, 'options' | 'bypassResponseValidation'>)
      >
    : GenericFetchEndpointParams;

/**
 * Type safe output from sending a request to an endpoint definition. Used by {@link fetchEndpoint}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type FetchEndpointOutput<
    EndpointToFetch extends
        | Readonly<
              SelectFrom<
                  EndpointDefinition,
                  {
                      requestDataShape: true;
                      responseDataShape: true;
                  }
              >
          >
        | NoParam,
> =
    | Readonly<{
          ok: true;
          data: EndpointToFetch extends SelectFrom<
              EndpointDefinition,
              {
                  requestDataShape: true;
                  responseDataShape: true;
              }
          >
              ? EndpointExecutorData<EndpointToFetch>['response']
              : any;
          response: Readonly<Response>;
      }>
    | Readonly<{
          ok: false;
          data: string | undefined;
          response: Readonly<Response>;
      }>;

/**
 * Extracts an array of all allowed methods for the given endpoint definition.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export function getAllowedEndpointMethods(
    endpoint: Readonly<Pick<EndpointDefinition, 'methods'>>,
): HttpMethod[] {
    return filterMap(
        getObjectTypedEntries(endpoint.methods),
        ([
            methodName,
        ]) => methodName,
        (
            methodName,
            [
                ,
                allowed,
            ],
        ) => allowed,
    );
}

function filterToValidMethod(
    endpoint: Readonly<
        SelectFrom<
            EndpointDefinition,
            {
                methods: true;
                path: true;
                service: {
                    serviceName: true;
                };
            }
        >
    >,
    chosenMethod: undefined | HttpMethod,
): HttpMethod {
    if (chosenMethod && (chosenMethod === HttpMethod.Options || endpoint.methods[chosenMethod])) {
        return chosenMethod;
    } else if (chosenMethod) {
        throw new Error(
            `Given HTTP method '${chosenMethod}' is not allowed for endpoint '${endpoint.path}' in service '${endpoint.service.serviceName}'`,
        );
    }

    const allowedMethods = getAllowedEndpointMethods(endpoint);

    if (check.isLengthExactly(allowedMethods, 1)) {
        return allowedMethods[0];
    } else if (allowedMethods.length) {
        throw new Error(
            `Endpoint '${endpoint.path}' in service '${endpoint.service.serviceName}' allows multiple HTTP methods, one must be chosen.`,
        );
    } else {
        throw new Error(
            `Endpoint '${endpoint.path}' in service '${endpoint.service.serviceName}' has no allowed HTTP methods. Requests cannot be sent.`,
        );
    }
}

/**
 * A wrapper for {@link FetchEndpointParams} that requires parameters based on the endpoint being
 * fetched.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type CollapsedFetchEndpointParams<
    EndpointToFetch extends
        | Readonly<
              SelectFrom<
                  EndpointDefinition,
                  {
                      path: true;
                      requestDataShape: true;
                      responseDataShape: true;
                      methods: true;
                  }
              >
          >
        | NoParam,
    AllowFetchMock extends boolean = true,
> = EndpointToFetch extends NoParam
    ? [Readonly<GenericFetchEndpointParams>?]
    : Readonly<
            FetchEndpointParams<Exclude<EndpointToFetch, NoParam>, AllowFetchMock>
        > extends infer RealParams
      ? RequiredKeysOf<RealParams> extends never
          ? [RealParams?]
          : [RealParams]
      : [];

/**
 * Send a request to an endpoint definition with type safe parameters.
 *
 * This can safely be used in frontend _or_ backend code.
 *
 * @category Client (Frontend) Connection
 * @category Package : @rest-vir/define-service
 * @example
 *
 * ```ts
 * import {fetchEndpoint} from '@rest-vir/define-service';
 *
 * const {data, response} = await fetchEndpoint(myService.endpoints['/my-endpoint']);
 * ```
 *
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export async function fetchEndpoint<
    const EndpointToFetch extends
        | Readonly<
              SelectFrom<
                  EndpointDefinition,
                  {
                      requestDataShape: true;
                      path: true;
                      responseDataShape: true;
                      methods: true;
                      service: {
                          serviceOrigin: true;
                          serviceName: true;
                      };
                  }
              >
          >
        | NoParam,
>(
    endpoint: EndpointToFetch extends EndpointDefinition
        ? EndpointToFetch
        : SelectFrom<
              EndpointDefinition,
              {
                  requestDataShape: true;
                  path: true;
                  responseDataShape: true;
                  searchParamsShape: true;
                  methods: true;
                  service: {
                      serviceOrigin: true;
                      serviceName: true;
                  };
              }
          >,
    ...params: CollapsedFetchEndpointParams<EndpointToFetch>
): Promise<FetchEndpointOutput<EndpointToFetch>> {
    const {requestData, fetch, bypassResponseValidation} = params[0] || {};

    if (requestData) {
        if (endpoint.requestDataShape) {
            assertValidShape(requestData, endpoint.requestDataShape, {allowExtraKeys: true});
        } else {
            throw new Error(
                `Request data was given but endpoint '${endpoint.path}' is not expecting any request data.`,
            );
        }
    }

    const {requestInit, url} = buildEndpointRequestInit(endpoint, ...params);

    /* node:coverage ignore next: all tests mock fetch so we're never going to have a fallback here. */
    const response = await (fetch || defaultFetch)(
        url,
        requestInit,
        endpoint as EndpointDefinition,
    );

    if (response.ok) {
        const responseData = endpoint.responseDataShape
            ? parseJsonWithUndefined(await response.text())
            : undefined;

        if (endpoint.responseDataShape && !bypassResponseValidation) {
            assertValidShape(responseData, endpoint.responseDataShape, {allowExtraKeys: true});
        }

        return {
            ok: true,
            data: responseData,
            response,
        };
    } else {
        return {
            ok: false,
            /** This will be an error message. */
            data: (await response.text()) || undefined,
            response,
        };
    }
}

/**
 * Build request init and URL for fetching an endpoint. Used in {@link fetchEndpoint}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export function buildEndpointRequestInit<
    const EndpointToFetch extends
        | Readonly<
              SelectFrom<
                  EndpointDefinition,
                  {
                      requestDataShape: true;
                      path: true;
                      responseDataShape: true;
                      methods: true;
                      service: {
                          serviceOrigin: true;
                          serviceName: true;
                      };
                  }
              >
          >
        | NoParam,
>(
    endpoint: EndpointToFetch extends EndpointDefinition
        ? EndpointToFetch
        : SelectFrom<
              EndpointDefinition,
              {
                  requestDataShape: true;
                  path: true;
                  responseDataShape: true;
                  searchParamsShape: true;
                  methods: true;
                  service: {
                      serviceOrigin: true;
                      serviceName: true;
                  };
              }
          >,
    ...[
        {method, options = {}, pathParams, requestData, searchParams, wildcard} = {},
    ]: CollapsedFetchEndpointParams<EndpointToFetch, false>
) {
    const headers: OutgoingHttpHeaders & Record<string, string> = mapObject(
        options.headers instanceof Headers
            ? Object.fromEntries(options.headers.entries())
            : check.isArray(options.headers)
              ? Object.fromEntries(options.headers)
              : options.headers || {},
        (key, value) => {
            return {
                key: key.toLowerCase(),
                value,
            };
        },
    );

    if (!headers['content-type']) {
        if (requestData instanceof FormData) {
            /**
             * Do not set `content-type` manually when submitting form data because the browser will
             * set it automatically _and_ include a boundary in the content type, which is needed
             * for reading the form data properly.
             */
        } else if (requestData) {
            headers['content-type'] = 'application/json';
        }
    }

    const shouldStringify: boolean = !!headers['content-type']?.match(/\bjson\b/i);

    const url = buildEndpointUrl(endpoint, {
        pathParams,
        searchParams,
        wildcard,
    });

    const requestInit: RequestInit = {
        ...options,
        headers,
        method: filterToValidMethod(endpoint, method),
        ...(requestData
            ? shouldStringify
                ? {
                      body: JSON.stringify(requestData),
                  }
                : {
                      body: requestData,
                  }
            : {}),
    };

    return {
        url,
        requestInit,
    };
}

/**
 * Creates and finalizes a URL for sending fetches to the given endpoint.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export function buildEndpointUrl<
    const EndpointToFetch extends
        | Readonly<
              SelectFrom<
                  EndpointDefinition,
                  {
                      path: true;
                      service: {
                          serviceOrigin: true;
                          serviceName: true;
                      };
                      methods: true;
                      requestDataShape: true;
                      responseDataShape: true;
                      searchParamsShape: true;
                  }
              >
          >
        | NoParam = NoParam,
>(
    endpoint: EndpointToFetch extends EndpointDefinition
        ? EndpointToFetch
        : SelectFrom<
              EndpointDefinition,
              {
                  path: true;
                  service: {
                      serviceOrigin: true;
                      serviceName: true;
                  };
                  requestDataShape: true;
                  searchParamsShape: true;
                  responseDataShape: true;
                  methods: true;
              }
          >,
    {
        pathParams,
        searchParams,
        wildcard,
    }: Pick<
        EndpointToFetch extends NoParam
            ? Readonly<GenericFetchEndpointParams>
            : Readonly<FetchEndpointParams<Exclude<EndpointToFetch, NoParam>>>,
        'pathParams' | 'searchParams' | 'wildcard'
    >,
): string {
    let pathParamsCount = 0;

    if (endpoint.searchParamsShape) {
        assertValidShape(
            searchParams,
            endpoint.searchParamsShape,
            {
                /** Allow extra keys for forwards compatibility. */
                allowExtraKeys: true,
            },
            `Invalid search params given to '${endpoint.path}' in service '${endpoint.service.serviceName}'`,
        );
    }

    if (endpoint.path.endsWith('/*') && wildcard == undefined) {
        throw new Error('Missing value for wildcard param.');
    }

    const pathname = endpoint.path
        .replaceAll(/\/:([^/]+)/g, (wholeMatch, paramName: string): string => {
            pathParamsCount++;
            if (pathParams && check.hasKey(pathParams, paramName) && pathParams[paramName]) {
                return addPrefix({
                    value: pathParams[paramName],
                    prefix: '/',
                });
            } else {
                throw new Error(`Missing value for path param '${paramName}'.`);
            }
        })
        .replace(/\/\*$/, addPrefix({value: wildcard || '', prefix: '/'}));

    const builtUrl = buildUrl(endpoint.service.serviceOrigin, {
        search: searchParams,
        pathname,
    }).href;

    if (!pathParamsCount && pathParams) {
        throw new Error(
            `'${endpoint.path}' in service '${endpoint.service.serviceName}' does not allow any path params but some where set.`,
        );
    }

    return builtUrl;
}
