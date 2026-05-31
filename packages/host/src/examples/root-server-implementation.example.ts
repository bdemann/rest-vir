import {AnyOrigin, HttpMethod, HttpStatus} from '@rest-vir/api';
import {createApiImplementor, implementApi, startApiServer} from '@rest-vir/host';
import {
    createUserEndpoint,
    healthEndpoint,
    myApi,
    notificationsWebSocket,
} from './root-api-definition.example.js';

type HostContext = {
    requestId: string;
};

const implementor = createApiImplementor<HostContext>()(myApi);

const healthImplementation = implementor.implementEndpoint(healthEndpoint, {
    [HttpMethod.Get]() {
        return {
            [HttpStatus.Ok]: {
                responseData: {
                    status: 'ok',
                },
            },
        };
    },
});

const createUserImplementation = implementor.implementEndpoint(createUserEndpoint, {
    [HttpMethod.Post]({requestData}) {
        const user = {
            id: crypto.randomUUID(),
            name: requestData.name,
        };

        return {
            [HttpStatus.Created]: {
                responseData: user,
            },
        };
    },
});

const notificationsImplementation = implementor.implementWebSocket(notificationsWebSocket, {
    message({message, webSocket}) {
        webSocket.send({
            event: message.subscribeTo,
            message: 'Subscribed.',
        });
    },
});

export const myApiImplementation = implementApi<HostContext>()(myApi, {
    createHostContext() {
        return {
            context: {
                requestId: crypto.randomUUID(),
            },
        };
    },
    clientOriginRequirement: AnyOrigin,
    endpoints: [
        healthImplementation,
        createUserImplementation,
    ],
    webSockets: [
        notificationsImplementation,
    ],
});

const {kill} = await startApiServer(myApiImplementation, {
    externalOrigin: 'http://localhost:3000',
    port: 3000,
    workerCount: 1,
});

await kill();
