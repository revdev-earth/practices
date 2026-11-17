#!/usr/bin/env node
// Local LiveKit server in Docker, for the video rooms in development. The keys are public on purpose, see livekit.dev.yaml.
import { spawn, spawnSync } from 'node:child_process'

const container = 'practices-livekit'
spawnSync('docker', ['rm', '-f', container], { stdio: 'ignore' })

const child = spawn(
  'docker',
  [
    'run',
    '--rm',
    '--name',
    container,
    '-p',
    '7880:7880',
    '-p',
    '7881:7881',
    '-p',
    '7882:7882/udp',
    '-v',
    `${process.cwd()}/livekit.dev.yaml:/livekit.yaml`,
    'livekit/livekit-server:latest',
    '--config',
    '/livekit.yaml',
    '--node-ip',
    '127.0.0.1',
  ],
  { stdio: 'inherit' }
)
child.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => spawnSync('docker', ['rm', '-f', container], { stdio: 'ignore' }))
