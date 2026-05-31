import {defineApi, defineEndpoint, defineWebSocket, HttpMethod, HttpStatus} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';

export const healthEndpoint = defineEndpoint({
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

export const createUserEndpoint = defineEndpoint({
    path: '/users',
    requests: {
        [HttpMethod.Post]: {
            requestData: defineShape({
                name: '',
            }),
            responses: {
                [HttpStatus.Created]: {
                    responseData: defineShape({
                        id: '',
                        name: '',
                    }),
                },
                [HttpStatus.BadRequest]: {
                    responseData: defineShape({
                        message: '',
                    }),
                },
            },
        },
    },
});

export const notificationsWebSocket = defineWebSocket({
    path: '/ws/notifications',
    clientMessage: defineShape({
        subscribeTo: '',
    }),
    hostMessage: defineShape({
        event: '',
        message: '',
    }),
});

export const myApi = defineApi({
    apiName: 'my-api',
    endpoints: [
        healthEndpoint,
        createUserEndpoint,
    ],
    webSockets: [
        notificationsWebSocket,
    ],
});
