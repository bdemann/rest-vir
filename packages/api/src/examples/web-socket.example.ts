import {defineApi, defineWebSocket, RestVirClient} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';

export const chatWebSocket = defineWebSocket({
    path: '/ws/chat',
    clientMessage: defineShape({
        text: '',
    }),
    hostMessage: defineShape({
        text: '',
        sender: '',
    }),
});

export const chatApi = defineApi({
    apiName: 'chat-api',
    endpoints: [],
    webSockets: [
        chatWebSocket,
    ],
});

const client = new RestVirClient(chatApi, 'https://api.example.com');

const webSocket = await client.connectWebSocket(chatWebSocket, {
    listeners: {
        message({message}) {
            console.info(message.sender, message.text);
        },
    },
});

webSocket.send({
    text: 'Hello.',
});
