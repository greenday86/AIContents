// export default {
//   async fetch(request) {
//     return new Response("Hello from Cloudflare Worker!", {
//       headers: { "content-type": "text/plain" },
//     });
//   },
// };
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // 루트( / ) 또는 빈 경로에 대한 요청이면 index.html로 리다이렉트
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(`${url.origin}/index.html`, 301);
    }
    // 그 외 경로는 기존처럼 처리
    return fetch(request);
  }
};
