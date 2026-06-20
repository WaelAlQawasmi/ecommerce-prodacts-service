import path from 'path';
import { generateOpenApiSpec } from './interfaces/http/swagger';

const output = path.join(__dirname, 'interfaces/http/openapi.json');
generateOpenApiSpec(3001, output);
console.log(`OpenAPI spec written to ${output}`);
