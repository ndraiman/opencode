import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { StartCommand } from "./cli/cmd/start.js"
import { Log } from "./util/log.js"
import { UI } from "./cli/ui.js"
import { Installation } from "./installation/index.js"
import { NamedError, FormatError } from "./util/error.js"

const cancel = new AbortController()

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

// Handle no arguments case - show help and exit gracefully
const args = hideBin(process.argv)
if (args.length === 0) {
  // Simulate --help flag to get proper stdout output
  args.push("--help")
}

const cli = yargs(args)
  .scriptName("opencode-orchestrator")
  .help("help", "show help")
  .version("version", "show version number", Installation.VERSION)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .middleware(async () => {
    await Log.init({ print: process.argv.includes("--print-logs") })
    Log.Default.info("opencode-orchestrator", {
      version: Installation.VERSION,
      args: process.argv.slice(2),
    })
  })
  .usage("\n" + UI.logo())
  .command(StartCommand)
  .fail((msg) => {
    if (
      msg.startsWith("Unknown argument") ||
      msg.startsWith("Not enough non-option arguments")
    ) {
      cli.showHelp("log")
    }
  })
  .strict()
  .showHelpOnFail(true)
  .demandCommand(1, "You must specify a command")

try {
  await cli.parse()
} catch (e) {
  let data: Record<string, any> = {}
  if (e instanceof NamedError) {
    const obj = e.toObject()
    Object.assign(data, {
      ...obj.data,
    })
  }

  if (e instanceof Error) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      cause: e.cause?.toString(),
    })
  }

  Log.Default.error("fatal", data)
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) UI.error("Unexpected error occurred")
  process.exitCode = 1
}

cancel.abort()
