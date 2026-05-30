import {assert, waitUntil} from '@augment-vir/assert';
import {describe, it, itCases} from '@augment-vir/test';
import {defineApi, defineWebSocket, HttpStatus} from '@rest-vir/api';
import {implementApi} from '../../implementation/implement-api.js';
import {createApiImplementor} from '../../implementation/implementor.js';
import {testApi} from '../testing/test-api.js';
import {RestVirHandlerError} from '../util/handler.error.js';
import {rawMessageToString} from './handle-web-socket.js';

describe(rawMessageToString.name, () => {
    itCases(rawMessageToString, [
        {
            it: 'passes a string message through unchanged',
            input: 'hello',
            expect: 'hello',
        },
        {
            it: 'decodes a Buffer payload as utf-8',
            input: Buffer.from('hello'),
            expect: 'hello',
        },
        {
            it: 'concatenates a Buffer array payload before decoding',
            input: [
                Buffer.from('hel'),
                Buffer.from('lo'),
            ],
            expect: 'hello',
        },
        {
            it: 'decodes an ArrayBuffer payload as utf-8',
            input: new Uint8Array([
                0x68,
                0x65,
                0x6c,
                0x6c,
                0x6f,
            ]).buffer,
            expect: 'hello',
        },
    ]);
});

const closeErrorWebSocket = defineWebSocket({
    path: '/close-error',
});

const closeErrorApi = defineApi({
    apiName: 'close error api',
    webSockets: [
        closeErrorWebSocket,
    ],
});

const closeErrorImplementor = createApiImplementor<undefined>()(closeErrorApi);

describe('WebSocket close handling', () => {
    it('logs errors thrown by the close callback', async () => {
        const loggedErrors: Error[] = [];
        const closeErrorApiImplementation = implementApi<undefined>()(closeErrorApi, {
            createHostContext() {
                return {
                    context: undefined,
                };
            },
            clientOriginRequirement: {
                anyOrigin: true,
            },
            serverLogger: {
                error(error) {
                    loggedErrors.push(error);
                },
                info() {},
            },
            webSockets: [
                closeErrorImplementor.implementWebSocket(closeErrorWebSocket, {
                    close() {
                        throw new Error('close failed');
                    },
                }),
            ],
        });

        const {connectWebSocket, kill} = await testApi(closeErrorApiImplementation);

        try {
            const webSocket = await connectWebSocket(closeErrorWebSocket);
            await webSocket.close();

            await waitUntil.isLengthExactly(1, () => loggedErrors);

            const loggedError = loggedErrors[0];
            assert.instanceOf(loggedError, RestVirHandlerError);
            assert.strictEquals(loggedError.status, HttpStatus.InternalServerError);
        } finally {
            await kill();
        }
    });
});
