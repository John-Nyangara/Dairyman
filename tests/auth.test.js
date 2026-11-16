const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcrypt");

const db = require("../config/db");
const FarmerModel = require("../models/farmerModel");
const authController = require("../controllers/authController");
const {
  attachFarmerToLocals,
  requireAuth,
} = require("../middleware/authMiddleware");
const { SESSION_COOKIE_NAME } = require("../config/session");

function createMockRes() {
  return {
    statusCode: 200,
    locals: {},
    redirectedTo: null,
    sentBody: null,
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    redirect(location) {
      this.redirectedTo = location;
      return this;
    },
    send(body) {
      this.sentBody = body;
      return this;
    },
    render(view, data) {
      this.renderedView = view;
      this.renderedData = data;
      return this;
    },
    clearCookie(name) {
      this.clearedCookies.push(name);
      return this;
    },
  };
}

test("FarmerModel hashes passwords with unique per-user bcrypt salts and verifies them", async () => {
  const hash1 = await FarmerModel.hashPassword("secret123");
  const hash2 = await FarmerModel.hashPassword("secret123");

  assert.notEqual(hash1, "secret123");
  assert.notEqual(hash1, hash2);
  assert.match(hash1, /^\$2[aby]\$/);

  assert.equal(await FarmerModel.verifyPassword("secret123", hash1), true);
  assert.equal(await FarmerModel.verifyPassword("wrongpass", hash1), false);
  assert.equal(await FarmerModel.verifyPassword("", hash1), false);
  assert.equal(await FarmerModel.verifyPassword("secret123", null), false);
});

test("FarmerModel.create stores bcrypt hash and normalized email", async (t) => {
  const originalQuery = db.query;
  let capturedSql = "";
  let capturedParams = [];

  db.query = async (sql, params) => {
    capturedSql = sql;
    capturedParams = params;
    return { insertId: 42 };
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const insertId = await FarmerModel.create({
    fullname: "  Jane Doe  ",
    phone: " 0711111111 ",
    email: "  Jane.Doe@Example.COM ",
    password: "mypassword",
    county: "Kiambu",
    farm_location: "Limuru",
    farm_name: "Highland Dairy",
  });

  assert.equal(insertId, 42);
  assert.match(capturedSql, /INSERT INTO Farmers/i);
  assert.equal(capturedParams[0], "Jane Doe");
  assert.equal(capturedParams[2], "jane.doe@example.com");
  assert.notEqual(capturedParams[3], "mypassword");
  assert.equal(await bcrypt.compare("mypassword", capturedParams[3]), true);
});

test("authController.register registers a new farmer with bcrypt and redirects to login", async (t) => {
  const originalQuery = db.query;
  const users = [];

  db.query = async (sql, params) => {
    if (/SELECT/i.test(sql)) {
      const match = users.find((u) => u.email === params[0]);
      return match ? [match] : [];
    }
    if (/INSERT INTO Farmers/i.test(sql)) {
      users.push({
        farmer_id: users.length + 1,
        fullname: params[0],
        phone: params[1],
        email: params[2],
        password: params[3],
        county: params[4],
        farm_location: params[5],
        farm_name: params[6],
      });
      return { insertId: users.length };
    }
    return [];
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const res = createMockRes();
  await authController.register(
    {
      body: {
        fullname: "Alice Farmer",
        phone: "0700000000",
        email: "Alice@Farm.com",
        password: "strongpassword",
        county: "Nakuru",
        farm_location: "Naivasha",
        farm_name: "Lakeview",
      },
    },
    res
  );

  assert.equal(res.redirectedTo, "/login?message=success");
  assert.equal(users.length, 1);
  assert.equal(users[0].email, "alice@farm.com");
  assert.equal(
    await bcrypt.compare("strongpassword", users[0].password),
    true
  );

  // Duplicate email registration redirects with exists message
  const duplicateRes = createMockRes();
  await authController.register(
    {
      body: {
        fullname: "Alice Farmer",
        email: "alice@farm.com",
        password: "strongpassword",
      },
    },
    duplicateRes
  );
  assert.equal(duplicateRes.redirectedTo, "/login?message=exists");
});

test("authController.login verifies bcrypt password, stores safe session user, and rejects invalid passwords", async (t) => {
  const originalQuery = db.query;
  const hashedPassword = await bcrypt.hash("john123", 10);

  db.query = async (sql, params) => {
    if (params[0] === "john@example.com") {
      return [
        {
          farmer_id: 1,
          fullname: "John Mwangi",
          email: "john@example.com",
          password: hashedPassword,
          farm_name: "Green Pastures",
        },
      ];
    }
    return [];
  };
  t.after(() => {
    db.query = originalQuery;
  });

  // Invalid password
  const badRes = createMockRes();
  await authController.login(
    {
      body: { email: "john@example.com", password: "wrong" },
      session: {},
    },
    badRes
  );
  assert.equal(badRes.redirectedTo, "/login?message=invalid");

  // Valid password (with whitespace and uppercase email)
  let saved = false;
  let regenerated = false;
  const session = {
    regenerate(cb) {
      regenerated = true;
      cb(null);
    },
    save(cb) {
      saved = true;
      cb(null);
    },
  };
  const goodRes = createMockRes();
  await authController.login(
    {
      body: { email: "  JOHN@Example.com ", password: "john123" },
      session,
    },
    goodRes
  );

  assert.equal(regenerated, true);
  assert.equal(saved, true);
  assert.equal(goodRes.redirectedTo, "/dashboard");
  assert.deepEqual(session.farmer, {
    farmer_id: 1,
    email: "john@example.com",
    fullname: "John Mwangi",
    farm_name: "Green Pastures",
  });
  assert.equal("password" in session.farmer, false);
});

test("authController.logout destroys session and clears session cookie", () => {
  let destroyed = false;
  const req = {
    session: {
      destroy(cb) {
        destroyed = true;
        cb(null);
      },
    },
  };
  const res = createMockRes();

  authController.logout(req, res);

  assert.equal(destroyed, true);
  assert.deepEqual(res.clearedCookies, [SESSION_COOKIE_NAME]);
  assert.equal(res.redirectedTo, "/login?message=logged_out");
});

test("authMiddleware protects private routes and populates res.locals.farmer", () => {
  const unauthRes = createMockRes();
  let nextCalled = false;
  requireAuth({ session: {} }, unauthRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(unauthRes.redirectedTo, "/login?message=unauthorized");

  const authRes = createMockRes();
  const farmer = { farmer_id: 1, fullname: "John Mwangi" };
  attachFarmerToLocals({ session: { farmer } }, authRes, () => {});
  assert.deepEqual(authRes.locals.farmer, farmer);

  let authNext = false;
  requireAuth({ session: { farmer } }, authRes, () => {
    authNext = true;
  });
  assert.equal(authNext, true);
});

test("db.sql seed farmers use valid bcrypt hashes for john123 and mary123", async () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "db.sql"), "utf8");
  const hashes = sql.match(/\$2b\$10\$[A-Za-z0-9./]{53}/g);
  assert.ok(hashes && hashes.length >= 2);
  assert.equal(await bcrypt.compare("john123", hashes[0]), true);
  assert.equal(await bcrypt.compare("mary123", hashes[1]), true);
});
