import {condenseResponse, HttpMethod} from '@rest-vir/api';
import {testApi} from '@rest-vir/host';
import {apiImplementation, healthEndpoint} from './basic-api-implementation.example.js';

const {fetchEndpoint, kill} = await testApi(apiImplementation);

const response = await fetchEndpoint(healthEndpoint, HttpMethod.Get);

condenseResponse(response);

console.info(response);

await kill();
