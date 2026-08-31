import {assert} from '@augment-vir/assert';
import {combineErrorMessages, ensureErrorClass, HttpStatus, stringify} from '@augment-vir/common';
import {
    overwriteWebSocketMethods,
    parseJsonWithUndefined,
    WebSocketLocation,
    type ApiDefinition,
} from '@rest-vir/api';
import {assertValidShape} from 'object-shape-tester';
import {type WebSocket as WsWebSocket} from 'ws';
import {
    type WebSocketImplementation,
    type WebSocketImplementationParams,
} from '../../implementation/implement-websocket.js';
import {type RunningServerInfo, type ServerRequest} from '../../implementation/raw-route-data.js';
import {type ServerLogger} from '../../implementation/server-logger.js';
import {type RestVirRequestContext} from '../run-api/attach-api.js';
import {RestVirHandlerError} from '../util/handler.error.js';

/**
 * Normalize the various shapes `ws` may deliver an incoming message in (string, Buffer, Buffer[],
 * ArrayBuffer) into a UTF-8 string. Exported for direct unit testing because the default `ws`
 * configuration only emits `Buffer` for the JSON-stringified payloads sent by the client wrapper,
 * so the other branches are otherwise unreachable from the integration tests.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export function rawMessageToString(rawMessage: WsWebSocket.Data): string {
    if (typeof rawMessage === 'string') {
        return rawMessage;
    } else if (Array.isArray(rawMessage)) {
        return Buffer.concat(rawMessage).toString('utf8');
    } else if (Buffer.isBuffer(rawMessage)) {
        return rawMessage.toString('utf8');
    } else {
        return Buffer.from(rawMessage).toString('utf8');
    }
}

const maxLoggedMessageLength = 1000;

/**
 * Neutralize an attacker-supplied WebSocket message before embedding it in a log line:
 * `JSON.stringify` escapes CR/LF, ANSI escape sequences, and every other control character (so a
 * frame cannot forge log entries or corrupt terminal output), and truncation keeps a multi-megabyte
 * frame from bloating the log. Mirrors the CR/LF-avoidance rationale in `handle-route.ts`. Exported
 * for direct unit testing.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export function sanitizeMessageForLog(rawMessage: string) {
    const truncatedMessage =
        rawMessage.length > maxLoggedMessageLength
            ? `${rawMessage.slice(0, maxLoggedMessageLength)}… (truncated from ${rawMessage.length} characters)`
            : rawMessage;
    return JSON.stringify(truncatedMessage);
}

/**
 * Handles a WebSocket request.
 *
 * @category Internal
 * @category Package : @rest-vir/host
 * @package [`@rest-vir/host`](https://www.npmjs.com/package/@rest-vir/host)
 */
export async function handleWebSocketRequest(
    this: void,
    {
        attachId,
        request,
        webSocketImplementation,
        webSocket: wsWebSocket,
        server,
        serverLogger,
        api,
    }: Readonly<{
        request: ServerRequest;
        attachId: string;
        webSocketImplementation: Readonly<WebSocketImplementation>;
        webSocket: WsWebSocket;
        server: Readonly<RunningServerInfo>;
        serverLogger: Readonly<ServerLogger>;
        api: Readonly<ApiDefinition>;
    }>,
): Promise<void> {
    // by this point in the request lifecycle, we know that these properties have been set.
    const restVirContext = request.restVirContext?.[attachId] as undefined | RestVirRequestContext;
    assert.isDefined(restVirContext, 'restVirContext is not defined');

    /**
     * Fail closed rather than handing the implementation an undefined context: an implementation
     * that reads its auth state off the context would otherwise run with no auth state at all.
     */
    if (!restVirContext.contextCreated) {
        throw new RestVirHandlerError(
            {
                apiName: api.apiName,
                isEndpoint: false,
                isWebSocket: true,
                path: webSocketImplementation.path,
            },
            'Request context was never created.',
            HttpStatus.InternalServerError,
        );
    }

    const webSocket = overwriteWebSocketMethods(
        webSocketImplementation.definition,
        wsWebSocket,
        WebSocketLocation.OnHost,
    );

    /**
     * `Duplexify`-based sockets (used by `@fastify/websocket`'s `injectWS` for testing) don't emit
     * `'close'` after `end()` like real TCP sockets do. The `ws` library relies on the socket
     * `'close'` event to fire `emitClose()` and complete the close handshake. Destroying the socket
     * when it finishes writing triggers `'close'` promptly. For real TCP sockets this is
     * effectively a no-op since they close naturally after the FIN handshake.
     */
    const rawSocket = (
        wsWebSocket as unknown as {
            _socket?: {
                on: (event: string, listener: () => void) => void;
                destroyed?: boolean;
                destroy: () => void;
            };
        }
    )._socket;
    rawSocket?.on('finish', () => {
        if (!rawSocket.destroyed) {
            rawSocket.destroy();
        }
    });

    const webSocketCallbackParams: WebSocketImplementationParams = {
        context: restVirContext.context,
        requestHeaders: request.headers,
        serverLogger,
        request,
        webSocketDefinition: webSocketImplementation.definition,
        webSocket,
        protocols: restVirContext.protocols,
        searchParams: restVirContext.searchParams,
        server,
    };

    if (webSocketImplementation.implementation.close) {
        webSocket.on('close', async () => {
            try {
                await webSocketImplementation.implementation.close?.(webSocketCallbackParams);
            } catch (error) {
                serverLogger.error(
                    ensureErrorClass(
                        error,
                        RestVirHandlerError,
                        {
                            apiName: api.apiName,
                            isEndpoint: false,
                            isWebSocket: true,
                            path: webSocketImplementation.path,
                        },
                        combineErrorMessages('Failed to handle WebSocket close.', error),
                        HttpStatus.InternalServerError,
                    ),
                );
            }
        });
    }

    if (webSocketImplementation.implementation.message) {
        webSocket.on('message', async (rawMessage) => {
            const stringRawMessage = rawMessageToString(rawMessage);
            let message: unknown;
            try {
                message = parseJsonWithUndefined(stringRawMessage);

                if (webSocketImplementation.definition.clientMessage) {
                    assertValidShape(
                        message,
                        webSocketImplementation.definition.clientMessage,
                        {
                            allowExtraKeys: true,
                        },
                        'Invalid message send shape.',
                    );
                } else if (message !== undefined) {
                    throw new Error(
                        `Did not expect any data from the client but got ${stringify(message)}.`,
                    );
                }
            } catch (error) {
                serverLogger.error(
                    ensureErrorClass(
                        error,
                        RestVirHandlerError,
                        {
                            apiName: api.apiName,
                            isEndpoint: false,
                            isWebSocket: true,
                            path: webSocketImplementation.path,
                        },
                        combineErrorMessages(
                            `Failed to receive WebSocket message ${sanitizeMessageForLog(stringRawMessage)}.`,
                            error,
                        ),
                        HttpStatus.InternalServerError,
                    ),
                );
                /**
                 * Reject the message: do NOT invoke the user's `message` handler with garbage. 1008
                 * = "policy violation". The canonical close code for "rejected because it violates
                 * server policy" (such as shape validation).
                 */
                wsWebSocket.close(1008, 'invalid message');
                return;
            }
            try {
                await webSocketImplementation.implementation.message?.({
                    ...webSocketCallbackParams,
                    message,
                });
            } catch (error) {
                serverLogger.error(
                    ensureErrorClass(
                        error,
                        RestVirHandlerError,
                        {
                            apiName: api.apiName,
                            isEndpoint: false,
                            isWebSocket: true,
                            path: webSocketImplementation.path,
                        },
                        combineErrorMessages(
                            `Failed to handle WebSocket message ${sanitizeMessageForLog(stringRawMessage)}.`,
                            error,
                        ),
                        HttpStatus.InternalServerError,
                    ),
                );
            }
        });
    }

    if (webSocketImplementation.implementation.open) {
        await webSocketImplementation.implementation.open(webSocketCallbackParams);
    }
}
