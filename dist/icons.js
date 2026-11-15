const paths = {
  plus:'M12 5v14M5 12h14', close:'m6 6 12 12M6 18 18 6', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', search:'m21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  folder:'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z', collection:'M4 4h16v5H4zM4 12h16v8H4zM8 6.5h.01M8 16h.01', history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
  environment:'m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z',
  code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18', save:'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
  import:'M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6', export:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6', copy:'M9 9h12v12H9zM5 15H3V3h12v2', check:'m5 12 4 4L19 6',
  arrow:'M4 12h16m-6-6 6 6-6 6', send:'m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2', shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', more:'M5 12h.01M12 12h.01M19 12h.01', globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2', bolt:'m13 2-9 12h7l-1 8 10-13h-7l1-7Z', terminal:'m4 6 6 6-6 6m9 0h7',
  help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', menu:'M3 6h18M3 12h18M3 18h18', sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon:'M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z', edit:'m15 4 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z', lock:'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4', alert:'m12 3 10 18H2L12 3Zm0 6v5m0 3h.01', book:'M4 3h7a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4V3Zm10 3a3 3 0 0 1 3-3h4v16h-3a4 4 0 0 0-4 2', download:'M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3'
};
export function icon(name,cls='') { return `<svg class="icon ${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.code}"/></svg>`; }
