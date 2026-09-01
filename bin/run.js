#!/usr/bin/env node

import {runCli} from '../dist/runtime/run-cli.js'

await runCli({dir: import.meta.url})
