// ---------- Action param shapes ----------

export interface GotoParams {
  url: string;
}

export interface SelectorParams {
  selector: string;
}

export interface FillParams {
  selector: string;
  value: string;
}

export interface PressParams {
  selector: string;
  key: string;
}

export interface ExtractParams {
  selector: string;
  attr: "innerText" | "innerHTML" | "value" | string;
}

export interface ScreenshotParams {
  path?: string;
  fullPage?: boolean;
}

export interface PdfParams {
  path?: string;
}

export interface SleepParams {
  ms: number;
}

export interface WaitForSelectorParams {
  selector: string;
  timeout?: number;
}

// ---------- Action definitions ----------

export type ActionType =
  | "goto"
  | "reload"
  | "back"
  | "click"
  | "fill"
  | "hover"
  | "press"
  | "check"
  | "wait_for_selector"
  | "sleep"
  | "extract"
  | "screenshot"
  | "pdf"
  | "exists";

export interface BaseAction {
  id?: string;
  type: ActionType;
}

export interface GotoAction extends BaseAction {
  type: "goto";
  params: GotoParams;
}

export interface ReloadAction extends BaseAction {
  type: "reload";
  params?: Record<string, never>;
}

export interface BackAction extends BaseAction {
  type: "back";
  params?: Record<string, never>;
}

export interface ClickAction extends BaseAction {
  type: "click";
  params: SelectorParams;
}

export interface FillAction extends BaseAction {
  type: "fill";
  params: FillParams;
}

export interface HoverAction extends BaseAction {
  type: "hover";
  params: SelectorParams;
}

export interface PressAction extends BaseAction {
  type: "press";
  params: PressParams;
}

export interface CheckAction extends BaseAction {
  type: "check";
  params: SelectorParams;
}

export interface WaitForSelectorAction extends BaseAction {
  type: "wait_for_selector";
  params: WaitForSelectorParams;
}

export interface SleepAction extends BaseAction {
  type: "sleep";
  params: SleepParams;
}

export interface ExtractAction extends BaseAction {
  type: "extract";
  params: ExtractParams;
}

export interface ScreenshotAction extends BaseAction {
  type: "screenshot";
  params?: ScreenshotParams;
}

export interface PdfAction extends BaseAction {
  type: "pdf";
  params?: PdfParams;
}

export interface ExistsAction extends BaseAction {
  type: "exists";
  params: SelectorParams;
  on_true?: Action[];
  on_false?: Action[];
}

export type Action =
  | GotoAction
  | ReloadAction
  | BackAction
  | ClickAction
  | FillAction
  | HoverAction
  | PressAction
  | CheckAction
  | WaitForSelectorAction
  | SleepAction
  | ExtractAction
  | ScreenshotAction
  | PdfAction
  | ExistsAction;

// ---------- Job payload ----------

export interface JobOptions {
  timeout?: number;
  viewport?: { width: number; height: number };
}

export interface JobPayload {
  job_id: string;
  options?: JobOptions;
  actions: Action[];
  /** Internal: retry count, attached by the consumer */
  _retries?: number;
}

// ---------- Result types ----------

export interface StepResult {
  id?: string;
  type: ActionType;
  success: boolean;
  value?: unknown;
  error?: string;
}

export interface JobResult {
  job_id: string;
  success: boolean;
  steps: StepResult[];
  error?: string;
  duration_ms: number;
}
