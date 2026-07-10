(async () => {
  // ensure token in-process without printing it
  const m = await import('./fetch-test-token.mjs');
  const ok = await m.ensureTestToken();
  if (!ok || !process.env.TEST_TOKEN) {
    console.error('NO_TOKEN');
    process.exit(2);
  }
  const token = process.env.TEST_TOKEN;
  const base = 'http://localhost:3000';
  const endpoints = [
    '/api/v1/auth/me',
    '/api/v1/finance/accounts',
    '/api/v1/finance/journal-entries',
    '/api/v1/finance/ap/invoices',
    '/api/v1/hr/employees',
    '/api/v1/hr/departments',
    '/api/v1/scm/vendors',
    '/api/v1/scm/products',
    '/api/v1/projects',
    '/api/v1/notifications',
    '/api/v1/search?q=test',
  ];

  for (const ep of endpoints) {
    try {
      const url = base + ep;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': 'company-a',
          Accept: 'application/json',
        },
      });
      const status = res.status;
      const text = await res.text().catch(() => '');
      let summary = '';
      try {
        const j = JSON.parse(text);
        if (Array.isArray(j)) summary = `${j.length} items`;
        else if (j && typeof j === 'object') {
          if (Array.isArray(j.data)) summary = `data:${j.data.length}`;
          else if (Array.isArray(j.items)) summary = `items:${j.items.length}`;
          else if (typeof j.totalCount === 'number') summary = `total:${j.totalCount}`;
          else if (typeof j.total === 'number') summary = `total:${j.total}`;
          else summary = Object.keys(j).length ? 'object' : 'empty';
        } else summary = String(j);
      } catch (e) {
        summary = text.slice(0, 200).replace(/\n/g, ' ');
      }
      console.log(`${ep} | ${status} | ${summary}`);
    } catch (e) {
      console.log(`${ep} | ERROR | ${e.message}`);
    }
  }
})();
