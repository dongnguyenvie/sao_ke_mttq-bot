const fs = require("fs");
const pdf = require("pdf-parse");
const sqlite3 = require("sqlite3").verbose();
const dayjs = require("dayjs");
const crypto = require("crypto"); // For generating unique hash

// Open the PDF file
let dataBuffer = fs.readFileSync(
  "file-pdf-mat-trang-to-quoc-viet-nam-sao-ke.pdf"
); // update with actual path

// Open a database connection
let db = new sqlite3.Database("./local.db", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the SQLite database.");
});

// Function to create a table
function createTable() {
  db.run(`CREATE TABLE IF NOT EXISTS pdf_content (
            id TEXT PRIMARY KEY,
            date TEXT,
            tnx_date TEXT,
            amount TEXT,
            content TEXT
          )`);
}

// Generate unique ID based on transaction details (hash of date, tnx_date, amount)
function generateUniqueId(date, tnxDate, amount, content) {
  const hash = crypto
    .createHash("md5")
    .update(date + tnxDate + amount + content)
    .digest("hex");
  return hash;
}

// Insert data into the database with a check for uniqueness
function insertData(transaction) {
  const uniqueId = generateUniqueId(
    transaction.date,
    transaction.TNXDate,
    transaction.amount,
    transaction.content
  );

  // Check if the record already exists
  db.get(`SELECT id FROM pdf_content WHERE id = ?`, [uniqueId], (err, row) => {
    if (err) {
      console.error(err.message);
      return;
    }

    if (!row) {
      // If no record exists with the same ID, insert it
      db.run(
        `INSERT INTO pdf_content (id, date, tnx_date, amount, content) VALUES (?, ?, ?, ?, ?)`,
        [
          uniqueId,
          transaction.date,
          transaction.TNXDate,
          transaction.amount,
          transaction.content,
        ],
        function (err) {
          if (err) {
            return console.log(err.message);
          }
          console.log(
            `A new transaction has been inserted with ID ${uniqueId}`
          );
        }
      );
    } else {
      console.log(`Transaction with ID ${uniqueId} already exists.`);
    }
  });
}

function extractData(rawText) {
  // Regular expression to match each block of transaction data
  const transactionPattern =
    /(\d{2}\/\d{2}\/\d{4})\s+(\d+\.\d+)\s+([0-9\.,]+)\s+([\s\S]+?)(?=\n\d{2}\/\d{2}\/\d{4}|\nPage|\Z)/g;

  let transactions = [];
  let match;

  // Loop through all matches in the raw text
  while ((match = transactionPattern.exec(rawText)) !== null) {
    let date = match[1];
    let tnxDate = match[2];
    let amount = match[3].replace(/\./g, ""); // Remove dots for better readability
    let content = match[4].trim();

    transactions.push({
      date: date,
      TNXDate: tnxDate,
      amount: amount,
      content: String(content).toLowerCase(),
    });
  }

  return transactions;
}

async function main() {
  db.serialize(async () => {
    await createTable();
    syncDataFromPdfToDb();
  });
}

function syncDataFromPdfToDb() {
  // Parse the PDF
  pdf(dataBuffer)
    .then(async function (data) {
      // Extract text from the PDF
      let extractedData = extractData(data.text);

      // Create table and insert extracted text into the SQLite DB
      extractedData.forEach((transaction) => {
        insertData(transaction);
      });
    })
    .catch((err) => {
      console.error("Error parsing PDF:", err);
    });
}

main();
