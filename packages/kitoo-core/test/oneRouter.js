/**
 * Created by root on 7/25/17.
 */
import { assert } from 'chai'

import { Router, Network, ErrorCodes, ServiceStatus } from '../src'

describe('singleRouter', () => {
  let router, service1, service2

  beforeEach(async () => {
    try {
      router = new Router({bind: 'tcp://127.0.0.1:8000'})
      service1 = new Network({name: 'foo', router: router.getAddress()})
      service2 = new Network({name: 'bar', router: router.getAddress()})
      await router.start()
      await service1.start()
      await service2.start()
    } catch (err) {
      console.error(err)
    }
  })

  afterEach(async () => {
    try {
      await service1.stop()
      await service2.stop()
      await router.stop()
    } catch (err) {
      console.error(err)
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

  it('pattern listeners', (done) => {
    let data = {foo: 'bar'}
    service1.onTick(/^foo/, (msg) => {
      assert.deepEqual(msg, data)
      done()
    })
    service2.getService(service1.getName()).tickAny({ event: 'foobar', data })
  })

  it('pattern filters', (done) => {
    let data = {foo: 'bar'}
    service1.onTick('foobar', (msg) => {
      assert.deepEqual(msg, data)
      done()
    })
    service2.proxyTickAny({ event: 'foobar', data, filter: {service: /^foo/} })
  })

  it('tick to router', (done) => {
    let expectedMessage = { foo: 'bar' }

    router.onTick('foo', (msg) => {
      router.offTick('foo')
      assert.deepEqual(msg, expectedMessage)
      done()
    })

    service1.tickToRouter({
      to: router.getId(),
      event: 'foo',
      data: expectedMessage
    })
  })

  it('tick any router', (done) => {
    let expectedMessage = { foo: 'bar' }

    router.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      done()
    })

    service1.tickAnyRouter({
      event: 'foo',
      data: expectedMessage
    })
  })

  it('request to router', async () => {
    let expectedMessage = { foo: 'bar' }

    router.onRequest('foo', ({ body, reply }) => {
      router.offRequest('foo')
      assert.deepEqual(body, expectedMessage)
      reply(body)
    })

    let res = await service1.requestToRouter({
      to: router.getId(),
      event: 'foo',
      data: expectedMessage
    })

    assert.deepEqual(res, expectedMessage)
  })

  it('request any router', async () => {
    let expectedMessage = { foo: 'bar' }

    router.onRequest('foo', ({ body, reply }) => {
      assert.deepEqual(body, expectedMessage)
      reply(body)
    })

    let res = await service1.requestAnyRouter({
      event: 'foo',
      data: expectedMessage
    })

    assert.deepEqual(res, expectedMessage)
  })

  it ('pub/sub', (done) => {
    let expectedMessage = { foo: 'bar' }

    service1.subscribe({
      event: 'foo',
      service: 'bar',
      handler: (msg) => {
        assert.deepEqual(msg, expectedMessage)
        done()
      }
    })

    service2.publish({ event: 'foo', data: expectedMessage })
  })

  it ('tick to Service', (done) => {
    let expectedMessage = { foo: 'bar' }

    service1.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      done()
    })

    router.tickToService({
      to: service1.getId(),
      event: 'foo',
      data: expectedMessage
    })
  })

  it ('tick any Service', (done) => {
    let expectedMessage = { foo: 'bar' }

    service1.onTick('foo', (msg) => {
      service1.offTick('foo')
      assert.deepEqual(msg, expectedMessage)
      done()
    })

    router.tickAnyService({
      event: 'foo',
      data: expectedMessage,
      filter: { service: 'foo' }
    })
  })

  it ('tick all Services', (done) => {
    let expectedMessage = { foo: 'bar' }
    let count = 0

    service1.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      count++
      count === 2 && done()
    })

    service2.onTick('foo', (msg) => {
      assert.deepEqual(msg, expectedMessage)
      count++
      count === 2 && done()
    })

    router.tickAllServices({
      event: 'foo',
      data: expectedMessage
    })
  })

  it ('request to Service', async () => {
    let expectedMessage = { foo: 'bar' }

    service1.onRequest('foo', ({ body, reply }) => {
      assert.deepEqual(body, expectedMessage)
      reply(body)
    })

    let res = await router.requestToService({
      event: 'foo',
      to: service1.getId(),
      data: expectedMessage,
    })

    assert.deepEqual(res, expectedMessage)
  })

  it ('request any Service', async () => {
    let expectedMessage = { foo: 'bar' }

    service1.onRequest('foo', ({ body, reply }) => {
      assert.deepEqual(body, expectedMessage)
      service1.offRequest('foo')
      reply(body)
    })

    let res = await router.requestAnyService({
      event: 'foo',
      data: expectedMessage,
      filter: { service: 'foo' }
    })

    assert.deepEqual(res, expectedMessage)
  })

  it ('tick fail, node not found', (done) => {
    try {
      service1.getRoutingInterface({ foo: 'bar' }).proxyTickAny({
        event: 'foo',
        data: 'bar',
        filter: { foo: 'bar' }
      })
    } catch (err) {
      assert.equal(err.code, ErrorCodes.NO_ONLINE_ROUTER)
      done()
    }
  })

  it ('request fail, node not found', async () => {
    try {
      await service1.getRoutingInterface({ foo: 'bar' }).proxyRequestAny({
        event: 'foo',
        data: 'bar',
        filter: { foo: 'bar' }
      })
    } catch (err) {
      assert.equal(err.code, ErrorCodes.NO_ONLINE_ROUTER)
    }
  })

  it ('service toJson', (done) => {
    let serviceInfo = service1.toJSON()
    assert.deepEqual(serviceInfo.options, { service: 'foo' })
    assert.equal(serviceInfo.name, 'foo')
    assert.equal(serviceInfo.status, ServiceStatus.ONLINE)
    done()
  })

  it ('disconnect router', async () => {
    let removed = await service1.removeRouter(router.getAddress())
    assert.equal(removed, true)
  })
})
