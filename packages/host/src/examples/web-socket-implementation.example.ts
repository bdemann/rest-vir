import {defineApi, defineWebSocket} from '@rest-vir/api';
import {createApiImplementor, implementApi} from '@rest-vir/host';
import {defineShape} from 'object-shape-tester';

const echoWebSocket = defineWebSocket({
    path: '/ws/echo',
    clientMessage: defineShape({
        value: '',
    }),
    hostMessage: defineShape({
        value: '',
    }),
});

const api = defineApi({
    apiName: 'socket-api',
    endpoints: [],
    webSockets: [
        echoWebSocket,
    ],
});

const implementor = createApiImplementor<undefined>()(api);

const echoImplementation = implementor.implementWebSocket(echoWebSocket, {
    message({message, webSocket}) {
        webSocket.send({
            value: message.value,
        });
    },
});

export const apiImplementation = implementApi<undefined>()(api, {
    createHostContext() {
        return {
            context: undefined,
        };
    },
    webSockets: [
        echoImplementation,
    ],
});
