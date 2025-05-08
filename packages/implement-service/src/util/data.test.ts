import {describe, it} from '@augment-vir/test';
import {type mockService} from '@rest-vir/define-service/src/service/define-service.mock.js';
import {type ServerWebSocket} from './data.js';

describe('ServerWebSocket', () => {
    it('can be given a web socket with search params', () => {
        type MySocket = ServerWebSocket<(typeof mockService.webSockets)['/with-search-params']>;
    });
});
