/**
 * Created by artak on 2/22/17.
 */

import _ from 'underscore'
import { NodeEvents, Node } from 'zeronode'
import uuid from 'uuid/v4'
import Promise from 'bluebird'

import proxyUtils from './proxy'
import ServiceBase from './serviceBase'
import {getStorageInstance, collections} from './storage'
import { ServiceStatus, Events, KitooCoreEvents } from './enum'

let storage = getStorageInstance()

let _private = new WeakMap()

export default class NetworkService extends ServiceBase {
  constructor ({ id, name, routers, options } = {}) {
    id = id || `network::${uuid()}`
    options = options || {}
    routers = routers || []

    super({ id, name, options })

    let node = new Node({ id: this.getId(), options })

    this.logger = node.logger

    // ** routers is just the addresses the network should connect to
    let _scope = {
      routers,
      node
    }

    _private.set(this, _scope)

    // ** router failure listener
    node.on(NodeEvents.SERVER_FAILURE, this::_routerFailureHandler)

    // ** router stop listner
    node.on(NodeEvents.SERVER_STOP, this::_routerStopHandler)
  }

  toJSON () {
    // add routersInfo
    let { node } = _private.get(this)
    return Object.assign(super.toJSON(), { options: node.getOptions() })
  }

  // ** TODO
  async getRouters () {
    let _scope = _private.get(this)
    let routers = await storage.find(collections.ROUTERS, {networkId: this.getId()})
    return routers.length ? _.map(routers, (router) => router.address) : _scope.routers
  }

  // ** start and then connect
  async connect (routerAddress, timeout) {
    if (this.getStatus() !== ServiceStatus.ONLINE) {
      throw new Error(`NetworkService ${this.getId()} connect error. You first need to start network service then start connect to routers`)
    }
    let { node } = _private.get(this)

    // ** awaiting the actor of router
    let { online, address } = await node.connect(routerAddress, timeout)

    return online ? this.addRouter(address) : null
  }

  async disconnect (routerAddress) {
    let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()})

    if (!router) return null

    let { node } = _private.get(this)

    await node.disconnect(router.address)
    await storage.remove(collections.ROUTERS, router)
    return true
  }

  async addRouter (routerAddress) {
    let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()})
    if (!router) {
      router = await storage.insert(collections.ROUTERS, {address: routerAddress, networkId: this.getId()})
    }

    return router
  }

  removeRouter (routerAddress) {
    return this.disconnect(routerAddress)
  }

  // ** reviewed
  async start () {
    if (this.getStatus() === ServiceStatus.ONLINE) return

    let { node } = _private.get(this)
    super.start()

    let routersToConnect = await this.getRouters()

    let connectionPromises = _.map(routersToConnect, (router) => {
      return node.connect(router)
    })

    await Promise.all(connectionPromises)

    // ** attaching handlers
    node.onTick(Events.NETWORK.NEW_ROUTER, this::_newRouterHandler)
  }

  // ** reviewed
  async stop () {
    let { node } = _private.get(this)

    super.stop()
    await node.stop()

    // ** detaching handlers
    node.offTick(Events.NETWORK.NEW_ROUTER)
  }

  getRoutingInterface (routerFilter) {
    let { node } = _private.get(this)
    let self = this

    let interfaceObject = {
      proxyTick ({ to, event, data } = {}) {
        return node::proxyUtils.proxyTick({
          id: to,
          event,
          data,
          type: Events.ROUTER.MESSAGE_TYPES.EMIT_TO,
          routerFilter
        })
      },

      proxyTickAny ({ event, data, filter = {} } = {}) {
        return node::proxyUtils.proxyTick({
          event,
          data,
          filter,
          type: Events.ROUTER.MESSAGE_TYPES.EMIT_ANY,
          routerFilter
        })
      },

      proxyTickAll ({ event, data, filter = {} }) {
        return node::proxyUtils.proxyTick({
          event,
          data,
          filter,
          type: Events.ROUTER.MESSAGE_TYPES.BROADCAST,
          routerFilter
        })
      },

      async proxyRequest ({ to, event, data, timeout } = {}) {
        return node::proxyUtils.proxyRequest({
          id: to,
          event,
          data,
          timeout,
          type: Events.ROUTER.MESSAGE_TYPES.EMIT_TO,
          routerFilter
        })
      },

      async proxyRequestAny ({ event, data, timeout, filter = {} } = {}) {
        return node::proxyUtils.proxyRequest({
          event,
          data,
          timeout,
          filter,
          type: Events.ROUTER.MESSAGE_TYPES.EMIT_ANY,
          routerFilter
        })
      },

      getService (serviceName) {
        interfaceObject::self.getService(serviceName)
      }
    }

    return interfaceObject
  }

  // ** Tick to services
  proxyTick ({ to, event, data } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyTick({ id: to, event, data, type: Events.ROUTER.MESSAGE_TYPES.EMIT_TO })
  }

  proxyTickAny ({ event, data, filter = {} } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyTick({ event, data, filter, type: Events.ROUTER.MESSAGE_TYPES.EMIT_ANY })
  }

  proxyTickAll ({ event, data, filter = {} }) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyTick({ event, data, filter, type: Events.ROUTER.MESSAGE_TYPES.BROADCAST })
  }

  // ** request to Services
  async proxyRequestAny ({ event, data, timeout, filter = {} } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyRequest({ event, data, timeout, filter, type: Events.ROUTER.MESSAGE_TYPES.EMIT_ANY })
  }

  async proxyRequest ({ to, event, data, timeout } = {}) {
    let { node } = _private.get(this)
    return node::proxyUtils.proxyRequest({ id: to, event, data, timeout, type: Events.ROUTER.MESSAGE_TYPES.EMIT_TO })
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
    let self = this

    return {
      tickAny: ({ event, data }) => {
        self.proxyTickAny({ event, data, filter: {serviceName} })
      },
      tickAll: ({ event, data }) => {
        self.proxyTickAll({ event, data, filter: {serviceName} })
      },
      requestAny: ({ event, data, timeout }) => {
        return self.proxyRequestAny({ event, data, timeout, filter: {serviceName} })
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

  async subscribe ({ event, handler, service = '*' }) {
    let { node } = _private.get(this)
    let options = node.getOptions()

    if (!options.subscribed) options.subscribed = {}
    if (!options.subscribed[event]) options.subscribed[event] = []

    let subscribedEventServices = options.subscribed[event]

    if (subscribedEventServices === '*' || service === '*') options.subscribed[event] = '*'
    else if (Array.isArray(service)) options.subscribed[event] = [...(new Set([...subscribedEventServices, ...service]))]
    else subscribedEventServices.push(service)

    await node.setOptions(options)

    node.onTick(event, handler)
  }

  publish ({ event, data }) {
    let { node } = _private.get(this)
    node::proxyUtils.proxyTick({ event, data, type: Events.ROUTER.MESSAGE_TYPES.PUBLISH })
  }
}

async function _newRouterHandler (routerAddress) {
  try {
    await this.connect(routerAddress)
    this.logger.info(`New router with address - ${routerAddress}`)
    this.emit(KitooCoreEvents.NEW_ROUTER, { address: routerAddress })
  } catch (err) {
    this.emit('error', err)
  }
}

async function _routerStopHandler (routerInfo) {
  try {
    await this.disconnect(routerInfo.address)
    this.logger.info(`Router stop with address/id - ${routerInfo.address}/${routerInfo.id}`)
    this.emit(KitooCoreEvents.ROUTER_STOP, routerInfo)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _routerFailureHandler (routerInfo) {
  try {
    // TODO:: what id router failed and we'll need to wait for it for ages ?
    this.logger.info(`Eouter failed with address/id - ${routerInfo.address}/${routerInfo.id}`)
    this.emit(KitooCoreEvents.ROUTER_FAIL, routerInfo)
  } catch (err) {
    this.emit('error', err)
  }
}
