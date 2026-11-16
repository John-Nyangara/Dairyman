const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { PassThrough } = require("node:stream");

const db = require("../config/db");
const app = require("../app");

function invokeApp(method, url, { headers = {}, body = "" } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new PassThrough();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );

    const res = new http.ServerResponse(req);
    const chunks = [];
    const outStream = new PassThrough();
    outStream.on("data", (chunk) => chunks.push(chunk));
    res.assignSocket(outStream);

    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const headerEnd = raw.indexOf("\r\n\r\n");
      const responseBody = headerEnd >= 0 ? raw.slice(headerEnd + 4) : raw;
      const result = originalEnd(chunk, encoding, cb);
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: responseBody,
      });
      return result;
    };

    res.on("error", reject);
    app(req, res);

    if (body) {
      req.push(body);
    }
    req.push(null);
  });
}

test("Express MVC app handles full bcrypt register -> login -> session -> logout HTTP flow", async (t) => {
  const originalQuery = db.query;
  const users = [];

  db.query = async (sql, params) => {
    if (/FROM Farmers/i.test(sql) && /SELECT/i.test(sql)) {
      const found = users.find((u) => u.email === params[0]);
      return found ? [found] : [];
    }
    if (/INSERT INTO Farmers/i.test(sql)) {
      const newUser = {
        farmer_id: users.length + 1,
        fullname: params[0],
        phone: params[1],
        email: params[2],
        password: params[3],
        county: params[4],
        farm_location: params[5],
        farm_name: params[6],
      };
      users.push(newUser);
      return { insertId: newUser.farmer_id };
    }
    if (/FROM MilkProduction/i.test(sql)) {
      return [];
    }
    return [];
  };

  t.after(() => {
    db.query = originalQuery;
  });

  // 1. Unauthenticated access to /dashboard redirects to /login?message=unauthorized
  const unauthRes = await invokeApp("GET", "/dashboard");
  assert.equal(unauthRes.status, 302);
  assert.equal(unauthRes.headers.location, "/login?message=unauthorized");

  // 2. GET /register renders form without hardcoded localhost action
  const regPage = await invokeApp("GET", "/register");
  assert.equal(regPage.status, 200);
  assert.match(regPage.body, /action="\/register"/);

  // 3. POST /register creates farmer with bcrypt hash
  const formBody = new URLSearchParams({
    fullname: "Test Farmer",
    phone: "0712345678",
    email: "test@dairyman.com",
    password: "password123",
    county: "Nakuru",
    farm_location: "Rongai",
    farm_name: "Test Farm",
  }).toString();

  const regRes = await invokeApp("POST", "/register", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(formBody)),
    },
    body: formBody,
  });
  assert.equal(regRes.status, 302);
  assert.equal(regRes.headers.location, "/login?message=success");
  assert.equal(users.length, 1);
  assert.match(users[0].password, /^\$2[aby]\$/);

  // 4. POST /login with wrong password fails
  const wrongLoginBody = new URLSearchParams({
    email: "test@dairyman.com",
    password: "wrongpassword",
  }).toString();
  const badLoginRes = await invokeApp("POST", "/login", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(wrongLoginBody)),
    },
    body: wrongLoginBody,
  });
  assert.equal(badLoginRes.status, 302);
  assert.equal(badLoginRes.headers.location, "/login?message=invalid");

  // 5. POST /login with correct password sets session cookie and redirects to /dashboard
  const loginBody = new URLSearchParams({
    email: "test@dairyman.com",
    password: "password123",
  }).toString();
  const loginRes = await invokeApp("POST", "/login", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(loginBody)),
    },
    body: loginBody,
  });
  assert.equal(loginRes.status, 302);
  assert.equal(loginRes.headers.location, "/dashboard");
  const setCookies = loginRes.headers["set-cookie"];
  assert.ok(setCookies && setCookies.length > 0);
  const cookieHeader = setCookies[0].split(";")[0];

  // 6. Authenticated GET /dashboard succeeds and renders farmer name
  const dashRes = await invokeApp("GET", "/dashboard", {
    headers: { Cookie: cookieHeader },
  });
  assert.equal(dashRes.status, 200);
  assert.match(dashRes.body, /Test Farmer/);

  // 7. GET /logout destroys session and blocks subsequent /dashboard access
  const logoutRes = await invokeApp("GET", "/logout", {
    headers: { Cookie: cookieHeader },
  });
  assert.equal(logoutRes.status, 302);
  assert.equal(logoutRes.headers.location, "/login?message=logged_out");

  const afterLogoutDash = await invokeApp("GET", "/dashboard", {
    headers: { Cookie: cookieHeader },
  });
  assert.equal(afterLogoutDash.status, 302);
  assert.equal(afterLogoutDash.headers.location, "/login?message=unauthorized");
});
