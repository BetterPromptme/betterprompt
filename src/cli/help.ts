import chalk from "chalk";
import type { Command, Help } from "commander";

const INDENT = "  ";
const ITEM_SEP_WIDTH = 2;

/**
 * Builds a single formatted item line.
 * Padding is applied to the plain term first so ANSI codes don't skew alignment,
 * then chalk is applied to the padded term.
 */
function formatItem(term: string, description: string, padWidth: number): string {
  const paddedTerm = term.padEnd(padWidth + ITEM_SEP_WIDTH);
  const coloredTerm = chalk.cyan(paddedTerm);
  return description ? `${coloredTerm}${chalk.white(description)}` : coloredTerm.trimEnd();
}

function formatList(items: string[]): string {
  return items
    .map((item) => `${INDENT}${item}`)
    .join("\n");
}

/**
 * Custom Commander help formatter using chalk with cyan as the primary color.
 * Pass this to program.configureHelp({ formatHelp }).
 */
export const formatHelp = (cmd: Command, helper: Help): string => {
  const padWidth = helper.padWidth(cmd, helper);
  const output: string[] = [];

  // Usage
  output.push(
    `${chalk.bold.cyan("Usage:")} ${chalk.white(helper.commandUsage(cmd))}`,
    ""
  );

  // Description
  const desc = helper.commandDescription(cmd);
  if (desc) {
    output.push(chalk.dim(desc), "");
  }

  // Arguments
  const argItems = helper.visibleArguments(cmd).map((arg) =>
    formatItem(helper.argumentTerm(arg), helper.argumentDescription(arg), padWidth)
  );
  if (argItems.length > 0) {
    output.push(chalk.bold.cyan("Arguments:"), formatList(argItems), "");
  }

  // Options
  const optionItems = helper.visibleOptions(cmd).map((opt) =>
    formatItem(helper.optionTerm(opt), helper.optionDescription(opt), padWidth)
  );
  if (optionItems.length > 0) {
    output.push(chalk.bold.cyan("Options:"), formatList(optionItems), "");
  }

  // Global options (when showGlobalOptions is enabled)
  const showGlobal = (helper as unknown as { showGlobalOptions?: boolean }).showGlobalOptions;
  if (showGlobal) {
    const globalItems = helper.visibleGlobalOptions(cmd).map((opt) =>
      formatItem(helper.optionTerm(opt), helper.optionDescription(opt), padWidth)
    );
    if (globalItems.length > 0) {
      output.push(chalk.bold.cyan("Global Options:"), formatList(globalItems), "");
    }
  }

  // Commands
  const commandItems = helper.visibleCommands(cmd).map((sub) =>
    formatItem(helper.subcommandTerm(sub), helper.subcommandDescription(sub), padWidth)
  );
  if (commandItems.length > 0) {
    output.push(chalk.bold.cyan("Commands:"), formatList(commandItems), "");
  }

  return output.join("\n");
};
