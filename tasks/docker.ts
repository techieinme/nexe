import { NexeTarget } from '../src/target'
import { writeFileAsync, readFileAsync } from '../src/util'
import { spawn } from 'child_process'
import got = require('got')
import { createWriteStream } from 'fs'

function alpine (target: NexeTarget, nexeVersion: string) {
  const version = target.version
  return `
FROM i386/alpine:3.6
RUN apk add --no-cache curl make gcc g++ python linux-headers binutils-gold gnupg libstdc++
ENV NEXE_TEMP=/nexe_temp
WORKDIR /
RUN curl -sSL https://nodejs.org/dist/v${version}/node-v${version}.tar.gz | tar -xz && \
  cd /node-v${version} && \
  ./configure --prefix=/usr --fully-static && \
  make -j$(getconf _NPROCESSORS_ONLN) && \
  make install && \
  paxctl -cm /usr/bin/node && \
  cd / && \
  mkdir /nexe_temp && mv node-v${version} nexe_temp/${version} && \
  npm i nexe@beta -g

RUN nexe --empty -c="--fully-static" -o /nexe-out`.trim()
}

export async function runAlpineBuild (target: NexeTarget, nexeVersion: string) {
  await writeFileAsync('Dockerfile', alpine(target, nexeVersion))
  const output = createWriteStream('docker-log.txt')
  const option = { stdio: 'inherit' }
  
  await new Promise((resolve, reject) => {
    const child = spawn('docker', ['build', '-t', 'nexe-alpine', '.'])
    child.stderr.pipe(output)
    child.stdout.pipe(output)
    async function done (e?: Error) {
      output.close()
      await got('https://transfer.sh/docker-log.txt', {
        body: await readFileAsync('docker-log.txt'),
        method: 'PUT'
      }).then(x => console.log(x.body))
      console.error(e)
      reject()
    }
    child.on('error', done)
    child.on('close', done)
  })  
  
  // await exec('docker', ['run', '--name', 'nexe', 'nexe-alpine'], option)
  // await exec('docker', ['cp', 'nexe:/nexe-out', 'out'], option)
  // await exec('docker', ['rm', 'nexe'], option)
}
