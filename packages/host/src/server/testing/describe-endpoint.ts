import {check} from '@augment-vir/assert';
import {
    mapObjectValues,
    type BivariantFunction,
    type MaybePromise,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {
    describe,
    itCasesWithContext,
    type FunctionWithContextTestCase,
    type UniversalTestContext,
} from '@augment-vir/test';
import {
    condenseResponse,
    createEndpointResponseOutput,
    type CreateHostContextBase,
    type EndpointDefinition,
    type EndpointDefinitionMethods,
    type EndpointFetchOutput,
    type EndpointFetchParamObject,
} from '@rest-vir/api';
import {
    type CreateHostContext,
    type HostCreateContextParamsExtras,
} from '../../implementation/host-context.js';
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

            return function runEndpointCases<
                TestParams = undefined,
                Output = IndividualEndpointTestResult<Endpoint, typeof endpointMethod>,
            >(
                suiteParams: Readonly<
                    EndpointCaseSuiteParams<
                        Endpoint,
                        typeof endpointMethod,
                        HostContext,
                        TestParams,
                        Output
                    >
                >,
                testCases: EndpointTestCasesArray<
                    Endpoint,
                    typeof endpointMethod,
                    HostContext,
                    TestParams,
                    Output
                >,
            ) {
                endpointCases<Endpoint, typeof endpointMethod, HostContext, TestParams, Output>(
                    endpointImplementation,
                    endpointMethod,
                    suiteParams,
                    testCases,
                );
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
    TestParams = undefined,
    Output = IndividualEndpointTestResult<Endpoint, Method>,
> = ReadonlyArray<EndpointTestCase<Endpoint, Method, HostContext, TestParams, Output>>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointTestCase<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
    TestParams = undefined,
    Output = IndividualEndpointTestResult<Endpoint, Method>,
> = Readonly<
    {
        it: string;
        input:
            | IndividualEndpointTestInputs<NoInfer<Endpoint>, NoInfer<Method>>
            | IndividualEndpointTestCallback<NoInfer<Endpoint>, NoInfer<Method>, TestParams>;
        expect: Output;
    } & PartialWithUndefined<{
        only: boolean;
        skip: boolean;
        /**
         * Overrides the endpointCases suite's `createTestParams`. The test params are created once,
         * before this case's `input` is resolved, and are threaded into `input`,
         * `createHostContext`, and the suite's `assembleResult`.
         */
        createTestParams: CreateEndpointCaseTestParams<TestParams>;
        /** Overrides the endpointCases suite's `createHostContext`. */
        createHostContext: TestCreateHostContext<HostContext, TestParams>;
        /** If set to `true`, {@link condenseResponse} is not called. */
        useFullResponse: boolean;
    }>
>;

/**
 * Creates a test case's `testParams`: an arbitrary value created once at the very start of each
 * test case, before its `input` is resolved. Use it to set up per-case state (a seeded database
 * client, a snapshot, etc.) that the case's `input`, `createHostContext`, and `assembleResult`
 * callbacks all need to share.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type CreateEndpointCaseTestParams<TestParams> = BivariantFunction<
    [
        params: Readonly<{
            testContext: Readonly<UniversalTestContext>;
        }>,
    ],
    MaybePromise<TestParams>
>;

/**
 * Tears down a test case. Always runs (even if the request or assertions throw).
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type TeardownEndpointCase<HostContext, TestParams> = BivariantFunction<
    [
        params: Readonly<{
            testParams: TestParams;
            /**
             * The host context built for this case's request, or `undefined` if none was created
             * (for example, when the request was rejected before context creation).
             */
            hostContext: HostContext | undefined;
            testContext: Readonly<UniversalTestContext>;
        }>,
    ],
    MaybePromise<void>
>;

/**
 * The `createHostContext` callback used inside {@link describeEndpoint}. It receives the same params
 * as a normal {@link CreateHostContext} plus the current test case's `testParams` and
 * `testContext`.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type TestCreateHostContext<HostContext, TestParams> = CreateHostContextBase<
    HostContext,
    HostCreateContextParamsExtras & {
        testParams: TestParams;
        testContext: Readonly<UniversalTestContext>;
    }
>;

/**
 * Assembles the value that each test case's `expect` is compared against. When omitted, the default
 * `{result}` shape is used. Provide this to fully control the compared output (for example to add
 * sibling keys, reshape `result`, or fold in `testParams`-derived data such as a post-request query
 * result or a database diff).
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type AssembleEndpointTestResult<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    TestParams,
    Output,
> = BivariantFunction<
    [
        params: Readonly<{
            response: Response;
            result: EndpointFetchOutput<Endpoint, Method, false>;
            testParams: TestParams;
            testContext: Readonly<UniversalTestContext>;
        }>,
    ],
    MaybePromise<Output>
>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointCases<Endpoint extends Readonly<EndpointDefinition>, HostContext> = {
    [Method in EndpointDefinitionMethods<NoInfer<Endpoint>>]: <
        TestParams = undefined,
        Output = IndividualEndpointTestResult<Endpoint, Method>,
    >(
        suiteParams: Readonly<
            EndpointCaseSuiteParams<Endpoint, Method, HostContext, TestParams, Output>
        >,
        testCases: EndpointTestCasesArray<Endpoint, Method, HostContext, TestParams, Output>,
    ) => void;
};

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type EndpointCaseSuiteParams<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
    TestParams = undefined,
    Output = IndividualEndpointTestResult<Endpoint, Method>,
> = {
    createHostContext: TestCreateHostContext<HostContext, TestParams>;
} & PartialWithUndefined<{
    /**
     * Optionally create `TestParams` which are passed both to createHostContext and test case input
     * callbacks (if used).
     */
    createTestParams: CreateEndpointCaseTestParams<TestParams>;
    /** Runs after each test case (always runs, even on throw) to tear the case down. */
    teardown: TeardownEndpointCase<HostContext, TestParams>;
    /**
     * Assembles the value compared against each test case's `expect`. When omitted, the default
     * `{result}` shape is used.
     */
    assembleResult: AssembleEndpointTestResult<Endpoint, Method, TestParams, Output>;
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
    TestParams = undefined,
> = BivariantFunction<
    [
        params: {
            testContext: Readonly<UniversalTestContext>;
            testParams: TestParams;
        },
    ],
    MaybePromise<IndividualEndpointTestInputs<Endpoint, Method>>
>;

type EndpointTesterInput<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
    TestParams,
> = Readonly<{
    input:
        | IndividualEndpointTestInputs<NoInfer<Endpoint>, NoInfer<Method>>
        | IndividualEndpointTestCallback<NoInfer<Endpoint>, NoInfer<Method>, TestParams>;
    /** If set to `true`, {@link condenseResponse} is not called. */
    useFullResponse: boolean;
    createTestParams: CreateEndpointCaseTestParams<TestParams> | undefined;
    createHostContext: TestCreateHostContext<HostContext, TestParams> | undefined;
}>;

type EndpointTesterFunction<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    HostContext,
    TestParams,
    Output,
> = BivariantFunction<
    [
        testContext: Readonly<UniversalTestContext>,
        testCaseInputs: EndpointTesterInput<
            NoInfer<Endpoint>,
            NoInfer<Method>,
            HostContext,
            TestParams
        >,
    ],
    Promise<Output>
>;

/**
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export type IndividualEndpointTestResult<
    Endpoint extends Readonly<EndpointDefinition>,
    Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
> = {
    result: EndpointFetchOutput<Endpoint, Method, false>;
};

function endpointCases<
    const Endpoint extends Readonly<EndpointDefinition>,
    const Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    const HostContext,
    const TestParams,
    const Output,
>(
    endpointImplementation: Readonly<EndpointImplementation<Endpoint, HostContext>>,
    method: Method,
    suiteParams: Readonly<
        EndpointCaseSuiteParams<Endpoint, Method, HostContext, TestParams, Output>
    >,
    testCases: EndpointTestCasesArray<Endpoint, Method, HostContext, TestParams, Output>,
) {
    const testCaseInputs = testCases.map(
        ({it, only, skip, input, expect, createTestParams, createHostContext, useFullResponse}) => {
            const testInput: EndpointTesterInput<Endpoint, Method, HostContext, TestParams> = {
                input,
                createTestParams,
                createHostContext,
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

    return itCasesWithContext<
        EndpointTesterFunction<Endpoint, Method, HostContext, TestParams, Output>
    >(
        createEndpointTester(endpointImplementation, method, suiteParams),
        /**
         * `expect` is already verified as `Output` by the public `EndpointTestCasesArray` param.
         * The cast only sidesteps the `expect`/`throws` union narrowing, which can't resolve
         * through the generic `Output`.
         */
        testCaseInputs satisfies ReadonlyArray<{
            it: string;
            input: EndpointTesterInput<Endpoint, Method, HostContext, TestParams>;
        }> as ReadonlyArray<
            FunctionWithContextTestCase<
                EndpointTesterFunction<Endpoint, Method, HostContext, TestParams, Output>
            >
        >,
    );
}

function createEndpointTester<
    const Endpoint extends Readonly<EndpointDefinition>,
    const HostContext,
    const Method extends EndpointDefinitionMethods<NoInfer<Endpoint>>,
    const TestParams,
    const Output,
>(
    endpointImplementation: Readonly<EndpointImplementation<Endpoint, HostContext>>,
    method: Method,
    {
        createHostContext: suiteCreateHostContext,
        createTestParams: suiteCreateTestParams,
        teardown,
        assembleResult,
    }: Readonly<EndpointCaseSuiteParams<Endpoint, Method, HostContext, TestParams, Output>>,
): EndpointTesterFunction<Endpoint, Method, HostContext, TestParams, Output> {
    return async (
        testContext: Readonly<UniversalTestContext>,
        {
            input: testCaseInputs,
            createTestParams: caseCreateTestParams,
            createHostContext: caseCreateHostContext,
            useFullResponse,
        }: EndpointTesterInput<NoInfer<Endpoint>, NoInfer<Method>, HostContext, TestParams>,
    ): Promise<Output> => {
        const createTestParams = caseCreateTestParams || suiteCreateTestParams;
        const testParams = (createTestParams
            ? await createTestParams({
                  testContext,
              })
            : undefined) satisfies TestParams | undefined as TestParams;

        let createdHostContext: HostContext | undefined = undefined;

        try {
            const params = check.isFunction(testCaseInputs)
                ? await testCaseInputs({
                      testContext,
                      testParams,
                  })
                : testCaseInputs;

            const createHostContext = caseCreateHostContext || suiteCreateHostContext;
            const wrappedCreateHostContext: CreateHostContext<HostContext> = async (
                hostContextParams,
            ) => {
                const contextOutput = await createHostContext({
                    ...hostContextParams,
                    testContext,
                    testParams,
                });

                if (!contextOutput.reject) {
                    createdHostContext = contextOutput.context;
                }

                return contextOutput;
            };

            const response = await testEndpoint<
                Readonly<EndpointImplementation<Endpoint, HostContext>>,
                Endpoint,
                Method
            >(
                endpointImplementation,
                method,
                wrappedCreateHostContext satisfies CreateHostContext<unknown> as CreateHostContext<
                    HostContextFromImplementation<
                        Readonly<EndpointImplementation<Endpoint, HostContext>>
                    >
                >,
                params,
            );

            const responseOutput: EndpointFetchOutput<Endpoint, Method, false> =
                await createEndpointResponseOutput<Endpoint, Method, false>({
                    endpoint: endpointImplementation.definition as Endpoint,
                    includeResponse: false,
                    method,
                    response,
                    shouldCondenseResponse: !useFullResponse,
                });

            if (assembleResult) {
                return await assembleResult({
                    response,
                    result: responseOutput,
                    testParams,
                    testContext,
                });
            }

            const defaultResult = {
                result: responseOutput,
            };

            return defaultResult satisfies IndividualEndpointTestResult<Endpoint, Method> as Output;
        } finally {
            if (teardown) {
                await teardown({
                    testParams,
                    hostContext: createdHostContext,
                    testContext,
                });
            }
        }
    };
}
