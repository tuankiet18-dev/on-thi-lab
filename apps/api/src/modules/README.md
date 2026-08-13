# API modules

Each folder owns HTTP translation for one business domain. A route module may
validate input, map repository errors to HTTP responses, and shape public URLs.
It must not construct production dependencies or call another internal module
over HTTP.

`app.ts` registers modules after authentication/profile middleware. When moving
an endpoint, preserve its path, middleware, status code and response body, then
run the full API test suite.
