import chalk from "chalk";
import { Command } from "commander";
import { z } from "zod";

const schema = z.object({
  message: z.string().min(1),
  repeat: z.number().int().min(1).max(10),
});

export const demoCommand = new Command("demo")
  .description("Run a demo command for CLI testing")
  .argument("[message]", "message to print", "hello from betterprompt demo")
  .option("-r, --repeat <count>", "number of times to print (1-10)", "1")
  .addHelpText(
    "after",
    `
Examples:
  $ betterprompt demo
  $ betterprompt demo "smoke test"
  $ betterprompt demo "smoke test" --repeat 3
`,
  )
  .action((message: string, options: { repeat: string }) => {
    const parsed = schema.parse({
      message,
      repeat: Number.parseInt(options.repeat, 10),
    });

    for (let i = 0; i < parsed.repeat; i += 1) {
      console.log(
        chalk.green(`Demo run ${i + 1}/${parsed.repeat}:`) + ` ${chalk.blue(parsed.message)}`,
      );
    }
  });
