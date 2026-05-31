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
                        requestId: '',
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

type HostContext = {
    requestId: string;
};

const {implementEndpoint} = createApiImplementor<HostContext>()(myApi);

const healthImplementation = implementEndpoint(healthEndpoint, {
    [HttpMethod.Get]({context}) {
        return {
            [HttpStatus.Ok]: {
                responseData: {
                    requestId: context.requestId,
                },
            },
        };
    },
});

export const apiImplementation = implementApi<HostContext>()(myApi, {
    createHostContext() {
        return {
            context: {
                requestId: crypto.randomUUID(),
            },
        };
    },
    endpoints: [
        healthImplementation,
    ],
});
