/**
 * Created by artak on 2/22/17.
 */

import _ from 'underscore'
import {NodeEvents, ErrorCodes} from 'zeronode'
import shortid from 'shortid'
import Promise from 'bluebird'

import globals from './globals'
import proxyUtils from './proxy'
import ServiceBase from './serviceBase'
import {getStorageInstance, collections} from './storage'
import { KitooCoreError, KitooCoreErrorCodes } from './errors'
import {serializeObject} from './utils'
import { ServiceStatus } from './enum'

let {EVENTS} = globals
let storage = getStorageInstance()

let _private = new WeakMap()

export default class NetworkService extends ServiceBase {
  constructor ({ id, name, routers, options } = {}) {
    id = id || `network::${shortid.generate()}`
    options = options || {}
    routers = routers || []

    super({id, name, options})

    // ** routers is just the addresses the network should connect to
    let _scope = {
      routers: new Set(routers)
    }

    _private.set(this, _scope)

    // ** router failure listener
    this.on(NodeEvents.SERVER_FAILURE, this::_routerFailureHandler)

    // ** router stop listner
    this.on(NodeEvents.SERVER_STOP, this::_routerStopHandler)
  }

  toJSON () {
    // add routersInfo
    return super.toJSON()
  }

  // ** TODO
  async getRouters() {
    let _scope = _private.get(this)
    let routers = await storage.find(collections.ROUTERS, {networkId: this.getId()})
    return routers.length ?  routers : _scope.routers
  }

  // ** start and then connect
  async connect (routerAddress, timeout) {
    if (this.getStatus() !== ServiceStatus.ONLINE) {
      throw `NetworkServie ${this.getId()} connect error. You first need to start network service then start connect to routers`
    }

    // ** awaiting the actor of router
    let { online, address } = await super.connect(routerAddress, timeout)

    return online ? await this.addRouter(address) : null
  }

  async disconnect (routerAddress) {
    let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()})

    if (!router) return null

    await super.disconnect(router.address)
    await storage.remove(collections.ROUTERS, router)
    return true
  }

  async addRouter (routerAddress) {
    let _scope = _private.get(this)
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

    super.start()

    let routersToConnect = await this.getRouters()

    let connectionPromises = _.map(routersToConnect, (router) => {
      return this.connect(router.address)
    })

    await Promise.all(connectionPromises)

    // ** attaching handlers
    this.onTick(EVENTS.NETWORK.NEW_ROUTER, this::_newRouterHandler)
  }

  // ** reviewed
  async stop () {
    await super.stop()

    // ** detaching handlers
    this.offTick(EVENTS.NETWORK.NEW_ROUTER)
  }

  getRoutingInterface (filter) {
      //TODO::DAVE
  }

  proxyTick ({ to, event, data } = {}) {
    return this::proxyUtils.proxyTick({ id: to, event, data,  type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO })
  }

  proxyTickAny ({ event, data, filter = {} } = {}) {
    return this::proxyUtils.proxyTick({ event, data, filter,  type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY })
  }

  proxyTickAll ({ event, data, filter = {} }) {
    return this::proxyUtils.proxyTick({ event, data, filter,  type: EVENTS.ROUTER.MESSAGE_TYPES.BROADCAST })
  }

  async proxyRequestAny ({ event, data, timeout, filter = {} } = {}) {
    return this::proxyUtils.proxyRequest({ event, data, timeout, filter,  type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY })
  }

  async proxyRequest ({ to, event, data, timeout } = {}) {
      return this::proxyUtils.proxyRequest({ id : to, event, data, timeout, type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO })
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
      requestAny: async ({ event, data, timeout }) => {
        return await self.proxyRequestAny({ event, data, timeout, filter: {serviceName} })
      }
    }
  }

}

async function _newRouterHandler (routerAddress) {
  try {
    await this.connect(routerAddress)
    this.logger.info(`New router with address - ${routerAddress}`)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _routerStopHandler (routerInfo) {
  try {
    await this.disconnect(routerInfo.address)
    this.logger.info(`Router stop with address/id - ${routerInfo.address}/${routerInfo.id}`)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _routerFailureHandler (routerInfo) {
  try {
    // TODO:: what id router failed and we'll need to wait for it for ages ?
    this.logger.info(`Eouter failed with address/id - ${routerInfo.address}/${routerInfo.id}`)
  } catch (err) {
    this.emit('error', err)
  }
}
