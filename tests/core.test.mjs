import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRequest, normalizeRequest, parseUrlParams, urlWithParams, resolveVariables, buildRequest, parseCurl, generateCurl, formatBytes } from '../dist/core.js';

test('query rows preserve repeated parameters and authoritative disabled rows', () => {
  const params = parseUrlParams('https://example.test/items?tag=one&tag=two&phrase=hello+world');
  assert.equal(params.length, 3);
  params[1].enabled = false;
  assert.equal(urlWithParams('https://example.test/items?old=x#top', params), 'https://example.test/items?tag=one&phrase=hello+world#top');
  assert.equal(buildRequest({ url: 'https://example.test/?old=1', params: [] }).url, 'https://example.test/');
});

test('normalization derives existing URL query only when params are absent', () => {
  assert.equal(normalizeRequest({ url: 'https://example.test?q=3' }).params[0].value, '3');
  assert.equal(normalizeRequest({ url: 'https://example.test?q=3', params: [] }).params.length, 0);
  assert.equal(normalizeRequest({ headers: [null, { key: 'X', value: 2 }] }).headers[0].value, '2');
});

test('environment variables resolve URL, params, headers, auth and body', () => {
  const request = normalizeRequest({ url: '{{host}}/items?name={{name}}', method: 'POST', headers: [{ key: 'X-Env', value: '{{env}}' }], bodyType: 'json', body: '{"name":"{{name}}"}', auth: { type: 'bearer', token: '{{token}}' } });
  const built = buildRequest(request, { host: 'https://example.test', name: 'A & B', env: 'dev', token: 'abc' });
  assert.equal(built.url, 'https://example.test/items?name=A+%26+B');
  assert.equal(built.options.headers.authorization, 'Bearer abc');
  assert.equal(built.options.headers['x-env'], 'dev');
  assert.equal(built.options.headers['content-type'], 'application/json');
  assert.equal(built.options.body, '{"name":"A & B"}');
  assert.throws(() => resolveVariables('{{missing}}'), /Missing environment variable/);
  assert.equal(resolveVariables('{{toString}}', { toString: 'value' }), 'value');
  assert.throws(() => resolveVariables('{{constructor}}', {}), /Missing/);
});

test('validates protocols, embedded credentials, malformed JSON and browser GET bodies', () => {
  assert.throws(() => buildRequest({ url: 'file:///etc/test' }), /Only HTTP/);
  assert.throws(() => buildRequest({ url: 'https://user:password@example.test' }), /Authorization tab/);
  assert.throws(() => buildRequest({ url: 'https://example.test', method: 'POST', bodyType: 'json', body: '{' }), /valid JSON/);
  assert.throws(() => buildRequest({ url: 'https://example.test', bodyType: 'text', body: 'hi' }), /cannot include a body/);
  assert.throws(() => buildRequest(blankRequest()), /Enter an API URL/);
});

test('basic auth preserves colons in passwords and API keys support query parameters', () => {
  const imported = parseCurl("curl -u 'name:pass:word' https://example.test");
  assert.equal(buildRequest(imported).options.headers.authorization, 'Basic bmFtZTpwYXNzOndvcmQ=');
  const request = normalizeRequest({ url: 'https://example.test', auth: { type: 'apiKey', key: 'key', value: 'a+b', addTo: 'query' } });
  assert.equal(buildRequest(request).url, 'https://example.test/?key=a%2Bb');
});

test('imports JSON cURL with continuation, inline flags, quoted apostrophes, and explicit method', () => {
  const input = `curl --location 'https://example.test/items?a=1' \\\n -XPATCH -H 'Content-Type: application/json' \\\n --data-raw '{"name":"O'"'"'Brien"}'`;
  const request = parseCurl(input);
  assert.equal(request.method, 'PATCH');
  assert.equal(request.bodyType, 'json');
  assert.equal(request.body, '{"name":"O\'Brien"}');
  assert.equal(request.params[0].key, 'a');
});

test('cURL generation and import round-trip complex JSON and quoted header', () => {
  const request = normalizeRequest({ method: 'POST', url: 'https://example.test', bodyType: 'json', body: JSON.stringify({ author: "O'Brien", text: 'a "quote" \\ slash' }), headers: [{ key: 'X-Test', value: "it's good" }] });
  const generated = generateCurl(request);
  const imported = parseCurl(generated);
  assert.deepEqual(buildRequest(imported), buildRequest(request));
});

test('cURL GET and URL-encoded flags append encoded data to URL', () => {
  const request = parseCurl("curl -G 'https://example.test?q=one' --data-urlencode 'name=A & B' --data-urlencode 'tag=two'");
  assert.equal(request.method, 'GET');
  assert.equal(request.bodyType, 'none');
  assert.equal(buildRequest(request).url, 'https://example.test/?q=one&name=A+%26+B&tag=two');
});

test('cURL --json adds JSON headers and HEAD works', () => {
  const request = parseCurl('curl --url=https://example.test --json \'{"a":1}\'');
  assert.equal(request.method, 'POST');
  assert.equal(buildRequest(request).options.headers.accept, 'application/json');
  assert.equal(parseCurl('curl --head https://example.test').method, 'HEAD');
});

test('cURL parser rejects incomplete quotes, file reads, unsupported flags and multiple URLs', () => {
  assert.throws(() => parseCurl("curl 'https://example.test"), /unclosed quote/);
  assert.throws(() => parseCurl("curl https://example.test --data @secret.txt"), /file references/);
  assert.throws(() => parseCurl("curl https://example.test --insecure"), /not supported/);
  assert.throws(() => parseCurl("curl https://example.test https://other.test"), /one cURL URL/);
  assert.throws(() => parseCurl("curl https://example.test -H"), /requires a value/);
});

test('formats response body bytes', () => {
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(2048), '2.0 KB');
});

test('query variables survive URL encoding and resolve once after editing', () => {
  const params = [{ key: 'search', value: '{{term}}', enabled: true }];
  const editedUrl = urlWithParams('{{base_url}}/search', params);
  assert.match(editedUrl, /%7B%7Bterm%7D%7D/);
  const restored = normalizeRequest({ url: editedUrl });
  assert.equal(restored.params[0].value, '{{term}}');
  assert.equal(buildRequest(restored, { base_url: 'https://example.test', term: 'a&b #c+?' }).url, 'https://example.test/search?search=a%26b+%23c%2B%3F');
});

test('disabled, replaced query variables and fragments never require environment values', () => {
  const request = normalizeRequest({ url: 'https://example.test/items?key={{disabled}}#{{unused}}' });
  request.params[0].enabled = false;
  assert.equal(buildRequest(request).url, 'https://example.test/items');
  request.params = [{ key: 'q', value: 'new', enabled: true }];
  assert.equal(buildRequest(request).url, 'https://example.test/items?q=new');
  assert.throws(() => buildRequest({ url: '{{missing_base}}/items' }), /Missing environment variable/);
});

test('cURL round-trip preserves literal backslash newlines in single-quoted text bodies', () => {
  const body = 'first \\\nsecond ^\nthird';
  const request = normalizeRequest({ url: 'https://example.test', method: 'POST', bodyType: 'text', body });
  assert.equal(parseCurl(generateCurl(request)).body, body);
  assert.equal(parseCurl("curl ^\r\n https://example.test ^\r\n -I").method, 'HEAD');
});

test('API key query auth requires a key name, like header auth', () => {
  assert.throws(() => buildRequest({ url: 'https://example.test', auth: { type: 'apiKey', addTo: 'query', key: '', value: 'secret' } }), /key name/);
});
