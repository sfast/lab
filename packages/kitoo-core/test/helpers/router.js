/**
 * Created by root on 12/5/17.
 */
// require('babel-register')
import {Router} from '../../src'


(async function() {
  try {
    process.on('SIGHUP', () => {
      process.exit()
    })
    let router = new Router({bind: 'tcp://127.0.0.1:3000'})
    await router.start()
    console.log(process.pid)
  } catch (err) {
    console.error(err)
  }
}())