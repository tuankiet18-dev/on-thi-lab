# Web features

Feature folders own browser-side API calls and, over time, domain hooks and
components. Pages remain route entry points and should compose feature code.

Import new API functions from `features/<domain>/api`. The old `lib/api.ts`
facade remains only so existing screens can migrate without a large risky diff.
