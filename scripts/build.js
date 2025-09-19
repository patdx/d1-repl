#! /usr/bin/env bun

import { $ } from 'bun'
import { readFileSync, writeFileSync } from 'node:fs'

const denoConfig = JSON.parse(readFileSync('deno.json', 'utf8'))
const npmPackage = JSON.parse(readFileSync('npm/package.json', 'utf8'))

npmPackage.version = denoConfig.version
writeFileSync('npm/package.json', JSON.stringify(npmPackage, null, 2) + '\n')

await $`deno bundle mod.ts > npm/mod.js`
await $`cp README.md npm/README.md`
await $`deno fmt`
