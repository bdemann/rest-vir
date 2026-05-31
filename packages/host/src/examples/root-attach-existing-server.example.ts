import {attachApi} from '@rest-vir/host';
import fastify from 'fastify';
import {myApiImplementation} from './root-api-implementation.example.js';

const server = fastify();

await attachApi(server, myApiImplementation, {
    externalOrigin: 'http://localhost:3000',
});

await server.listen({
    port: 3000,
});
