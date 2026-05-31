import {defineApi, defineEndpoint, HttpMethod, HttpStatus} from '@rest-vir/api';
import {createApiImplementor, implementApi} from '@rest-vir/host';
import {defineShape} from 'object-shape-tester';

const healthEndpoint = defineEndpoint({
    path: '/health',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Ok]: {
                    responseData: defineShape({
                        status: '',
                    }),
                },
            },
        },
    },
});

const myApi = defineApi({
    apiName: 'my-api',
    endpoints: [
        healthEndpoint,
    ],
    webSockets: [],
});

const implementor = createApiImplementor<undefined>()(myApi);

export const myApiImplementation = implementApi<undefined>()(myApi, {
    createHostContext() {
        return {
            context: undefined,
        };
    },
    endpoints: [
        implementor.implementEndpoint(healthEndpoint, {
            [HttpMethod.Get]() {
                return {
                    [HttpStatus.Ok]: {
                        responseData: {
                            status: 'ok',
                        },
                    },
                };
            },
        }),
    ],
});
