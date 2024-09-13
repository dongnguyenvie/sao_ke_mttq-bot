// dotenv
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto"); // For generating unique hash

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("Please set the TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}

// Create a new Telegram bot using your bot token (replace with your actual token)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

// Open a connection to the SQLite database
let db = new sqlite3.Database("./local.db", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the SQLite database.");
});

// Function to search for transactions by content or amount
function searchDatabase(query, callback) {
  const sql = `
    SELECT date, tnx_date, amount, content
    FROM pdf_content
    WHERE content LIKE ? OR amount = ?`;

  const searchQuery = `%${query}%`; // Use wildcard search for content

  db.all(sql, [searchQuery, query], (err, rows) => {
    if (err) {
      console.error(err.message);
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

// Function to format the search results into a readable format
function formatResults(rows) {
  if (rows.length === 0) {
    return "No results found.";
  }

  return rows
    .map(
      (row, index) =>
        `${index + 1}. Date: ${row.date}\nTNX Date: ${row.tnx_date}\nAmount: ${
          row.amount
        }\nContent: ${row.content}\n`
    )
    .join("\n");
}

// Close the database connection when the process exits
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Closed the database connection.");
    process.exit(0);
  });
});

function initBot() {
  // Handle /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    // Show the "Get Started" buttons
    bot.sendMessage(
      chatId,
      "Welcome! Vui lòng chọn một trong các lựa chọn sau:",
      {
        reply_markup: {
          keyboard: [[{ text: "Liên hệ" }, { text: "Xem sao kê MTTQ" }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  });

  // Handle button press for "Show My Info"
  bot.on("message", (msg) => {
    const chatId = msg.chat.id;

    // If user presses "Show My Info"
    if (msg.text === "Liên hệ") {
      bot.sendMessage(
        chatId,
        "Mình là Đông, Mình là thợ code, mình nhận làm tool, web, app, bla bla bla @quynhdev"
      );
      // user can move to xem sao kê MTTQ
      bot.sendMessage(
        chatId,
        "Bạn có thể xem sao kê MTTQ bằng cách nhấn vào nút bên dưới.",
        {
          reply_markup: {
            keyboard: [[{ text: "Xem sao kê MTTQ" }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    }

    // If user presses "Search Content"
    else if (msg.text === "Xem sao kê MTTQ") {
      bot.sendMessage(
        chatId,
        "Bạn có thể nhập nội dung, transactionId, số tiền để tìm kiếm."
      );

      // Wait for the user's search input
      bot.once("message", (searchMsg) => {
        const searchQuery = searchMsg.text;

        // Search the database for matching results
        searchDatabase(searchQuery, (err, rows) => {
          if (err) {
            bot.sendMessage(
              chatId,
              "Có lỗi xảy ra khi tìm kiếm, vui lòng thử lại."
            );
          } else {
            const formattedResults = formatResults(rows);
            sendMessageInChunksWithMarkup(chatId, formattedResults, bot);
          }
        });
      });
    }
  });
}

function main() {
  // wait db ready
  db.serialize(async () => {
    initBot();
  });
}

main();

function sendMessageInChunksWithMarkup(chatId, message, bot) {
  const maxMessageLength = 4096; // Telegram's message limit
  const replyMarkup = {
    reply_markup: {
      keyboard: [[{ text: "Liên hệ" }, { text: "Xem sao kê MTTQ" }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };

  if (message.length <= maxMessageLength) {
    bot.sendMessage(chatId, message, replyMarkup);
  } else {
    // Split message into smaller chunks
    let chunks = [];
    for (let i = 0; i < message.length; i += maxMessageLength) {
      chunks.push(message.substring(i, i + maxMessageLength));
    }

    // Send each chunk sequentially
    chunks.forEach((chunk, index) => {
      if (index === chunks.length - 1) {
        // For the last message, send with reply markup
        bot.sendMessage(chatId, chunk, replyMarkup);
      } else {
        bot.sendMessage(chatId, chunk);
      }
    });
  }
}
