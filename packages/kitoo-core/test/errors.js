import { assert } from 'chai'

import { Router, Network, ErrorCodes, ServiceStatus, LoadBalancingStrategies, RouterEvents } from '../src'

describe('singleRouter', () => {
  let router, service

  beforeEach(() => {
    try {
      router = new Router({bind: 'tcp://127.0.0.1:8000'})
      service = new Network({name: 'foo', router: router.getAddress()})
    } catch (err) {
      console.error(err)
    }
  })

  it('stop already stopped router', (done) => {
    router.stop()
    assert.equal(router.getStatus(), ServiceStatus.INIT)
    done()
  })

  it('connect to existing network while offline', async () => {
    try {
      await router.connectToExistingNetwork()
    } catch (err) {
      assert.equal(err.message, 'Need to start router before connecting to network')
    }
  })

  it('connect router while offline', async () => {
    try {
      await service.connectRouter()
    } catch (err) {
      assert.equal(err.message, `NetworkService ${service.getId()} connect error. You first need to start network service then start connect to routers`)
    }
  })

  it ('disconnect from not connected router', async () => {
    let resp = await service.disconnectRouter('foo')
    assert.isNull(resp)
  })

  it ('add same router many times', async () => {
    let router1 = await service.addRouter(router.getAddress())
    let router2 = await service.addRouter(router.getAddress())

    assert.equal(router1._id, router2._id)
  })
})