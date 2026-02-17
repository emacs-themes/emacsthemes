interface Env {
  EMACSTHEMES_BUCKET: R2Bucket;
  ENVIRONMENT?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // In development, fall back to local static assets
  if (context.env.ENVIRONMENT === 'development') {
    return context.next();
  }

  // Get the full path from the catch-all parameter
  // For /static/imgs/zenburn/preview.png, path will be ["zenburn", "preview.png"]
  const pathParts = context.params.path;
  const filename = Array.isArray(pathParts) ? pathParts.join('/') : (pathParts as string);

  if (!filename) {
    return new Response('Not Found', { status: 404 });
  }

  // Allow only GET methods (security)
  if (context.request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Fetch the object from R2
  const object = await context.env.EMACSTHEMES_BUCKET.get(filename);

  // If file doesn't exist, return 404
  if (object === null) {
    return new Response('Not Found', { status: 404 });
  }

  // Return the file with correct headers
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // Cache for 1 year (important for performance!)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, {
    headers,
  });
};
