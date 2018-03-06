/**
 * Created by root on 7/25/17.
 */
import { assert } from 'chai'

import { Router, Network } from '../src'
import { Events } from "../src/events";

describe('manyRouters', () => {
  let router1, router2, service1, service2

  beforeEach(async () => {
    try {
      router1 = new Router({bind: 'tcp://127.0.0.1:8001', options: { region: 'US' }})
      router2 = new Router({bind: 'tcp://127.0.0.1:8002', options: { region: 'EU' }})
      service1 = new Network({name: 'foo', routers: [router1.getAddress(), router2.getAddress()]})
      service2 = new Network({name: 'bar', routers: [router1.getAddress(), router2.getAddress()]})
      await router1.start()
      await router2.start()
      await service1.start()
      await service2.start()
    } catch (err) {
      console.log(err)
    }
  })

  afterEach(async () => {
    try {
      await service1.stop()
      await service2.stop()
      await router1.stop()
      await router2.stop()
    } catch (err) {
      console.log(err)
    }
  })

  it('tick To Service With Id', (done) => {
    let data = {foo: 'bar'}
    service1.onTick('foobar', (msg) => {
      assert.deepEqual(msg, data)
      done()
    })
    service2.proxyTick({ to: service1.getId(), event: 'foobar', data })
  })

  it('request To Service With Id Timeout', (done) => {
    let data = {foo: 'bar'}
    service1.onRequest('foobar', (msg) => {
      assert.deepEqual(msg.body, data)
    })
    service2.proxyRequest({ to: service1.getId(), event: 'foobar', data, timeout: 500 })
            .catch(err => {
              assert.include(err.error.message, 'timeout')
              done()
            })
  })

  it('request Service With Id Reply', (done) => {
    let data = {foo: 'bar'}
    service1.onRequest('foobar', (msg) => {
      assert.deepEqual(msg.body, data)
      msg.reply(data)
    })
    service2.proxyRequest({ to: service1.getId(), event: 'foobar', data })
            .then(msg => {
              assert.deepEqual(msg, data)
              done()
            })
  })

  it('tick Any Service', (done) => {
    let data = {foo: 'bar'}
    service1.onTick('foobar', (msg) => {
      assert.deepEqual(msg, data)
      done()
    })
    service2.getService(service1.getName()).tickAny({ event: 'foobar', data })
  })

  it('request Any Service Timeout', (done) => {
    let data = {foo: 'bar'}
    service1.onRequest('foobar', (msg) => {
      assert.deepEqual(msg.body, data)
    })
    service2.getService(service1.getName()).requestAny({ event: 'foobar', data, timeout: 500 })
            .catch(err => {
              assert.include(err.error.message, 'timeout')
              done()
            })
  })

  it('request Any Service Reply', (done) => {
    let data = {foo: 'bar'}
    service1.onRequest('foobar', (msg) => {
      assert.deepEqual(msg.body, data)
      msg.reply(data)
    })
    service2.getService(service1.getName()).requestAny({ event: 'foobar', data })
            .then(msg => {
              assert.deepEqual(msg, data)
              done()
            })
  })

  it('tick all Services', (done) => {
    let data = {foo: 'bar'}
    service1.onTick('foobar', (msg) => {
      assert.deepEqual(msg, data)
      done()
    })
    service2.getService(service1.getName()).tickAll({ event: 'foobar', data })
  })

  it('tick all routers', (done) => {
    let expectedMessage = { foo: 'bar' }
    let count = 0

    router1.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      count++
      count === 2 && done()
    })

    router2.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      count++
      count === 2 && done()
    })

    service1.tickAllRouters({
      event: 'foo',
      data: expectedMessage
    })
  })

  it('tick to service with routing interface', (done) => {
    let expectedMessage = { foo: 'bar' }

    router1.onTick(Events.ROUTER.MESSAGE, (msg) => {
      assert.deepEqual(msg.data, expectedMessage)
      assert.equal(msg.id, service2.getId())
    })

    service2.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      done()
    })

    service1.getRoutingInterface({ region: 'US' })
      .proxyTick({
        to: service2.getId(),
        event: 'foo',
        data: expectedMessage
      })
  })

  it('tick any service with routing interface', (done) => {
    let expectedMessage = { foo: 'bar' }

    router1.onTick(Events.ROUTER.MESSAGE, (msg) => {
      assert.deepEqual(msg.data, expectedMessage)
    })

    service2.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      done()
    })

    service1.getRoutingInterface({ region: 'US' })
      .proxyTickAny({
        event: 'foo',
        data: expectedMessage,
        filter: { service: 'bar' }
      })
  })

  it('tick all service with routing interface', (done) => {
    let expectedMessage = { foo: 'bar' }
    let count = 0

    service2.onTick('foo', (msg, head) => {
      assert.equal(head.id, router1.getId())
      assert.deepEqual(msg, expectedMessage)
      count++
      count === 2 && done()
    })

    service1.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      count++
      count === 2 && done()
    })

    service1.getRoutingInterface({ region: 'US' })
      .proxyTickAll({
        event: 'foo',
        data: expectedMessage
      })
  })


  it('request to service with routing interface', async () => {
    let expectedMessage = { foo: 'bar' }

    service2.onRequest('foo', ({ reply, body, head }) => {
      assert.equal(head.id, router1.getId())
      assert.deepEqual(body, expectedMessage)
      reply(body)
    })

    let res = await service1.getRoutingInterface({ region: 'US' })
      .proxyRequest({
        to: service2.getId(),
        event: 'foo',
        data: expectedMessage
      })

    assert.deepEqual(res, expectedMessage)
  })

  it('request any service with routing interface', async () => {
    let expectedMessage = { foo: 'bar' }

    service2.onRequest('foo', ({ body, reply, head }) => {
      assert.equal(head.id, router1.getId())
      assert.deepEqual(body, expectedMessage)
      reply(body)
    })

    let res = await service1.getRoutingInterface({ region: 'US' })
      .proxyRequestAny({
        event: 'foo',
        data: expectedMessage,
        filter: { service: 'bar' }
      })

    assert.deepEqual(res, expectedMessage)
  })
})
