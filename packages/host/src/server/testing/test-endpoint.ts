import {
    defineApi,
    type EndpointDefinition,
    type EndpointDefinitionMethods,
    type EndpointFetchParams,
} from '@rest-vir/api';
import {type CreateHostContext} from '../../implementation/host-context.js';
import {implementApi} from '../../implementation/implement-api.js';
import {type EndpointImplementation} from '../../implementation/implement-endpoint.js';
import {testApi} from './test-api.js';

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointFromImplementation<Implementation> =
    Implementation extends Readonly<{
        definition: Readonly<infer Endpoint extends EndpointDefinition>;
    }>
        ? Endpoint
        : never;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type HostContextFromImplementation<Implementation> =
    Implementation extends Readonly<{
        implementation: infer Implementations;
    }>
        ? Implementations[keyof Implementations] extends (params: infer Params) => unknown
            ? Params extends {context: infer HostContext}
                ? HostContext
                : never
            : never
        : never;

/**
 * Test your endpoint with real Request and Response objects.
 *
 * @category Testing : Host
 * @category Package : @rest-vir/host
 * @example
 *
 * ```ts
 * import {testEndpoint} from '@rest-vir/host';
 * import {HttpMethod} from '@rest-vir/api';
 *
 * const response = await testEndpoint(
 *     myApiImplementation.implementation.endpoints['/my-endpoint'],
 *     HttpMethod.Get,
 *     () => ({context: undefined}),
 * );
 * ```
 *
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export async function testEndpoint<
    const EndpointImplementationToTest extends Readonly<{
        definition: Readonly<EndpointDefinition>;
        implementation: Readonly<object>;
        isEndpoint: true;
        isWebSocket: false;
        path: string;
    }>,
    const Endpoint extends
        EndpointDefinition = EndpointFromImplementation<EndpointImplementationToTest>,
    const Method extends EndpointDefinitionMethods<NoInfer<Endpoint>> = EndpointDefinitionMethods<
        NoInfer<Endpoint>
    >,
>(
    endpoint: EndpointImplementationToTest,
    method: Method,
    createHostContext: CreateHostContext<
        HostContextFromImplementation<EndpointImplementationToTest>
    >,
    ...restParams: EndpointFetchParams<NoInfer<Endpoint>, NoInfer<Method>>
) {
    const endpointDefinition =
        endpoint.definition satisfies Readonly<EndpointDefinition> as Endpoint;
    const endpointImplementation = endpoint satisfies Readonly<{
        definition: Readonly<EndpointDefinition>;
        implementation: Readonly<object>;
        path: string;
    }> as unknown as Readonly<
        EndpointImplementation<
            Endpoint,
            HostContextFromImplementation<EndpointImplementationToTest>
        >
    >;
    const apiDefinition = defineApi({
        apiName: `endpoint-test-${endpoint.path}`,
        endpoints: [endpointDefinition],
    });
    const apiImplementation = implementApi<
        HostContextFromImplementation<EndpointImplementationToTest>
    >()(apiDefinition, {
        createHostContext,
        endpoints: [endpointImplementation],
    });

    const {fetchEndpoint, kill} = await testApi(apiImplementation);

    try {
        return await fetchEndpoint(endpointDefinition, method, ...restParams);
    } finally {
        await kill();
    }
}
