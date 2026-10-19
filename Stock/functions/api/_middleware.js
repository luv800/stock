// Optional PIN protection for every /api route. Set APP_PIN in Pages environment variables.
export async function onRequest({ request, env, next }) {
  if (env.APP_PIN && request.headers.get("x-pin") !== env.APP_PIN)
    return new Response(JSON.stringify({ error: "Wrong or missing PIN" }), { status: 401, headers: { "Content-Type": "application/json" } });
  return next();
}
