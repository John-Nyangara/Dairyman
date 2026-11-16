const app = require("./app");
const db = require("./config/db");

const PORT = Number(process.env.PORT) || 3000;

db.initializeDatabase()
  .then(() => {
    console.log("Database is ready.");
  })
  .catch((err) => {
    console.error("Database initialization warning:", err.message);
  });

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
