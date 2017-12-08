/**
 * Created by artak on 2/22/17.
 */

import uuid from 'uuid/v4'
import { NodeEvents, Node } from 'zeronode'

import proxyUtils from './proxy'
import ServiceBase from './serviceBase'

import { deserializeObject, publishPredicateBuilder } from './utils'
import { ServiceStatus, KitooCoreEvents, Events } from './enum'

let _private = new WeakMap()

export default class RouterService extends ServiceBase {
  constructor ({ id, name, bind, options = {} } = {}) {
    id = id || `router::${uuid()}`

    super({ id, name, options })
    let node = new Node({ id, bind, options })

    let _scope = {
      node
    }

    node.on(NodeEvents.CLIENT_CONNECTED, this::_serviceWelcomeHandler)
    node.on(NodeEvents.CLIENT_FAILURE, this::_serviceFailHandler)
    node.on(NodeEvents.CLIENT_STOP, this::_serviceStopHandler)

    _private.set(this, _scope)
  }

  async start (bind) {
    if (this.getStatus() === ServiceStatus.ONLINE) return

    let { node } = _private.get(this)

    super.start()
    await node.bind(bind)

    // ** PROXIES EXPECTING FROM SERVICE LAYER
    // ** attaching event handlers
    node.onTick(Events.ROUTER.MESSAGE, node::_routerTickMessageHandler)
    node.onRequest(Events.ROUTER.MESSAGE, node::_routerRequestMessageHandler)
  }

  async stop () {
    if (this.getStatus() !== ServiceStatus.ONLINE) return

    let { node } = _private.get(this)

    super.stop()

    await node.stop()

    // ** detaching event handlers
    node.offTick(Events.ROUTER.MESSAGE)
    node.offRequest(Events.ROUTER.MESSAGE)
  }

  async connectToExistingNetwork (routerAddress) {
    if (this.getStatus() !== ServiceStatus.ONLINE) {
      throw new Error('Need to start router before connecting to network')
    }

    let { node } = _private.get(this)
    let { actorId, address } = await node.connect(routerAddress)

    node::proxyUtils.proxyTick({
      id: actorId,
      type: Events.ROUTER.MESSAGE_TYPES.BROADCAST,
      filter: {},
      event: Events.NETWORK.NEW_ROUTER,
      data: node.getAddress()
    })

    await node.disconnect(address)
  }

  getAddress () {
    let { node } = _private.get(this)
    return node.getAddress()
  }

  // ** tick to services
  tickToService ({ to, event, data }) {
    let { node } = _private.get(this)
    return node.tick({ to, event, data })
  }

  tickAnyService ({ event, data, filterfon }) {
    let { node } = _private.get(this)
    return node.tickAny({ event, data, filter })
  }

  tickAllServices ({ event, data, filter }) {
    let { node } = _private.get(this)
    return node.tickAll({ event, data, filter })
  }

  requestToService ({ to, event, data, timeout }) {
    let { node } = _private.get(this)
    return node.request({ to, event, data, timeout })
  }

  requestAnyService ({ event, data, timeout, filter }) {
    let { node } = _private.get(this)
    return node.requestAny({ event, data, timeout, filter })
  }

  onTick (event, handler) {
    let { node } = _private.get(this)

    node.onTick(event, handler)
  }

  offTick (event, handler) {
    let { node } = _private.get(this)

    node.offTick(event, handler)
  }

  onRequest (requestEvent, handler) {
    let { node } = _private.get(this)

    node.onRequest(requestEvent, handler)
  }

  offRequest (requestEvent, handler) {
    let { node } = _private.get(this)

    node.offRequest(requestEvent, handler)
  }

}

async function _serviceWelcomeHandler (welcomeData) {
  try {
    // TODO::DAVE (you said its not a router)
    this.emit(KitooCoreEvents.SERVICE_WELCOME, welcomeData)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _serviceFailHandler (failData) {
  try {
    this.emit(KitooCoreEvents.SERVICE_FAIL, failData)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _serviceStopHandler (stopData) {
  try {
    this.emit(KitooCoreEvents.SERVICE_STOP, stopData)
  } catch (err) {
    this.emit('error', err)
  }
}

function _routerTickMessageHandler ({type, id, event, data, filter} = {}) {
  try {
    // TODO :: some higher level checking if there is service with that filter

    switch (type) {
      case Events.ROUTER.MESSAGE_TYPES.BROADCAST:
        filter = deserializeObject(filter)
        this.tickAll({ event, data, filter })
        break
      case Events.ROUTER.MESSAGE_TYPES.EMIT_ANY:
        filter = deserializeObject(filter)
        this.tickAny({ event, data, filter })
        break
      case Events.ROUTER.MESSAGE_TYPES.EMIT_TO:
        this.tick({ to: id, event, data })
        break
      case Events.ROUTER.MESSAGE_TYPES.PUBLISH:
        this.tickAll({ event, data, filter: publishPredicateBuilder(event) })
    }
  } catch (err) {
    this.logger.error(`error while handling service message:`, err)
  }
}

async function _routerRequestMessageHandler (request) {
  try {
    let {body, reply} = request
    let {type, id, event, data, timeout, filter} = body
    let serviceResponse
        // TODO :: some higher level checking if there is service with that filter
    switch (type) {
      case Events.ROUTER.MESSAGE_TYPES.EMIT_ANY:
        filter = deserializeObject(filter)
        serviceResponse = await this.requestAny({ event, data, timeout, filter })
        break
      case Events.ROUTER.MESSAGE_TYPES.EMIT_TO:
        serviceResponse = await this.request({ to: id, event, data, timeout })
        break
    }
    reply(serviceResponse)
  } catch (err) {
    // this.logger.error(`error while handling request message: ${err}`)
  }
}
