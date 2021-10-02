import chalk from 'chalk'
import commander, { Command } from 'commander'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import Log from './log'
import { errorHandler, getConfig } from './utils'
import { commands } from './cmds'
import { ENGINE_DIR } from './constants'
import { shaCheck } from './middleware/sha-check'
import { updateCheck } from './middleware/update-check'

import { version as melon } from '../package.json'

// The logger must be initialized before the config generator, otherwise reference
// errors occur
export const log = new Log()

export const config = getConfig()

const program = new Command()

program.storeOptionsAsProperties(false).passCommandToAction(false)

let reportedFFVersion

if (existsSync(resolve(ENGINE_DIR, 'browser', 'config', 'version.txt'))) {
  const version = readFileSync(
    resolve(ENGINE_DIR, 'browser', 'config', 'version.txt'),
    'utf-8'
  ).replace(/\n/g, '')

  if (version !== config.version.version) reportedFFVersion = version
}

export const bin_name = 'melon'

program.version(`
\t${chalk.bold(config.name)}     ${config.version.displayVersion}
\t${chalk.bold('Firefox')}         ${config.version.version} ${
  reportedFFVersion ? `(being reported as ${reportedFFVersion})` : ``
}
\t${chalk.bold('Melon')}           ${melon}

${
  reportedFFVersion
    ? `Mismatch detected between expected Firefox version and the actual version.
You may have downloaded the source code using a different version and
then switched to another branch.`
    : ``
}
`)
program.name(bin_name)

commands.forEach((command) => {
  if (command.flags) {
    if (
      command.flags.platforms &&
      !command.flags.platforms.includes(process.platform)
    ) {
      return
    }
  }

  const _cmd = commander.command(command.cmd)

  _cmd.description(command.description)

  command?.aliases?.forEach((alias) => {
    _cmd.alias(alias)
  })

  command?.options?.forEach((opt) => {
    _cmd.option(opt.arg, opt.description)
  })

  _cmd.action(async (...args: unknown[]) => {
    await shaCheck(command.cmd)
    await updateCheck()

    command.controller(...args)
  })

  program.addCommand(_cmd)
})

process.on('uncaughtException', errorHandler)
process.on('unhandledException', (err) => errorHandler(err, true))

program.parse(process.argv)
