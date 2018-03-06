/**
 * Created by root on 12/5/17.
 */
import {Network} from '../../src'


(async function() {
  try {
    process.on('SIGHUP', () => {
      process.exit()
    })
    let network = new Network({ name: 'foo', routers: ['tcp://127.0.0.1:3000']})
    await network.start()
    console.log(process.pid)
  } catch (err) {
    console.error(err)
  }
}())