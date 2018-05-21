/**
 * Created by artak on 2/22/17.
 */

import _ from 'underscore'
import { NodeEvents, Node } from 'zeronode'
import uuid from 'uuid/v4'
import Promise from 'bluebird'

import proxyUtils from './proxy'
import ServiceBase from './serviceBase'
import {storage, collections} from './storage'
import { ServiceStatus, MessageTypes } from './enum'
import { Events, KitooCoreEvents } from './events'

let _private = new WeakMap()

export default class NetworkService extends ServiceBase {
  constructor ({ id, name, version, router, options, config } = {}) {
    id = id || `network::${uuid()}`
    options = options || {}
    config = config || {}

    super({ id, name, version, options })

    let node = new Node({ id: this.getId(), options, config })

    this.logger = node.logger

    // ** routers is just the addresses the network should connect to
    let _scope = {
      router,
      node
    }

    _private.set(this, _scope)

    node.on(NodeEvents.CONNECT_TO_SERVER, this::_connectToRouter)

    // ** router failure listener
    node.on(NodeEvents.SERVER_FAILURE, this::_routerFailureHandler)

    // ** router stop listner
    node.on(NodeEvents.SERVER_STOP, this::_routerStopHandler)

    // ** router reconnect listener
    node.on(NodeEvents.SERVER_RECONNECT, this::_routerReconnectHandler)

    // ** router reconnect failure listener
    node.on(NodeEvents.SERVER_RECONNECT_FAILURE, this::_routerReconnectFailureHandler)


    // ** attaching handlers
    node.onTick(Events.NETWORK.NEW_ROUTER, this::_newRouterHandler)
    node.onRequest(Events.NETWORK.GET_ROUTERS, this::_getRoutersHandler)
  }

  toJSON () {
    // add routersInfo
    let { node } = _private.get(this)
    return Object.assign(super.toJSON(), { options: node.getOptions() })
  }

  async getRouters () {
    let routers = await storage.find(collections.ROUTERS, {networkId: this.getId()})
    return _.map(routers, (router) => router.address)
  }

  // ** start and then connect
  async connectRouter ({ routerAddress, timeout, reconnectionTimeout } = {}) {
    if (this.getStatus() !== ServiceStatus.ONLINE) {
      throw new Error(`NetworkService ${this.getId()} connect error. You first need to start network service then start connect to routers`)
    }
    let { node } = _private.get(this)

    // ** awaiting the actor of router
    let { online, address } = await node.connect({ address: routerAddress, timeout, reconnectionTimeout })

    return online ? this.addRouter(address) : null
  }

  async disconnectRouter (routerAddress) {
    let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()})

    if (!router) return null

    let { node } = _private.get(this)

    await node.disconnect(router.address)
    await storage.remove(collections.ROUTERS, router)
    return true
  }

  async addRouter (routerAddress) {
    let _scope = _private.get(this)

    _scope.router = _scope.router || routerAddress

    let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()})
    if (!router) {
      router = await storage.insert(collections.ROUTERS, {address: routerAddress, networkId: this.getId()})
    }

    return router
  }

  removeRouter (routerAddress) {
    return this.disconnectRouter(routerAddress)
  }

  // ** reviewed
  async start () {
    let { router } = _private.get(this)

    if (!router) {
      throw new Error('add router before starting network service ')
    }

    if (this.getStatus() === ServiceStatus.ONLINE) return

    super.start()

    await this.connectRouter({ routerAddress: router })

    let allRouters = []
    try {
      allRouters = await this.proxyRequestAny({ event: Events.NETWORK.GET_ROUTERS })
    } catch (err) {
      // ignore this error
    }
    _.each(allRouters, async (routerAddress) => {
      try {
        if (routerAddress === router) return

        await this.connectRouter({ routerAddress })
      } catch (err) {
        this.logger.error('Error while trying to connect router in start', err)
      }
    })
  }

  // ** reviewed
  async stop () {
    let { node } = _private.get(this)

    super.stop()
    await node.stop()

    // ** detaching handlers
    node.offTick(Events.NETWORK.NEW_ROUTER)
  }

  // TODO add example
  getRoutingInterface (routerFilter) {
    let { node } = _private.get(this)
    let self = this

    let interfaceObject = {
      proxyTick ({ to, event, data } = {}) {
        return node::proxyUtils.proxyTick({
          id: to,
          event,
          data,
          type: MessageTypes.EMIT_TO,
          routerFilter
        })
      },

      proxyTickAny ({ event, data, filter = {} } = {}) {
        return node::proxyUtils.proxyTick({
          event,
          data,
          filter,
          type: MessageTypes.EMIT_ANY,
          routerFilter
        })
      },

      proxyTickAll ({ event, data, filter = {} }) {
        return node::proxyUtils.proxyTick({
          event,
          data,
          filter,
          type: MessageTypes.BROADCAST,
          routerFilter
        })
      },

      async proxyRequest ({ to, event, data, timeout } = {}) {
        return node::proxyUtils.proxyRequest({
          id: to,
          event,
          data,
          timeout,
          type: MessageTypes.EMIT_TO,
          routerFilter
        })
      },

      async proxyRequestAny ({ event, data, timeout, filter = {} } = {}) {
        return node::proxyUtils.proxyRequest({
          event,
          data,
          timeout,
          filter,
          type: MessageTypes.EMIT_ANY,
          routerFilter
        })
      },

      getService (serviceName) {
        return interfaceObject::self.getService(serviceName)
      }
    }

    return interfaceObject
  }

  // ** Tick to services
  proxyTick ({ to, event, data } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyTick({ id: to, event, data, type: MessageTypes.EMIT_TO })
  }

  proxyTickAny ({ event, data, filter = {} } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyTick({ event, data, filter, type: MessageTypes.EMIT_ANY })
  }

  proxyTickAll ({ event, data, filter = {} }) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyTick({ event, data, filter, type: MessageTypes.BROADCAST })
  }

  // ** request to Services
  async proxyRequestAny ({ event, data, timeout, filter = {} } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyRequest({ event, data, timeout, filter, type: MessageTypes.EMIT_ANY })
  }

  async proxyRequest ({ to, event, data, timeout } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyRequest({ id: to, event, data, timeout, type: MessageTypes.EMIT_TO })
  }

  tickToRouter ({ to, event, data }) {
    let { node } = _private.get(this)
    return node.tick({ to, event, data })
  }

  tickAnyRouter ({ event, data, filter }) {
    let { node } = _private.get(this)
    return node.tickAny({ event, data, filter })
  }

  tickAllRouters ({ event, data, filter }) {
    let { node } = _private.get(this)
    return node.tickAll({ event, data, filter })
  }

  requestToRouter ({ to, event, data, timeout }) {
    let { node } = _private.get(this)
    return node.request({ to, event, data, timeout })
  }

  requestAnyRouter ({ event, data, timeout, filter }) {
    let { node } = _private.get(this)
    return node.requestAny({ event, data, timeout, filter })
  }

  getService (serviceName) {
    return {
      tickAny: ({ event, data }) => {
        this.proxyTickAny({ event, data, filter: {service: serviceName} })
      },
      tickAll: ({ event, data }) => {
        this.proxyTickAll({ event, data, filter: {service: serviceName} })
      },
      requestAny: ({ event, data, timeout }) => {
        return this.proxyRequestAny({ event, data, timeout, filter: {service: serviceName} })
      }
    }
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

  // ** You can subscribe at first and then connect to router
  async subscribe ({ event, handler, service = '*' }) {
    let { node } = _private.get(this)
    let options = node.getOptions()

    if (!options.subscribed) options.subscribed = {}
    if (!options.subscribed[event]) options.subscribed[event] = []

    let subscribedEventServices = options.subscribed[event]

    // TODO ::review subscribedEventServices.push(service)
    if (subscribedEventServices === '*' || service === '*') options.subscribed[event] = '*'
    else if (Array.isArray(service)) options.subscribed[event] = [...(new Set([...subscribedEventServices, ...service]))]
    else subscribedEventServices.push(service)

    await node.setOptions(options)

    node.onTick(event, handler)
  }

  publish ({ event, data }) {
    let { node } = _private.get(this)
    node::proxyUtils.proxyTick({ event, data, type: MessageTypes.PUBLISH })
  }
}

async function _newRouterHandler (routerAddress) {
  try {
    await this.connectRouter({ routerAddress })
    this.logger.info(`New router with address - ${routerAddress}`)
    this.emit(KitooCoreEvents.NEW_ROUTER, { address: routerAddress })
  } catch (err) {
    this.emit('error', err)
  }
}

async function _getRoutersHandler ({ reply, next }) {
  try {
    let routers = await this.getRouters()
    reply(routers)
  } catch (err) {
    next(err)
  }
}

async function _routerStopHandler (routerInfo) {
  try {
    await this.disconnectRouter(routerInfo.address)
    this.logger.info(`Router stop with address/id - ${routerInfo.address}/${routerInfo.id}`)
    this.emit(KitooCoreEvents.ROUTER_STOP, routerInfo)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _routerFailureHandler (routerInfo) {
  try {
    this.logger.info(`Router failed with address/id - ${routerInfo.address}/${routerInfo.id}`)
    this.emit(KitooCoreEvents.ROUTER_FAIL, routerInfo)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _routerReconnectHandler (routerInfo) {
  try {
    this.logger.info(`Router reconnected with address/id - ${routerInfo.address}/${routerInfo.id}`)
    this.emit(KitooCoreEvents.ROUTER_RECONNECT, routerInfo)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _routerReconnectFailureHandler (routerInfo) {
  try {
    await this.disconnectRouter(routerInfo.address)
    this.logger.info(`Eouter reconnected with address/id - ${routerInfo.address}/${routerInfo.id}`)
    this.emit(KitooCoreEvents.ROUTER_RECONNECT_FAILURE, routerInfo)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _connectToRouter (routerInfo) {
  try {
    this.logger.info(`Connected to router with address/id - ${routerInfo.address}/${routerInfo.id}`)
    this.emit(KitooCoreEvents.CONNECT_TO_ROUTER, routerInfo)
  } catch (err) {
    this.emit('error', err)
  }
}
