export default {
  async fetch(request, env, ctx) {
    return new Response("Not found", { status: 404 });
  },
};
