import { assert } from 'chai'
import { spawn } from 'child_process'

import { Router, Network, Events } from '../src'

describe('Router Events', () => {
  let router = null
    , network = null

  beforeEach(async () => {
    try {
      router = new Router({ bind: 'tcp://127.0.0.1:3000' })
      network = new Network({ name: 'foo', router: router.getAddress(), config: { RECONNECTION_TIMEOUT: 1000 } })

      await router.start()
    } catch (err) {
      console.error(err)
    }
  })

  afterEach(async () => {
    try {
      await network.stop()
      router = null
      network = null
    } catch (err) {
      console.error(err)
    }
  })


  // it('New Router', (done) => {
  //   network.on(Events.CONNECT_TO_ROUTER, (routerInfo) => {
  //     console.log(routerInfo)
  //     done()
  //   })
  //   network.start()
  // })

  it('Router Fail', (done) => {
    network.on(Events.ROUTER_FAIL, (routerInfo) => {
      assert.equal(routerInfo.online, false)
      assert.isNotFalse(routerInfo.fail)
      done()
    })
    router.stop()
      .then(() => {
        let routerProc = spawn('babel-node', [`${__dirname}/helpers/router.js`], { detached: true })
        routerProc.stdout.on('data', (msg) => {
          let childPid = +msg.toString('utf8')
          network.start()
            .then(() => {
              process.kill(childPid, 'SIGHUP')
            })
            .catch((err) => {
              console.error(err)
            })
        })
      })
  })

  it('Router Stop', (done) => {
    network.on(Events.ROUTER_STOP, (routerInfo) => {
      assert.equal(routerInfo.id, router.getId())
      assert.equal(routerInfo.online, false)
      done()
    })
    network.start()
      .then(() => {
        router.stop()
      })
  })

  it('Router Reconnect Fail', (done) => {
    network.on(Events.ROUTER_RECONNECT_FAILURE, (routerInfo) => {
      assert.isFalse(routerInfo.online)
      done()
    })

    router.stop()
      .then(() => {
        let routerProc = spawn('babel-node', [`${__dirname}/helpers/router.js`], { detached: true })
        routerProc.stdout.on('data', (msg) => {
          let childPid = +msg.toString('utf8')
          network.start()
            .then(() => {
              process.kill(childPid, 'SIGHUP')
            })
            .catch((err) => {
              console.error(err)
            })
        })
      })
  })

  it('Router Reconnect', (done) => {
    network.on(Events.ROUTER_FAIL, () => {
      router = new Router({ bind: 'tcp://127.0.0.1:3000' })
      router.start()
    })

    network.on(Events.ROUTER_RECONNECT, () => {

      console.log('aaaaa')
      router.stop()
        .then(() => {
          done()
        })
        .catch((err) => {
          console.error(err)
        })
    })

    router.stop()
      .then(() => {
        let routerProc = spawn('babel-node', [`${__dirname}/helpers/router.js`], { detached: true })
        routerProc.stdout.on('data', (msg) => {
          let childPid = +msg.toString('utf8')
          network.start()
            .then(() => {
              process.kill(childPid, 'SIGHUP')
            })
            .catch((err) => {
              console.error(err)
            })
        })
      })
  })

})