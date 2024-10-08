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
    WHERE content LIKE ? OR amount = ? LIMIT 10`;

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
    return "Không tìm thấy kết quả nào. ấn /start để thử lại hoặc nút Tìm kiếm sao kê bên dưới, dữ diệu này từ 1/09 - 10/09/2024";
  }

  return rows
    .map(
      (row, index) =>
        `${index + 1}. Ngày: ${row.date}\nTNX Date: ${row.tnx_date}\nSố tiền: ${
          row.amount
        }\nnội dung: ${row.content}\n`
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
  // bot.onText(/\/start/, (msg) => {
  //   const chatId = msg.chat.id;

  //   // Show the "Get Started" buttons
  //   bot.sendMessage(
  //     chatId,
  //     "Welcome! Vui lòng chọn một trong các lựa chọn sau:",
  //     {
  //       reply_markup: {
  //         keyboard: [[{ text: "Liên hệ" }, { text: "Tìm kiếm Sao Kê" }]],
  //         resize_keyboard: true,
  //         one_time_keyboard: true,
  //       },
  //     }
  //   );
  // });

  // Handle button press for "Show My Info"
  bot.on("message", (msg) => {
    const chatId = msg.chat.id;

    if (msg.text === "/start") {
      bot.sendMessage(
        chatId,
        "Welcome! Vui lòng chọn một trong các lựa chọn sau:",
        {
          reply_markup: {
            keyboard: [[{ text: "Liên hệ" }, { text: "Tìm kiếm Sao Kê" }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    }
    // If user presses "Show My Info"
    else if (msg.text === "Liên hệ") {
      bot.sendMessage(
        chatId,
        "Mình là Đông, Mình là thợ code, mình nhận làm tool, web, app, bla bla bla @quynhdev"
      );
      // user can move to Tìm kiếm Sao Kê
      bot.sendMessage(
        chatId,
        "Bạn có thể Tìm kiếm Sao Kê bằng cách nhấn vào nút bên dưới.",
        {
          reply_markup: {
            keyboard: [[{ text: "Tìm kiếm Sao Kê" }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    }

    // If user presses "Search Content"
    else if (msg.text === "Tìm kiếm Sao Kê") {
      bot.sendMessage(
        chatId,
        "Bạn có thể nhập nội dung, transactionId, số tiền để tìm kiếm."
      );

      // // Wait for the user's search input
      // bot.once("message", (searchMsg) => {
      //   const searchQuery = String(searchMsg.text).toLowerCase();

      //   // Search the database for matching results
      //   searchDatabase(searchQuery, (err, rows) => {
      //     if (err) {
      //       bot.sendMessage(
      //         chatId,
      //         "Có lỗi xảy ra khi tìm kiếm, vui lòng thử lại."
      //       );

      //       bot.sendMessage(
      //         chatId,
      //         "Bạn có thể Tìm kiếm Sao Kê bằng cách nhấn vào nút bên dưới để thử lại.",
      //         {
      //           reply_markup: {
      //             keyboard: [[{ text: "Tìm kiếm Sao Kê" }]],
      //             resize_keyboard: true,
      //             one_time_keyboard: true,
      //           },
      //         }
      //       );
      //     } else {
      //       const formattedResults = formatResults(rows);
      //       sendMessageInChunksWithMarkup(chatId, formattedResults, bot);
      //     }
      //   });
      // });
    } else {
      const searchQuery = String(msg.text).toLowerCase();

      // Search the database for matching results
      searchDatabase(searchQuery, (err, rows) => {
        if (err) {
          bot.sendMessage(
            chatId,
            "Có lỗi xảy ra khi tìm kiếm, vui lòng thử lại."
          );

          bot.sendMessage(
            chatId,
            "Bạn có thể Tìm kiếm Sao Kê bằng cách nhấn vào nút bên dưới để thử lại.",
            {
              reply_markup: {
                keyboard: [[{ text: "Tìm kiếm Sao Kê" }]],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            }
          );
        } else {
          const formattedResults = formatResults(rows);
          sendMessageInChunksWithMarkup(chatId, formattedResults, bot);
        }
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
      keyboard: [[{ text: "Liên hệ" }, { text: "Tìm kiếm Sao Kê" }]],
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
