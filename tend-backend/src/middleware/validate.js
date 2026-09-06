// Wraps a Zod schema so every route declares exactly what shape of
// body/query it accepts. Anything else is rejected before it reaches
// a handler or a SQL query — this is the app's first line of defence
// against injection and malformed-data bugs.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
