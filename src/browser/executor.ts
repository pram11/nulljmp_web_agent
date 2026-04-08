import { Page } from "playwright";
import type {
  Action,
  StepResult,
  GotoAction,
  FillAction,
  PressAction,
  ExtractAction,
  ScreenshotAction,
  PdfAction,
  SleepAction,
  WaitForSelectorAction,
  ExistsAction,
} from "../types";
import { isAllowedUrl } from "./ssrf";

/**
 * Executes a single Action on the given Page.
 * Returns a StepResult — never throws; errors are captured in the result.
 */
export async function executeAction(
  page: Page,
  action: Action,
  defaultTimeout: number
): Promise<StepResult> {
  const base: Pick<StepResult, "id" | "type"> = {
    id: action.id,
    type: action.type,
  };

  try {
    const value = await dispatch(page, action, defaultTimeout);
    return { ...base, success: true, value };
  } catch (err) {
    return { ...base, success: false, error: (err as Error).message };
  }
}

async function dispatch(
  page: Page,
  action: Action,
  defaultTimeout: number
): Promise<unknown> {
  switch (action.type) {
    // ── Navigation ──────────────────────────────────────────────────────────

    case "goto": {
      const { url } = (action as GotoAction).params;
      if (!isAllowedUrl(url)) {
        throw new Error(`SSRF blocked: "${url}" is not in the allowed domain list`);
      }
      await page.goto(url, { timeout: defaultTimeout, waitUntil: "domcontentloaded" });
      return url;
    }

    case "reload":
      await page.reload({ timeout: defaultTimeout, waitUntil: "domcontentloaded" });
      return null;

    case "back":
      await page.goBack({ timeout: defaultTimeout, waitUntil: "domcontentloaded" });
      return null;

    // ── Interaction ──────────────────────────────────────────────────────────

    case "click":
      await page.click(action.params.selector, { timeout: defaultTimeout });
      return null;

    case "fill": {
      const { selector, value } = (action as FillAction).params;
      await page.fill(selector, value, { timeout: defaultTimeout });
      return null;
    }

    case "hover":
      await page.hover(action.params.selector, { timeout: defaultTimeout });
      return null;

    case "press": {
      const { selector, key } = (action as PressAction).params;
      await page.press(selector, key, { timeout: defaultTimeout });
      return null;
    }

    case "check":
      await page.check(action.params.selector, { timeout: defaultTimeout });
      return null;

    // ── Wait ─────────────────────────────────────────────────────────────────

    case "wait_for_selector": {
      const { selector, timeout } = (action as WaitForSelectorAction).params;
      await page.waitForSelector(selector, { timeout: timeout ?? defaultTimeout });
      return null;
    }

    case "sleep": {
      const { ms } = (action as SleepAction).params;
      await page.waitForTimeout(ms);
      return null;
    }

    // ── Scraping / Output ────────────────────────────────────────────────────

    case "extract": {
      const { selector, attr } = (action as ExtractAction).params;
      const locator = page.locator(selector).first();
      if (attr === "innerText") return locator.innerText({ timeout: defaultTimeout });
      if (attr === "innerHTML") return locator.innerHTML({ timeout: defaultTimeout });
      if (attr === "value") return locator.inputValue({ timeout: defaultTimeout });
      return locator.getAttribute(attr, { timeout: defaultTimeout });
    }

    case "screenshot": {
      const params = (action as ScreenshotAction).params ?? {};
      const buffer = await page.screenshot({
        path: params.path,
        fullPage: params.fullPage ?? false,
      });
      // Return base64 so it can travel through the result JSON when no path is set
      return params.path ? params.path : buffer.toString("base64");
    }

    case "pdf": {
      const params = (action as PdfAction).params ?? {};
      const buffer = await page.pdf({ path: params.path });
      return params.path ? params.path : buffer.toString("base64");
    }

    // ── Flow Control ─────────────────────────────────────────────────────────

    case "exists": {
      const { selector } = (action as ExistsAction).params;
      const found = (await page.locator(selector).count()) > 0;
      const branch = found
        ? (action as ExistsAction).on_true
        : (action as ExistsAction).on_false;

      if (branch && branch.length > 0) {
        const results: StepResult[] = [];
        for (const subAction of branch) {
          const result = await executeAction(page, subAction, defaultTimeout);
          results.push(result);
          if (!result.success) break; // abort branch on first failure
        }
        return { found, branch_results: results };
      }

      return { found };
    }

    default: {
      // Exhaustiveness guard — TypeScript will catch unknown types at compile time
      const _exhaustive: never = action;
      throw new Error(`Unknown action type: ${(_exhaustive as Action).type}`);
    }
  }
}
