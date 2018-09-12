import yargs from 'yargs'
import { Router }  from '../../index'

let { address, router, id } = yargs.argv

async function run () {
  try {
    let routerInstance = new Router({ id, bind: address })
    await routerInstance.start()
    if (router !== 'undefined') await routerInstance.connectToExistingNetwork(router)

    process.send({ err: false })

    process.on('SIGINT', async () => {
      console.log('Stopping cron job')
      await router.stop()
      process.stdout.pause()
      process.stdin.pause()
      process.disconnect()
      process.exit()
    })
  } catch (err) {
    console.log(err)
    process.send({err: true, message: err.message + ' ' + process.cwd() + ' ' + address})
    process.exit(1)
  }
}

run()