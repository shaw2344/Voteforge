import { ZodError } from 'zod';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        return res.status(400).json({ error: 'Validation failed.', details });
      }
      next(err);
    }
  };
}

export function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large.' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON body.' });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'Internal server error.' });
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Route not found.' });
}
