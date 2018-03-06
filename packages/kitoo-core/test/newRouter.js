import { assert } from 'chai'

import { Router, Network, Events } from '../src'


describe('new Router', () => {
  let router1, router2, service

  beforeEach(async () => {
    try {
      router1 = new Router({bind: 'tcp://127.0.0.1:8000'})
      service = new Network({name: 'foo', routers: [router1.getAddress()]})
      await router1.start()
      await service.start()
    } catch (err) {
      console.error(err)
    }
  })

  afterEach(async () => {
    try {
      await service.stop()
      await router1.stop()
      await router2.stop()
    } catch (err) {
      console.error(err)
    }
  })

  it ('new router', (done) => {
    service.on(Events.NEW_ROUTER, (routerInfo) => {
      done()
    })

    router2 = new Router({ bind: 'tcp://127.0.0.1:9000' })
    router2.start()
      .then(() => {
        return router2.connectToExistingNetwork(router1.getAddress())
      })
      .catch((err) => {
        console.error(err)
      })
  })
})