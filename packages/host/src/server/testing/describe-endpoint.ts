import {check} from '@augment-vir/assert';
import {
    mapObjectValues,
    type BivariantFunction,
    type MaybePromise,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {describe, itCasesWithContext, type UniversalTestContext} from '@augment-vir/test';
import {
    condenseResponse,
    createEndpointResponseOutput,
    type EndpointDefinition,
    type EndpointDefinitionMethods,
    type EndpointFetchOutput,
    type EndpointFetchParamObject,
} from '@rest-vir/api';
import {type CreateHostContext} from '../../implementation/host-context.js';
import {type EndpointImplementation} from '../../implementation/implement-endpoint.js';
import {testEndpoint, type HostContextFromImplementation} from './test-endpoint.js';

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type DescribeEndpointParams<Endpoint extends Readonly<EndpointDefinition>, HostContext> = {
    endpointCases: EndpointCases<NoInfer<Endpoint>, NoInfer<HostContext>>;
};

/**
 * @category Testing : Host
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export function describeEndpoint<
    const Endpoint extends Readonly<EndpointDefinition>,
    const HostContext,
>(
    endpointImplementation: Readonly<EndpointImplementation<Endpoint, HostContext>>,
    callback: BivariantFunction<
        [params: Readonly<DescribeEndpointParams<NoInfer<Endpoint>, NoInfer<HostContext>>>],
        void | undefined
    >,
) {
    const endpointCasesObject = mapObjectValues(
        endpointImplementation.definition.requests,
        (method) => {
            const endpointMethod =
                method satisfies PropertyKey as EndpointDefinitionMethods<Endpoint>;

            return function runEndpointCases(
                suiteParams: Readonly<EndpointCaseSuiteParams<HostContext>>,
                testCases: EndpointTestCasesArray<Endpoint, typeof endpointMethod, HostContext>,
            ) {
                endpointCases(endpointImplementation, endpointMethod, suiteParams, testCases);
            };
        },
    ) satisfies Partial<Record<EndpointDefinitionMethods<Endpoint>, unknown>> as EndpointCases<
        Endpoint,
        HostContext
    >;
    const params: Readonly<DescribeEndpointParams<Endpoint, HostContext>> = {
        endpointCases: endpointCasesObject,
    };

    describe(endpointImplementation.path, () => {
        callback(params);
    });
}

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointTestCasesArray<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
> = ReadonlyArray<EndpointTestCase<Endpoint, Method, HostContext>>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointTestCase<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
> = Readonly<
    {
        it: string;
        input:
            | IndividualEndpointTestInputs<NoInfer<Endpoint>, NoInfer<Method>>
            | IndividualEndpointTestCallback<NoInfer<Endpoint>, NoInfer<Method>>;
        expect: IndividualEndpointTestResult<NoInfer<Endpoint>, NoInfer<Method>>;
    } & PartialWithUndefined<{
        only: boolean;
        skip: boolean;
        /** Overrides the endpointCases suite's `createHostContext`. */
        createHostContext: CreateHostContext<HostContext>;
        after: EndpointCaseAfterCallback;
        /** If set to `true`, {@link condenseResponse} is not called. */
        useFullResponse: boolean;
    }>
>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointCaseAfterCallback = BivariantFunction<
    [Readonly<EndpointCaseAfterParams>],
    MaybePromise<unknown>
>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointCases<Endpoint extends Readonly<EndpointDefinition>, HostContext> = {
    [Method in EndpointDefinitionMethods<NoInfer<Endpoint>>]: BivariantFunction<
        [
            suiteParams: Readonly<EndpointCaseSuiteParams<HostContext>>,
            testCases: EndpointTestCasesArray<Endpoint, Method, HostContext>,
        ],
        void
    >;
};

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointCaseSuiteParams<HostContext> = {
    createHostContext: CreateHostContext<HostContext>;
} & PartialWithUndefined<{
    /** Runs after each test case. This can be overridden by each test case's `after`. */
    after: EndpointCaseAfterCallback;
}>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type IndividualEndpointTestInputs<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
> = EndpointFetchParamObject<Endpoint, Method>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type IndividualEndpointTestCallback<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
> = BivariantFunction<
    [
        params: {
            testContext: Readonly<UniversalTestContext>;
        },
    ],
    MaybePromise<IndividualEndpointTestInputs<Endpoint, Method>>
>;

type EndpointTesterInput<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
> = Readonly<{
    input:
        | IndividualEndpointTestInputs<NoInfer<Endpoint>, NoInfer<Method>>
        | IndividualEndpointTestCallback<NoInfer<Endpoint>, NoInfer<Method>>;
    /** If set to `true`, {@link condenseResponse} is not called. */
    useFullResponse: boolean;
    createHostContext: CreateHostContext<HostContext> | undefined;
    after: EndpointCaseAfterCallback | undefined;
}>;

type EndpointTesterFunction<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
> = BivariantFunction<
    [
        testContext: Readonly<UniversalTestContext>,
        testCaseInputs: EndpointTesterInput<NoInfer<Endpoint>, NoInfer<Method>, HostContext>,
    ],
    Promise<IndividualEndpointTestResult<Endpoint, Method>>
>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointCaseAfterParams = {
    response: Response;
    testContext: Readonly<UniversalTestContext>;
};

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type IndividualEndpointTestResult<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
> = {
    afterResult?: unknown;
    result: EndpointFetchOutput<Endpoint, Method, false>;
};

function endpointCases<
    const Endpoint extends Readonly<EndpointDefinition>,
    const Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    const HostContext,
>(
    endpointImplementation: Readonly<EndpointImplementation<Endpoint, HostContext>>,
    method: Method,
    suiteParams: Readonly<EndpointCaseSuiteParams<HostContext>>,
    testCases: EndpointTestCasesArray<Endpoint, Method, HostContext>,
) {
    const testCaseInputs = testCases.map(
        ({it, only, skip, input, expect, createHostContext, after, useFullResponse}) => {
            const testInput: EndpointTesterInput<Endpoint, Method, HostContext> = {
                input,
                createHostContext,
                after,
                useFullResponse: !!useFullResponse,
            };

            return {
                it,
                only,
                skip,
                input: testInput,
                expect,
            };
        },
    );

    return itCasesWithContext<EndpointTesterFunction<Endpoint, Method, HostContext>>(
        createEndpointTester(endpointImplementation, method, suiteParams),
        testCaseInputs,
    );
}

function createEndpointTester<
    const Endpoint extends Readonly<EndpointDefinition>,
    const HostContext,
    const Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
>(
    endpointImplementation: Readonly<EndpointImplementation<Endpoint, HostContext>>,
    method: Method,
    {
        createHostContext: suiteCreateHostContext,
        after: suiteAfter,
    }: Readonly<EndpointCaseSuiteParams<HostContext>>,
): EndpointTesterFunction<Endpoint, Method, HostContext> {
    return async (
        testContext: Readonly<UniversalTestContext>,
        {
            input: testCaseInputs,
            createHostContext: caseCreateHostContext,
            after: caseAfter,
            useFullResponse,
        }: EndpointTesterInput<NoInfer<Endpoint>, NoInfer<Method>, HostContext>,
    ): Promise<IndividualEndpointTestResult<Endpoint, Method>> => {
        const params = check.isFunction(testCaseInputs)
            ? await testCaseInputs({
                  testContext,
              })
            : testCaseInputs;

        const createHostContext = caseCreateHostContext || suiteCreateHostContext;
        const response = await testEndpoint<
            Readonly<EndpointImplementation<Endpoint, HostContext>>,
            Endpoint,
            Method
        >(
            endpointImplementation,
            method,
            createHostContext satisfies CreateHostContext<unknown> as CreateHostContext<
                HostContextFromImplementation<
                    Readonly<EndpointImplementation<Endpoint, HostContext>>
                >
            >,
            params,
        );

        const after = caseAfter || suiteAfter;
        const afterResult = after
            ? await after({
                  response,
                  testContext,
              })
            : undefined;

        const responseOutput: EndpointFetchOutput<Endpoint, Method, false> =
            await createEndpointResponseOutput<Endpoint, Method, false>({
                endpoint: endpointImplementation.definition as Endpoint,
                includeResponse: false,
                method,
                response,
                shouldCondenseResponse: !useFullResponse,
            });

        return {
            ...(afterResult === undefined
                ? {}
                : {
                      afterResult,
                  }),
            result: responseOutput,
        };
    };
}
