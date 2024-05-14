import { createDirectus } from '@directus/sdk';

const client = createDirectus('http://localhost:8010/proxy').with(authentication('json')).with(rest());
