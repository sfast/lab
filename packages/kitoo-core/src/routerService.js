/**
 * Created by artak on 2/22/17.
 */

import shortid from 'shortid'
import {NodeEvents} from 'zeronode'

import Globals from './globals'
import proxyUtils from './proxy'
import ServiceBase from './serviceBase'

import { deserializeObject } from './utils'
import { ServiceStatus } from './enum'

const { EVENTS } = Globals

export default class RouterService extends ServiceBase {
  constructor ({id, bind, options = {} } = {}) {
    id = id || `router::${shortid.generate()}`

    super({id, bind, options})

    this.on(NodeEvents.CLIENT_CONNECTED, this::_serviceWelcomeHandler)
    this.on(NodeEvents.CLIENT_FAILURE, this::_serviceFailOrStopHandler)
    this.on(NodeEvents.CLIENT_STOP, this::_serviceFailOrStopHandler)
  }

  async start () {
    if (this.getStatus() === ServiceStatus.ONLINE)  return

    super.start()
    await this.bind(this.getAddress())

    // ** PROXIES EXPECTING FROM SERVICE LAYER
    // ** attaching event handlers
    this.onTick(EVENTS.ROUTER.MESSAGE, this::_routerTickMessageHandler)
    this.onRequest(EVENTS.ROUTER.MESSAGE, this::_routerRequestMessageHandler)
  }

  async stop () {
    if (this.getStatus() !== ServiceStatus.ONLINE) return

    await super.stop()

    // ** detaching event handlers
    this.offTick(EVENTS.ROUTER.MESSAGE)
    this.offRequest(EVENTS.ROUTER.MESSAGE)
  }

  async connectToExistingNetwork (routerAddress) {
    if (this.getStatus() !== ServiceStatus.ONLINE) {
      throw 'Need to start router before connecting to network'
    }

    let { actorId, address } = await this.connect(routerAddress)

    this::proxyUtils.proxyTick({
      id: actorId,
      type: EVENTS.ROUTER.MESSAGE_TYPES.BROADCAST,
      filter: {},
      event: EVENTS.NETWORK.NEW_ROUTER,
      data: this.getAddress()
    })

    await this.disconnect(address)
  }
}

async function _serviceWelcomeHandler ({id, options} = {}) {
  try {
    // TODO::DAVE (you said its not a router)
    this.emit(KitooCoreEvents.SERVICE_WELCOME)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _serviceFailOrStopHandler ({id}) {
  try {
    let service = await storage.findOne(collections.NETWORKS, {routerId: this.getId(), id})
    if (!service) {
      return
    }
    service.status = false
    await storage.update(collections.NETWORKS, service)
  } catch (err) {
    this.logger.error(`error while handling service Fail: ${err}`)
  }
}

function _routerTickMessageHandler ({type, id, event, data, filter} = {}) {
  try {

    // TODO :: some higher level checking if there is service with that filter

    switch (type) {
      case EVENTS.ROUTER.MESSAGE_TYPES.BROADCAST:
        filter = deserializeObject(filter)
        this.tickAll({ event, data, filter })
        break
      case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY:
        filter = deserializeObject(filter)
        this.tickAny({ event, data, filter })
        break
      case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO:
        this.tick({ to: id, event, data })
        break
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
      case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY:
        filter = deserializeObject(filter)
        serviceResponse = await this.requestAny({ event, data, timeout, filter })
        break
      case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO:
        serviceResponse = await this.request({ to: id, event, data, timeout })
        break
    }
    reply(serviceResponse)
  } catch (err) {
    this.logger.error(`error while handling request message: ${err}`)
  }
}
