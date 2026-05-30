import {assert} from '@augment-vir/assert';
import {HttpStatus} from '@augment-vir/common';
import {describe, itCases} from '@augment-vir/test';
import {handleHandlerOutput} from './endpoint-handler.js';

function createMockResponse() {
    const sentBodies: unknown[] = [];

    const response = {
        statusCode: 0,
        header() {},
        removeHeader() {},
        raw: {
            setHeader() {},
            removeHeader() {},
        },
        send(body?: unknown) {
            sentBodies.push(body);
            return this;
        },
    } satisfies Record<string, unknown> as unknown as Parameters<typeof handleHandlerOutput>[1];

    return {
        sentBodies,
        response,
    };
}

describe(handleHandlerOutput.name, () => {
    itCases(
        (body: unknown) => {
            const {response, sentBodies} = createMockResponse();

            void handleHandlerOutput(
                {
                    statusCode: HttpStatus.Ok,
                    body,
                },
                response,
            );

            assert.strictEquals(response.statusCode, HttpStatus.Ok);
            return sentBodies;
        },
        [
            {
                it: 'sends false response bodies',
                input: false,
                expect: [false],
            },
            {
                it: 'sends zero response bodies',
                input: 0,
                expect: [0],
            },
            {
                it: 'sends empty string response bodies',
                input: '',
                expect: [''],
            },
            {
                it: 'omits undefined response bodies',
                input: undefined,
                expect: [undefined],
            },
        ],
    );
});
