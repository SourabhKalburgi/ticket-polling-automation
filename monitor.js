
require("dotenv").config();
const puppeteer = require("puppeteer");

// ─── Configuration ───────────────────────────────────────────
const CONFIG = {
  url: process.env.TARGET_URL,
  keywords: ["book now", "book", "available","buy now","buy"],
  // Active window in IST (UTC+5:30): 9:00 AM to 11:00 PM
  activeWindow: { startHour: 8, endHour: 22 },
  telegram: {
    botToken: process.env.BOT_TOKEN,
    chatId: process.env.CHAT_ID,
  },
  retry: {
    attempts: 3,
    delayMs: 5000, // 5 seconds between retries
  },
};
// ─────────────────────────────────────────────────────────────

// ─── Time Window Check ────────────────────────────────────────
function isWithinActiveWindow() {
  const { startHour, endHour } = CONFIG.activeWindow;
  // Convert current UTC time to IST (UTC+5:30)
  const nowUTC = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5h30m in ms
  const nowIST = new Date(nowUTC.getTime() + istOffset);
  const hour = nowIST.getUTCHours(); // use UTC on the shifted date
  return hour >= startHour && hour < endHour;
}

// ─── Telegram ────────────────────────────────────────────────
async function sendTelegramMessage(message) {
  const { botToken, chatId } = CONFIG.telegram;
  if (!botToken || !chatId) {
    console.error(
      "[Telegram] BOT_TOKEN or CHAT_ID is missing. Check your secrets."
    );
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = JSON.stringify({ chat_id: chatId, text: message });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  console.log("[Telegram] Notification sent successfully.");
}

// ─── Page Loader (with retry) ────────────────────────────────
async function loadPageContent(url) {
  const { attempts, delayMs } = CONFIG.retry;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let browser;
    try {
      console.log(
        `[Browser] Loading page (attempt ${attempt}/${attempts})...`
      );
      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // Block images/fonts/css to speed up loading
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (["image", "stylesheet", "font"].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const content = await page.evaluate(() => document.body.innerText);
      return content;
    } catch (err) {
      console.error(`[Browser] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < attempts) {
        console.log(`[Browser] Retrying in ${delayMs / 1000}s...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw new Error(`All ${attempts} page load attempts failed.`);
      }
    } finally {
      if (browser) await browser.close();
    }
  }
}

// ─── Keyword Check ───────────────────────────────────────────
function containsKeyword(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.find((kw) => lower.includes(kw.toLowerCase())) || null;
}

// ─── Main Check ──────────────────────────────────────────────
async function checkAvailability() {
  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  console.log(`\n[${timestamp} IST] Checking: ${CONFIG.url}`);

  if (!isWithinActiveWindow()) {
    console.log(
      `[Monitor] Outside active window (${CONFIG.activeWindow.startHour}:00–${CONFIG.activeWindow.endHour}:00 IST). Skipping.`
    );
    return;
  }

  let content;
  try {
    content = await loadPageContent(CONFIG.url);
  } catch (err) {
    console.error(`[Monitor] Page load failed: ${err.message}`);
    process.exit(1); // Non-zero exit so GitHub Actions flags the failed run
  }

  const matchedKeyword = containsKeyword(content, CONFIG.keywords);

  if (matchedKeyword) {
    console.log(`[Monitor] ✅ Available! Keyword matched: "${matchedKeyword}"`);

    const message =
      `🎟️ Tickets may be available!\n\n` +
      `Keyword detected: "${matchedKeyword}"\n` +
      `URL: ${CONFIG.url}\n` +
      `Time: ${timestamp} IST`;

    try {
      await sendTelegramMessage(message);
    } catch (err) {
      console.error(`[Telegram] Failed to send message: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log("[Monitor] ❌ Not available yet.");
  }
}

// ─── Entry Point ─────────────────────────────────────────────
(async () => {
  console.log("Ticket Monitor — one-shot run");
  console.log(`   URL      : ${CONFIG.url}`);
  console.log(`   Keywords : ${CONFIG.keywords.join(", ")}`);
  console.log(
    `   Window   : ${CONFIG.activeWindow.startHour}:00–${CONFIG.activeWindow.endHour}:00 IST\n`
  );
  await checkAvailability();
})();