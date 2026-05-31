import {HttpStatus} from '@rest-vir/api';
import {describeEndpoint} from '@rest-vir/host';
import {healthImplementation} from './basic-api-implementation.example.js';

function createHostContext() {
    return {
        context: undefined,
    };
}

describeEndpoint(healthImplementation, ({endpointCases}) => {
    endpointCases.GET(
        {
            createHostContext,
        },
        [
            {
                it: 'responds with ok',
                input: {},
                expect: {
                    result: {
                        Ok: {
                            status: HttpStatus.Ok,
                            headers: {},
                            responseData: {
                                status: 'ok',
                            },
                        },
                    },
                },
            },
        ],
    );
});
