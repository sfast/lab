export default function (vorpal) {
  let _stop = (args, done) => {
    try {
      vorpal.localStorage('kitoo-core')

      let pid = args.pid

      let pids = vorpal.localStorage.getItem('pids')
      if (!pids) return done()
      pids = JSON.parse(pids)
      let pidIndex = pids.indexOf(pid)
      if (pidIndex === -1) return done()
      pids.splice(pidIndex, 1)
      vorpal.localStorage.setItem('pids', JSON.stringify(pids))
      process.kill(pid)
      done()
    } catch (err) {
      console.log(err.message)
      process.exit(1)
    }
  }

  vorpal
    .command('stop <pid>', 'Stop router with pid.')
    .action(_stop)
}