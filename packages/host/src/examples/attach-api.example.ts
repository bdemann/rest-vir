import {attachApi} from '@rest-vir/host';
import fastify from 'fastify';
import {apiImplementation} from './basic-api-implementation.example.js';

const server = fastify();

await attachApi(server, apiImplementation, {
    externalOrigin: 'http://localhost:3000',
});

await server.listen({
    port: 3000,
});
