/** Browser-only request helpers. No network requests or persistence happen here. */
export const uid = () => globalThis.crypto?.randomUUID?.() || `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const defaultAuth = () => ({ type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' });

export function blankRequest() {
  return { id: uid(), name: 'Untitled request', method: 'GET', url: '', params: [], headers: [], bodyType: 'none', body: '', auth: defaultAuth(), collectionId: null };
}

function rows(input) {
  return (Array.isArray(input) ? input : []).filter(row => row && typeof row === 'object').map(row => ({
    id: typeof row.id === 'string' ? row.id : uid(), key: String(row.key ?? ''), value: String(row.value ?? ''), enabled: row.enabled !== false,
  }));
}

export function normalizeRequest(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The request must be an object.');
  const base = blankRequest();
  const method = String(input.method || 'GET').toUpperCase();
  return {
    ...base,
    id: typeof input.id === 'string' ? input.id : base.id,
    name: String(input.name || 'Untitled request'),
    method: METHODS.has(method) ? method : 'GET',
    url: String(input.url || ''),
    params: Array.isArray(input.params) ? rows(input.params) : parseUrlParams(String(input.url || '')),
    headers: rows(input.headers),
    bodyType: ['none', 'json', 'text', 'form', 'urlencoded'].includes(input.bodyType) ? input.bodyType : 'none',
    body: String(input.body ?? ''),
    auth: { ...defaultAuth(), ...(input.auth && typeof input.auth === 'object' ? Object.fromEntries(Object.keys(defaultAuth()).filter(key => key in input.auth).map(key => [key, String(input.auth[key] ?? '')])) : {}) },
    collectionId: typeof input.collectionId === 'string' ? input.collectionId : null,
  };
}

export function parseUrlParams(url) {
  const query = String(url).split('#')[0].split('?').slice(1).join('?');
  return [...new URLSearchParams(query)].map(([key, value]) => ({ id: uid(), key, value, enabled: true }));
}

/** Supplied rows replace the complete URL query; disabled and blank-key rows are omitted. */
export function urlWithParams(url, params) {
  const text = String(url);
  const hashAt = text.indexOf('#');
  const hash = hashAt >= 0 ? text.slice(hashAt) : '';
  const base = (hashAt >= 0 ? text.slice(0, hashAt) : text).split('?')[0];
  const search = new URLSearchParams();
  rows(params).filter(row => row.enabled && row.key.trim()).forEach(row => search.append(row.key, row.value));
  return base + (search.size ? `?${search}` : '') + hash;
}

export function resolveVariables(value, variables = {}) {
  const missing = new Set();
  const result = String(value ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key) => {
    key = key.trim();
    if (!Object.prototype.hasOwnProperty.call(variables, key) || variables[key] == null) { missing.add(key); return match; }
    return String(variables[key]);
  });
  if (missing.size) throw new Error(`Missing environment variable${missing.size > 1 ? 's' : ''}: ${[...missing].join(', ')}. Add a value in Environments.`);
  return result;
}

function basicCredentials(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function buildRequest(input, variables = {}) {
  const request = normalizeRequest(input);
  const resolve = value => resolveVariables(value, variables);
  if (!request.url.trim()) throw new Error('Enter an API URL to send a request.');
  const parameters = request.params.filter(row => row.enabled && row.key.trim()).map(row => ({ ...row, key: resolve(row.key), value: resolve(row.value) }));
  const auth = request.auth;
  if (['apiKey', 'apikey', 'api-key'].includes(auth.type) && !auth.key.trim()) throw new Error('Enter a key name in the Authorization tab.');
  if (['apiKey', 'apikey', 'api-key'].includes(auth.type) && auth.addTo === 'query' && auth.key.trim()) {
    parameters.push({ id: uid(), key: resolve(auth.key), value: resolve(auth.value), enabled: true });
  }
  let url;
  // Query rows are authoritative. Do not resolve obsolete/disabled variables from
  // the URL's previous query, or fragments that are never sent to the server.
  const rawBase = request.url.trim().split(/[?#]/)[0];
  try { url = new URL(urlWithParams(resolve(rawBase), parameters)); }
  catch (error) { throw new Error(error.message.startsWith('Missing environment') ? error.message : 'Enter a complete URL beginning with https:// or http://.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs can be requested.');
  if (url.username || url.password) throw new Error('Use the Authorization tab for credentials instead of adding them to the URL.');
  url.hash = '';
  const headers = new Headers();
  for (const row of request.headers.filter(row => row.enabled && row.key.trim())) {
    const key = resolve(row.key).trim();
    const value = resolve(row.value);
    try { headers.append(key, value); }
    catch { throw new Error(`Invalid request header: ${key}. Check its name and value.`); }
  }
  if (auth.type === 'bearer') headers.set('Authorization', `Bearer ${resolve(auth.token)}`);
  if (auth.type === 'basic') headers.set('Authorization', `Basic ${basicCredentials(resolve(auth.username), resolve(auth.password))}`);
  if (['apiKey', 'apikey', 'api-key'].includes(auth.type) && auth.addTo !== 'query') {
    if (!auth.key.trim()) throw new Error('Enter a key name in the Authorization tab.');
    try { headers.set(resolve(auth.key), resolve(auth.value)); }
    catch { throw new Error('The API key header name or value is invalid.'); }
  }
  const options = { method: request.method, headers: Object.fromEntries(headers.entries()), redirect: 'follow' };
  if (request.bodyType !== 'none') {
    const body = resolve(request.body);
    if (['GET', 'HEAD'].includes(request.method) && body) throw new Error(`${request.method} requests cannot include a body in a browser. Select POST, PUT, or PATCH, or choose no body.`);
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (request.bodyType === 'json' && body.trim()) {
        try { JSON.parse(body); } catch { throw new Error('The request body is not valid JSON. Fix it or select Text.'); }
      }
      options.body = body;
      if (!headers.has('content-type')) options.headers['content-type'] = request.bodyType === 'json' ? 'application/json' : ['form', 'urlencoded'].includes(request.bodyType) ? 'application/x-www-form-urlencoded' : 'text/plain';
    }
  }
  return { url: url.href, options };
}

function tokenizeShell(command) {
  const tokens = [];
  let token = '', quote = null, started = false;
  const text = command;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote === "'") {
      if (char === "'") quote = null; else token += char;
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === '\\' && text[i + 1] === '\n') i++;
      else if (char === '\\' && text[i + 1] === '\r' && text[i + 2] === '\n') i += 2;
      else if (char === '\\' && ['"', '\\', '$', '`'].includes(text[i + 1])) token += text[++i];
      else token += char;
      continue;
    }
    if ((char === '\\' || char === '^') && text[i + 1] === '\n') i++;
    else if ((char === '\\' || char === '^') && text[i + 1] === '\r' && text[i + 2] === '\n') i += 2;
    else if (char === "'" || char === '"') { quote = char; started = true; }
    else if (char === '\\') { if (i === text.length - 1) throw new Error('The cURL command ends with an incomplete escape.'); token += text[++i]; started = true; }
    else if (/\s/.test(char)) { if (started) { tokens.push(token); token = ''; started = false; } }
    else { token += char; started = true; }
  }
  if (quote) throw new Error('The cURL command has an unclosed quote.');
  if (started) tokens.push(token);
  return tokens;
}

function noFile(value) {
  if (value.startsWith('@')) throw new Error('cURL file references are not supported. Paste the file contents into the request body.');
  return value;
}

export function parseCurl(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Paste a cURL command to import.');
  const tokens = tokenizeShell(input.trim().replace(/^\$\s+/, ''));
  if (!/^curl(?:\.exe)?$/i.test(tokens.shift() || '')) throw new Error('The command must begin with curl.');
  const request = blankRequest();
  const bodyParts = [];
  let method = null, get = false, head = false, json = false, hasBody = false, url = null;
  const take = (index, flag) => {
    if (index >= tokens.length) throw new Error(`${flag} requires a value.`);
    return tokens[index];
  };
  for (let i = 0; i < tokens.length; i++) {
    let flag = tokens[i], inline;
    if (flag.startsWith('--') && flag.includes('=')) { const at = flag.indexOf('='); inline = flag.slice(at + 1); flag = flag.slice(0, at); }
    else if (/^-[XHdu]/.test(flag) && flag.length > 2) { inline = flag.slice(2); flag = flag.slice(0, 2); }
    const value = () => inline !== undefined ? inline : take(++i, flag);
    if (flag === '-X' || flag === '--request') method = value().toUpperCase();
    else if (flag === '--url') { if (url !== null) throw new Error('Import one cURL URL at a time.'); url = value(); }
    else if (flag === '-H' || flag === '--header') {
      const header = value();
      const at = header.indexOf(':');
      if (at <= 0) throw new Error('Headers must use the format "Name: value".');
      request.headers.push({ id: uid(), key: header.slice(0, at).trim(), value: header.slice(at + 1).trim(), enabled: true });
    } else if (['-d', '--data', '--data-raw', '--data-binary', '--json'].includes(flag)) {
      const data = value();
      bodyParts.push(flag === '--data-raw' ? data : noFile(data));
      hasBody = true;
      if (flag === '--json') json = true;
    } else if (flag === '--data-urlencode') {
      const data = noFile(value());
      const at = data.indexOf('=');
      if (at < 0 && data.includes('@')) throw new Error('cURL file references are not supported. Paste the value directly.');
      bodyParts.push(at >= 0 ? `${data.slice(0, at)}=${encodeURIComponent(data.slice(at + 1))}` : encodeURIComponent(data));
      hasBody = true;
    } else if (flag === '-u' || flag === '--user') {
      const credentials = value();
      const at = credentials.indexOf(':');
      request.auth = { ...defaultAuth(), type: 'basic', username: at < 0 ? credentials : credentials.slice(0, at), password: at < 0 ? '' : credentials.slice(at + 1) };
    } else if (flag === '-G' || flag === '--get') get = true;
    else if (flag === '-I' || flag === '--head') head = true;
    else if (['-L', '--location', '--compressed', '-s', '--silent', '-S', '--show-error', '-i', '--include', '-v', '--verbose', '--globoff', '-g'].includes(flag)) { /* Browser or interface already handles these flags. */ }
    else if (/^-/.test(flag)) throw new Error(`The cURL option ${flag} is not supported by this browser tester.`);
    else { if (url !== null) throw new Error('Import one cURL URL at a time.'); url = flag; }
  }
  if (!url) throw new Error('The cURL command does not contain a URL.');
  if (!/^https?:\/\//i.test(url) && !url.includes('{{')) throw new Error('The cURL URL must begin with http:// or https://.');
  request.url = url;
  request.params = parseUrlParams(url);
  if (get && hasBody) {
    request.params.push(...parseUrlParams(`?${bodyParts.join('&')}`));
    request.url = urlWithParams(url, request.params);
  } else if (hasBody) {
    request.body = bodyParts.join('&');
    const contentType = request.headers.find(row => row.key.toLowerCase() === 'content-type')?.value.toLowerCase() || '';
    request.bodyType = json || contentType.includes('json') ? 'json' : contentType.includes('text/plain') ? 'text' : 'form';
    if (json) {
      if (!request.headers.some(row => row.key.toLowerCase() === 'content-type')) request.headers.push({ id: uid(), key: 'Content-Type', value: 'application/json', enabled: true });
      if (!request.headers.some(row => row.key.toLowerCase() === 'accept')) request.headers.push({ id: uid(), key: 'Accept', value: 'application/json', enabled: true });
    }
  }
  request.method = method || (head ? 'HEAD' : get ? 'GET' : hasBody ? 'POST' : 'GET');
  if (!METHODS.has(request.method)) throw new Error(`The HTTP method ${request.method} is not supported.`);
  request.name = 'Imported request';
  return request;
}

const shellQuote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;

export function generateCurl(request, variables = {}) {
  const { url, options } = buildRequest(request, variables);
  const parts = [`curl --request ${options.method}`, `  --url ${shellQuote(url)}`];
  for (const [key, value] of Object.entries(options.headers)) parts.push(`  --header ${shellQuote(`${key}: ${value}`)}`);
  if (Object.prototype.hasOwnProperty.call(options, 'body')) parts.push(`  --data-raw ${shellQuote(options.body)}`);
  return parts.join(' \\\n');
}

export function formatBytes(bytes) {
  const amount = Math.max(0, Number(bytes) || 0);
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 * 1024) return `${(amount / 1024).toFixed(1)} KB`;
  return `${(amount / (1024 * 1024)).toFixed(1)} MB`;
}
