import {RestVirClient} from '@rest-vir/api';
import {
    createUserEndpoint,
    healthEndpoint,
    myApi,
    notificationsWebSocket,
} from './root-api-definition.example.js';

const client = new RestVirClient(myApi, 'https://api.example.com');

const health = await client.fetch(healthEndpoint).GET();

if (health.Ok) {
    console.info(health.Ok.responseData.status);
}

const created = await client.fetch(createUserEndpoint).POST({
    requestData: {
        name: 'Example User',
    },
});

if (created.Created) {
    console.info(created.Created.responseData.id);
}

const webSocket = await client.connectWebSocket(notificationsWebSocket, {
    listeners: {
        message({message}) {
            console.info(message.event, message.message);
        },
    },
});

webSocket.send({
    subscribeTo: 'user-created',
});
