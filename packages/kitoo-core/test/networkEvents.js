import { assert } from 'chai'
import { spawn } from 'child_process'

import { Router, Network, Events } from '../src'


describe('Network service Events', () => {
  let router = null
    , network = null

  beforeEach(async () => {
    try {
      router = new Router({ bind: 'tcp://127.0.0.1:3000' })
      network = new Network({ name: 'foo', router: router.getAddress() })

      await router.start()
    } catch (err) {
      console.error(err)
    }
  })

  afterEach(async () => {
    await router.stop()
    router = null
    network = null
  })

  it('Service Welcome', (done) => {
    router.on(Events.SERVICE_WELCOME, (networkInfo) => {
      assert.equal(networkInfo.id, network.getId())
      assert.equal(networkInfo.options.service, network.getName())
      network.stop()
        .then(() => {
          done()
        })
        .catch((err) => {
          console.error(err)
        })
    })

    network.start()
  })

  it('Service Fail', (done) => {
    router.on(Events.SERVICE_FAIL, (networkInfo) => {
      assert.equal(networkInfo.online, false)
      assert.isNotFalse(networkInfo.fail)
      done()
    })

    let networkProc = spawn('babel-node', [`${__dirname}/helpers/network.js`], { detached: true })

    networkProc.stdout.on('data', (msg) => {
      let childPid = +msg.toString('utf8')
      process.kill(childPid, 'SIGHUP')
    })
  }).timeout(25000)

  it('Service Stop', (done) => {
    router.on(Events.SERVICE_STOP, (networkInfo) => {
      assert.equal(networkInfo.id, network.getId())
      assert.equal(networkInfo.options.service, network.getName())
      assert.equal(networkInfo.online, false)
      done()
    })

    network.start()
      .then(() => {
        network.stop()
      })
  })
})