// Node's loader does not see tsx's resolver. test:billing uses
// --conditions=react-server so the server-only package resolves to its
// empty server entry. This hook is for Node itself:
// node --import ./scripts/register-server-only.mjs
import { register } from 'node:module';

register('./server-only-hook.mjs', import.meta.url);
