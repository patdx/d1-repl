#! /usr/bin/env node

// mod.ts
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import * as readline from 'node:readline'
import process from 'node:process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
var { values, positionals } = parseArgs({
  options: {
    local: {
      type: 'boolean',
      short: 'l',
    },
    remote: {
      type: 'boolean',
      short: 'r',
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  allowPositionals: true,
})
if (values.help) {
  console.log(`
Usage: sqlite-repl.ts [database-name] [options]

Options:
  -l, --local     Use local database
  -r, --remote    Use remote database
  -h, --help      Show this help message

Examples:
  sqlite-repl.ts my-database --local
  sqlite-repl.ts my-database --remote
  sqlite-repl.ts --help
`)
  process.exit(0)
}
var databaseName = positionals[0]
if (!databaseName) {
  console.error('Database name is required')
  process.exit(1)
}
if (values.local && values.remote) {
  console.error('Cannot use both local and remote flags')
  process.exit(1)
}
var flags = []
if (values.local) flags.push('--local')
if (values.remote) flags.push('--remote')
function findPackageManager() {
  let currentDir = process.cwd()
  while (dirname(currentDir) !== currentDir) {
    if (existsSync(join(currentDir, 'pnpm-lock.yaml'))) {
      return 'pnpm'
    }
    if (existsSync(join(currentDir, 'yarn.lock'))) {
      return 'yarn'
    }
    if (existsSync(join(currentDir, 'bun.lock'))) {
      return 'bun'
    }
    if (existsSync(join(currentDir, 'package-lock.json'))) {
      return 'npm'
    }
    if (existsSync(join(currentDir, 'deno.lock'))) {
      return 'deno'
    }
    currentDir = dirname(currentDir)
  }
  return 'npx'
}
var SQLiteREPL = class {
  rl
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'sqlite> ',
    })
    this.setupEventHandlers()
  }
  setupEventHandlers() {
    this.rl.on('line', async (input) => {
      const trimmed = input.trim()
      if (trimmed === '') {
        this.rl.prompt()
        return
      }
      if (
        trimmed.toLowerCase() === '.exit' || trimmed.toLowerCase() === '.quit'
      ) {
        this.exit()
        return
      }
      if (trimmed.toLowerCase() === '.help') {
        this.showHelp()
        this.rl.prompt()
        return
      }
      if (trimmed.toLowerCase() === '.tables') {
        this.showTables()
        this.rl.prompt()
        return
      }
      if (trimmed.toLowerCase().startsWith('.schema')) {
        const tableName = trimmed.split(' ')[1]
        this.showSchema(tableName)
        this.rl.prompt()
        return
      }
      this.executeSQL(trimmed)
      this.rl.prompt()
    })
    this.rl.on('close', () => {
      this.exit()
    })
    process.on('SIGINT', () => {
      console.log('\nUse .exit or .quit to close the REPL')
      this.rl.prompt()
    })
  }
  executeSQL(sql) {
    console.log(`
Executing: ${sql}`)
    try {
      const args = []
      const isInPackageManager = process.env.npm_config_user_agent
      if (isInPackageManager) {
        args.push('wrangler')
      } else {
        const packageManager = findPackageManager()
        if (packageManager === 'deno') {
          args.push('deno', 'run', '-A', 'npm:wrangler')
        } else if (packageManager === 'pnpm') {
          args.push('pnpm', 'wrangler')
        } else if (packageManager === 'yarn') {
          args.push('yarn', 'wrangler')
        } else if (packageManager === 'bun') {
          args.push('bun', 'wrangler')
        } else {
          args.push('npx', 'wrangler')
        }
      }
      args.push(
        'd1',
        'execute',
        databaseName,
        ...flags,
        '--json',
        '--command',
        sql,
      )
      const command = args.shift()
      if (process.env.DEBUG) {
        console.log(`Using command: ${command} ${args.join(' ')}`)
      }
      const result = spawnSync(command, args, {
        encoding: 'utf8',
        stdio: [
          'inherit',
          'pipe',
          'inherit',
        ],
      })
      if (result.error) {
        throw result.error
      }
      if (result.status !== 0) {
        throw new Error(
          `Command failed with status ${result.status}: ${result.stdout}`,
        )
      }
      const parsed = JSON.parse(result.stdout)
      for (const item of parsed) {
        if (item.success) {
          console.log('Success')
          if (item.results && item.results.length > 0) {
            this.displayResults(item.results)
          } else {
            console.log('No results returned')
          }
          if (item.meta && Object.keys(item.meta).length > 0) {
            console.log('Meta:', item.meta)
          }
        } else {
          console.error('Query failed')
          console.error('Meta:', item.meta)
        }
      }
    } catch (error) {
      console.error('Execution failed:', error)
    }
  }
  displayResults(results) {
    if (results.length === 0) {
      console.log('No results')
      return
    }
    console.log(JSON.stringify(results, null, 2))
  }
  showTables() {
    const sql =
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    this.executeSQL(sql)
  }
  showSchema(tableName) {
    let sql
    if (tableName) {
      sql =
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}';`
    } else {
      sql =
        `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
    }
    this.executeSQL(sql)
  }
  showHelp() {
    console.log(`
SQLite REPL Commands:
  .help     - Show this help message
  .exit     - Exit the REPL
  .quit     - Exit the REPL
  .tables   - List all tables
  .schema   - Show all table schemas
  .schema table_name - Show schema for specific table

SQL Commands:
  SELECT * FROM table_name;
  INSERT INTO table_name (col1, col2) VALUES ('val1', 'val2');
  UPDATE table_name SET col1 = 'new_val' WHERE condition;
  DELETE FROM table_name WHERE condition;
  CREATE TABLE table_name (col1 TEXT, col2 INTEGER);
  DROP TABLE table_name;

Examples:
  SELECT * FROM locations LIMIT 5;
  SELECT COUNT(*) FROM locations;
  .tables
  .schema
  .schema locations
    `)
  }
  exit() {
    console.log('\nGoodbye!')
    this.rl.close()
    process.exit(0)
  }
  start() {
    console.log(`
SQLite REPL for ${databaseName}
Connected to D1 database via Wrangler

Type .help for available commands
Type .exit or .quit to close
    `)
    this.rl.prompt()
  }
}
var repl = new SQLiteREPL()
repl.start()
