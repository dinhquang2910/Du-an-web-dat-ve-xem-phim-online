const sql = require("mssql/msnodesqlv8");

const config = {
  server: "localhost\\SQLEXPRESS",
  database: "web_dat_ve",
  driver: "ODBC Driver 18 for SQL Server",
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

const poolPromise = sql.connect(config);

module.exports = {
  sql,
  poolPromise,
};

// require("dotenv").config();

// const { Pool } = require("pg");

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

// module.exports = {
//   pool,
// };
