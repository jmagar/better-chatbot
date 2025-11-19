/**
 * Modular MCP protocol handlers
 * Each handler is focused on a single capability (tools, resources, or prompts)
 */

export {
  convertToMCPTool,
  createToolsListHandler,
  createToolsCallHandler,
} from "./tools-handler";

export {
  createResourcesListHandler,
  createResourcesReadHandler,
  createResourceTemplatesListHandler,
} from "./resources-handler";

export {
  createPromptsListHandler,
  createPromptsGetHandler,
} from "./prompts-handler";

export { createSamplingCreateMessageHandler } from "./sampling-handler";

export { createElicitationCreateHandler } from "./elicitation-handler";
