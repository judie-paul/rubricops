const url = process.argv[2] || 'http://localhost:3001/login';
let ready = false;
for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* server may still be starting */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready) {
  console.error(`Server did not become ready: ${url}`);
  process.exit(1);
}
