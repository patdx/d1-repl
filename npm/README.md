# d1-repl

[![NPM Version](https://img.shields.io/npm/v/d1-repl)](https://www.npmjs.com/package/d1-repl)
[![JSR Version](https://img.shields.io/jsr/v/@patdx/d1-repl)](https://jsr.io/@patdx/d1-repl)

A D1 REPL tool.

Access your Cloudflare D1 in a simple REPL similar to the real Sqlite CLI.

It calls the `wrangler` CLI to execute commands.

## Use without installing

```
npx d1-repl
deno run -A jsr:@patdx/d1-repl
```

## Installation

```bash
npm install -D d1-repl wrangler
deno add jsr:@patdx/d1-repl
```

## Usage

```bash
d1-repl [options]
```

## License

MIT
