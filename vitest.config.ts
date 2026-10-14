import {defineConfig} from 'vitest/config';
// Engine/analytics fixtures are CPU-heavy. Keep their workers bounded so a
// concurrent browser playtest does not starve the suite's RPC/event loop.
export default defineConfig({test:{include:['tests/**/*.test.ts'],maxWorkers:2}});
