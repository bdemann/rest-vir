# @rest-vir/large-api-mock

`@rest-vir/large-api-mock` is a private workspace package used to stress-test `rest-vir` TypeScript performance.

It exports:

-   `largeApi`: a generated-style API definition with 8,000 endpoints and 2,000 WebSockets
-   `largeApiImplementation`: dummy host implementations for every route in `largeApi`
-   shared helpers for producing batches of mock endpoint and WebSocket definitions

This package is not published and is not intended for application code. Use it when changing `@rest-vir/api` or `@rest-vir/host` types that could affect compile-time performance on large APIs.

For an application-level example of the public packages, see
[`packages/demo`](https://github.com/electrovir/rest-vir/tree/dev/packages/demo) on GitHub.

## Why It Exists

`rest-vir` captures path literals and method shapes in TypeScript. That needs to stay fast for real projects with hundreds or thousands of routes. This package keeps a deliberately large definition in the monorepo so compile checks catch type designs that scale poorly.

## Working With Large API Definitions

Batch endpoint and WebSocket definitions together in files. Avoid one endpoint definition per file for large APIs because many tiny definition modules can make TypeScript type checking slower.

The source is split into batch files under:

-   `src/endpoints/`
-   `src/web-sockets/`

`src/large-api.mock.ts` combines the batches with `defineApi`, and `src/implement-large-api.mock.ts` verifies that every declared route has a matching implementation.

## Checks

From this package directory:

```sh
npm run compile
npm test
```

From the monorepo root, `npm run compile` includes this package and is the most useful signal for large API type performance.
