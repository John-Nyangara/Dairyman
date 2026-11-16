const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../config/db");
const dashboardController = require("../controllers/dashboardController");
const animalController = require("../controllers/animalController");
const milkProductionController = require("../controllers/milkProductionController");
const {
  groupAndExtractLatest,
  getChartData,
} = require("../utils/chartHelpers");

function createMockRes() {
  return {
    statusCode: 200,
    locals: {},
    redirectedTo: null,
    sentBody: null,
    renderedView: null,
    renderedData: null,
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
  };
}

test("chartHelpers formats daily production series and animal totals", () => {
  const grouped = groupAndExtractLatest([
    {
      animal_tag: "A002",
      animal_name: "Pendo",
      production_date: "2023-08-02T00:00:00.000Z",
      total_daily_production: 12.7,
    },
    {
      animal_tag: "A002",
      animal_name: "Pendo",
      production_date: "2023-08-01T00:00:00.000Z",
      total_daily_production: 12.5,
    },
  ]);

  assert.equal(grouped.A002.animal_name, "Pendo");
  assert.deepEqual(grouped.A002.total_daily_productions, [12.7, 12.5]);

  const [labels, totals] = getChartData([
    { animal_name: "Pendo", animal_tag: "A002", total_production: 25.2 },
  ]);
  assert.deepEqual(labels, ["Pendo-A002"]);
  assert.deepEqual(totals, [25.2]);
});

test("dashboardController.showDashboard renders dashboard.ejs with groupedData", async (t) => {
  const originalQuery = db.query;
  db.query = async () => [
    {
      animal_tag: "A002",
      animal_name: "Pendo",
      production_date: "2023-08-01",
      total_daily_production: 12.5,
    },
  ];
  t.after(() => {
    db.query = originalQuery;
  });

  const res = createMockRes();
  await dashboardController.showDashboard(
    { session: { farmer: { farmer_id: 1 } } },
    res
  );

  assert.equal(res.renderedView, "dashboard.ejs");
  assert.equal(res.renderedData.groupedData.A002.animal_name, "Pendo");
});

test("animalController.listProfiles and createAnimal interact with models cleanly", async (t) => {
  const originalQuery = db.query;
  let insertedParams = null;

  db.query = async (sql, params) => {
    if (/GROUP BY/i.test(sql)) {
      return [
        { animal_name: "Pendo", animal_tag: "A002", total_production: 20 },
      ];
    }
    if (/SELECT \* FROM Animal/i.test(sql)) {
      return [{ animal_tag: "A002", name: "Pendo" }];
    }
    if (/INSERT INTO Animal/i.test(sql)) {
      insertedParams = params;
      return { affectedRows: 1 };
    }
    return [];
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const listRes = createMockRes();
  await animalController.listProfiles(
    { session: { farmer: { farmer_id: 1 } } },
    listRes
  );
  assert.equal(listRes.renderedView, "animal-profiles.ejs");
  assert.deepEqual(listRes.renderedData.animals, [["Pendo-A002"], [20]]);
  assert.equal(listRes.renderedData.allAnimalsForFarmer.length, 1);

  const createRes = createMockRes();
  await animalController.createAnimal(
    {
      session: { farmer: { farmer_id: 1 } },
      body: {
        animal_tag: "A020",
        name: "Bessie",
        dob: "2022-01-10",
        purchase_date: "",
        breed: "Friesian",
        source: "Birth",
        gender: "Female",
        status: "Alive",
      },
      file: { filename: "cow.png" },
    },
    createRes
  );
  assert.equal(createRes.redirectedTo, "/animal-profiles");
  assert.equal(insertedParams[3], null);
  assert.equal(insertedParams[9], "cow.png");
});

test("milkProductionController verifies animal ownership before inserting production", async (t) => {
  const originalQuery = db.query;
  let insertCalled = false;

  db.query = async (sql, params) => {
    if (/FROM Animal/i.test(sql) && /owner_id = \?/i.test(sql)) {
      return params[0] === "A002" && params[1] === 1
        ? [{ animal_tag: "A002", owner_id: 1 }]
        : [];
    }
    if (/INSERT INTO MilkProduction/i.test(sql)) {
      insertCalled = true;
      return { insertId: 10 };
    }
    return [];
  };
  t.after(() => {
    db.query = originalQuery;
  });

  const forbiddenRes = createMockRes();
  await milkProductionController.addProduction(
    {
      session: { farmer: { farmer_id: 1 } },
      body: {
        animal_unique_val: "A999",
        production_date: "2024-01-01",
        production_time: "06:00",
        quantity: "10.5",
      },
    },
    forbiddenRes
  );
  assert.equal(forbiddenRes.statusCode, 403);
  assert.equal(insertCalled, false);

  const okRes = createMockRes();
  await milkProductionController.addProduction(
    {
      session: { farmer: { farmer_id: 1 } },
      body: {
        animal_unique_val: "A002",
        production_date: "2024-01-01",
        production_time: "06:00",
        quantity: "10.5",
        quality: "High",
      },
    },
    okRes
  );
  assert.equal(insertCalled, true);
  assert.equal(okRes.redirectedTo, "/milk-production");
});

