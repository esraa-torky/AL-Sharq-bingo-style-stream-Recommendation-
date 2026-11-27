// Runs on Cloudflare only for addresses that are not a file of the site. Files (index.html, test.html, src/…,
// content/…) are served by Cloudflare directly and never reach this code.
// Its one job: the bare address "/" shows index.html. Anything else that is not a file gets "Not found".
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
