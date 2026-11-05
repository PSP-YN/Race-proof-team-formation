import http from "node:http";

const upstreamHost = process.env.UPSTREAM_HOST || "app";
const upstreamPort = Number(process.env.UPSTREAM_PORT || 3000);
const port = Number(process.env.PORT || 3000);
const trustedHeader = (process.env.TRUSTED_CLIENT_IP_HEADER || "x-forwarded-for").toLowerCase();

function clientAddress(socket) {
  return socket.remoteAddress || "127.0.0.1";
}

function forwardedHeaders(headers, socket) {
  return {
    ...headers,
    host: headers.host || `${upstreamHost}:${upstreamPort}`,
    [trustedHeader]: clientAddress(socket),
    "x-forwarded-host": headers.host || "",
    "x-forwarded-proto": socket.encrypted ? "https" : "http",
  };
}

const server = http.createServer((req, res) => {
  const upstream = http.request({
    hostname: upstreamHost,
    port: upstreamPort,
    method: req.method,
    path: req.url,
    headers: forwardedHeaders(req.headers, req.socket),
  }, response => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });

  upstream.on("error", error => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Local staging proxy could not reach the app.");
    console.error("Upstream request failed:", error.message);
  });

  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const upstream = http.request({
    hostname: upstreamHost,
    port: upstreamPort,
    method: req.method,
    path: req.url,
    headers: forwardedHeaders(req.headers, socket),
  });

  upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    const status = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}\r\n`;
    const headers = Object.entries(response.headers)
      .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(", ") : value}\r\n`)
      .join("");
    socket.write(status + headers + "\r\n");
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstream.on("error", () => socket.destroy());
  upstream.end();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`CrewForge local trusted proxy listening on :${port}; upstream=${upstreamHost}:${upstreamPort}`);
});
