#!/usr/bin/env -S node --import tsx

import {execute} from '@oclif/core'
import {rm} from 'node:fs/promises'

// oclif prefers a production manifest when it exists. It is generated only
// for packaging, so remove that disposable artifact before source discovery.
await rm(new URL('../oclif.manifest.json', import.meta.url), {force: true})
await execute({development: true, dir: import.meta.url})
