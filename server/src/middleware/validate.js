export function validateRequest({ body, query, params }) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const issues = err.issues || err.errors || [];
        const message = issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Validation failed';
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid input: ${message}`,
            details: issues
          }
        });
      }
      next(err);
    }
  };
}
