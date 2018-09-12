import { fork } from 'child_process'
import path from 'path'

export default function (vorpal) {

  let _start = (args, done) => {
    try {
      vorpal.localStorage('kitoo-core')

      let { address, router, id } = args.options

      let routerFork = fork(path.join(__dirname, '..', 'fork', 'router.js'), [ '--address', address, '--router', router, '--id', id ], {
        stdio: 'ignore',
        cwd: process.cwd()
      })

      routerFork.on('message', (msg) => {
        try {
          routerFork.unref()

          if (msg.err) {
            console.log(msg.message)
            process.exit(1)
          }
          console.log(`Started with pid: ${routerFork.pid}`)
          let pids = vorpal.localStorage.getItem('pids')
          pids = pids ? JSON.parse(pids) : []
          pids.push(routerFork.pid)
          vorpal.localStorage.setItem('pids', JSON.stringify(pids))
          done()
        } catch (err) {
          console.log(err.message)
          process.exit(1)
        }

      })
    } catch (err) {
      console.log(err)
      process.exit(1)
    }
  }

  vorpal
    .command('run', 'Run router.')
    .option('-a, --address <address>', 'address to bind router')
    .option('-r, --router <router>', 'router address from network interface to connect.')
    .option('-i, --id <id>', 'router id')
    .action(_start)
}