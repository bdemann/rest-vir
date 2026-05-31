import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {HttpMethod, HttpStatus} from '@rest-vir/api';
import {testEndpoint} from '@rest-vir/host';
import {
    demoApiImplementation,
    echoImplementation,
    healthImplementation,
    itemsImplementation,
    noContentImplementation,
    searchImplementation,
    secretImplementation,
    teapotImplementation,
    userImplementation,
} from './demo-api-implementation.js';

const createDemoHostContext = demoApiImplementation.implementation.createHostContext;

describe(testEndpoint.name, () => {
    it('tests the health endpoint', async () => {
        const response = await testEndpoint(
            healthImplementation,
            HttpMethod.Get,
            createDemoHostContext,
        );

        assert.strictEquals(response.status, HttpStatus.Ok);
        assert.strictEquals(await response.json(), 'ok');
    });

    it('tests a no-content endpoint', async () => {
        const response = await testEndpoint(
            noContentImplementation,
            HttpMethod.Get,
            createDemoHostContext,
        );

        assert.strictEquals(response.status, HttpStatus.NoContent);
        assert.strictEquals(await response.text(), '');
    });

    it('tests the echo endpoint', async () => {
        const response = await testEndpoint(
            echoImplementation,
            HttpMethod.Post,
            createDemoHostContext,
            {
                requestData: {
                    message: 'ha ',
                    count: 3,
                },
            },
        );

        assert.strictEquals(response.status, HttpStatus.Accepted);
        assert.deepEquals(await response.json(), {
            echoed: 'ha ha ha ',
            length: 9,
        });
    });

    it('tests path params on the user endpoint', async () => {
        const response = await testEndpoint(
            userImplementation,
            HttpMethod.Get,
            createDemoHostContext,
            {
                pathParams: {
                    userId: '2',
                },
            },
        );

        assert.strictEquals(response.status, HttpStatus.Ok);
        assert.deepEquals(await response.json(), {
            id: '2',
            name: 'Bob',
        });
    });

    it('tests declared error responses on the user endpoint', async () => {
        const response = await testEndpoint(
            userImplementation,
            HttpMethod.Get,
            createDemoHostContext,
            {
                pathParams: {
                    userId: 'missing',
                },
            },
        );

        assert.strictEquals(response.status, HttpStatus.NotFound);
        assert.deepEquals(await response.json(), {
            missingId: 'missing',
        });
    });

    it('tests search params', async () => {
        const response = await testEndpoint(
            searchImplementation,
            HttpMethod.Get,
            createDemoHostContext,
            {
                searchParams: {
                    query: 'referrals',
                    tags: [
                        'urgent',
                        'demo',
                    ],
                    code: 'ABC',
                },
            },
        );

        assert.strictEquals(response.status, HttpStatus.PartialContent);
        assert.deepEquals(await response.json(), {
            query: 'referrals',
            tags: [
                'urgent',
                'demo',
            ],
            code: 'ABC',
        });
    });

    it('tests required request headers', async () => {
        const response = await testEndpoint(
            secretImplementation,
            HttpMethod.Get,
            createDemoHostContext,
            {
                requiredHeaders: {
                    'x-demo-token': 'demo-local',
                },
            },
        );

        assert.strictEquals(response.status, HttpStatus.Ok);
        assert.deepEquals(await response.json(), {
            secret: 'accepted demo-local',
        });
    });

    it('tests multiple methods on the items endpoint', async () => {
        const putResponse = await testEndpoint(
            itemsImplementation,
            HttpMethod.Put,
            createDemoHostContext,
            {
                pathParams: {
                    itemId: 'item-1',
                },
                requestData: {
                    value: 'new',
                },
            },
        );

        assert.strictEquals(putResponse.status, HttpStatus.Created);
        assert.deepEquals(await putResponse.json(), {
            replaced: 'item-1=new',
        });

        const deleteResponse = await testEndpoint(
            itemsImplementation,
            HttpMethod.Delete,
            createDemoHostContext,
            {
                pathParams: {
                    itemId: 'item-1',
                },
            },
        );

        assert.strictEquals(deleteResponse.status, HttpStatus.NoContent);
        assert.strictEquals(await deleteResponse.text(), '');
    });

    it('tests a declared non-2xx response', async () => {
        const response = await testEndpoint(
            teapotImplementation,
            HttpMethod.Get,
            createDemoHostContext,
        );

        assert.strictEquals(response.status, HttpStatus.ImATeapot);
        assert.deepEquals(await response.json(), {
            short: 'and stout',
            tall: 4,
            stout: true,
        });
    });
});
