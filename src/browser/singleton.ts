import { chromium, Browser } from "playwright";

/**
 * One Chromium Browser instance per worker process.
 * Shared across all concurrent job contexts to save resources.
 */
class BrowserSingleton {
  private browser: Browser | null = null;

  async get(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) return this.browser;

    console.log("[Browser] Launching Chromium …");
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    this.browser.on("disconnected", () => {
      console.warn("[Browser] Browser disconnected");
      this.browser = null;
    });

    console.log("[Browser] Chromium ready");
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const browserSingleton = new BrowserSingleton();
