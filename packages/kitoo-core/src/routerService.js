/**
 * Created by artak on 2/22/17.
 */

import uuid from 'uuid/v4'
import { NodeEvents, Node } from 'zeronode'
import _ from 'underscore'
import semver from 'semver'

import proxyUtils from './proxy'
import ServiceBase from './serviceBase'

import { publishPredicateBuilder, randomWithProbablilities } from './utils'
import { ServiceStatus, MessageTypes, LoadBalancingStrategies } from './enum'
import {  KitooCoreEvents, Events } from './events'

let _private = new WeakMap()

export default class RouterService extends ServiceBase {
  constructor ({ id, name, bind, options = {} } = {}) {
    id = id || `router::${uuid()}`

    super({ id, name, options })
    let node = new Node({ id, bind, options: Object.assign(options, { services: {} }) })

    node.metric.defineColumn('service', '', (row, record) => {
      let serviceId = row.out ? record.to : record.from
      let serviceInfo = node.getClientInfo({ id: serviceId })
      if (!serviceInfo) return row.service
      return `${serviceInfo.options.service}:${serviceInfo.options.version}`
    }, true)
    this.logger = node.logger

    let _scope = {
      node,
      strategy: { all: LoadBalancingStrategies.ROUND_ROBIN }
    }

    node.on(NodeEvents.CLIENT_CONNECTED, this::_serviceWelcomeHandler)
    node.on(NodeEvents.CLIENT_FAILURE, this::_serviceFailHandler)
    node.on(NodeEvents.CLIENT_STOP, this::_serviceStopHandler)
    node.on(NodeEvents.OPTIONS_SYNC, this::_serviceOptionsUpdate)

    _private.set(this, _scope)
  }

  async start (bind) {
    if (this.getStatus() === ServiceStatus.ONLINE) return

    let { node } = _private.get(this)

    super.start()
    await node.bind(bind)
    // enabling metrics
    node.enableMetrics(100)

    // ** PROXIES EXPECTING FROM SERVICE LAYER
    // ** attaching event handlers
    node.onTick(Events.ROUTER.MESSAGE, this::_routerTickMessageHandler)
    node.onRequest(Events.ROUTER.MESSAGE, this::_routerRequestMessageHandler)
    node.onRequest(Events.ROUTER.DEFINE_LOADBALANCING_STRATEGY, this::_defineLoadBalancingStrategyHandler)
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
    let { actorId, address } = await node.connect({ address: routerAddress })

    node::proxyUtils.proxyTick({
      id: actorId,
      type: MessageTypes.BROADCAST,
      filter: {},
      event: Events.NETWORK.NEW_ROUTER,
      data: node.getAddress()
    })

    await node.disconnect(address)
  }

  defineLoadBalancingStrategy ({ service, strategy, options } = {}) {
    strategy = strategy || LoadBalancingStrategies.ROUND_ROBIN
    options = options || {}
    let _scope = _private.get(this)

    if (typeof service === 'undefined') {
      return _scope.strategy.all = { strategy,  options }
    }

    if (typeof service !== 'string') {
      throw 'service must be string'
    }

    _scope.strategy[service] = { strategy, options }
  }

  get node () {
    return _private.get(this).node
  }

  getAddress () {
    let { node } = _private.get(this)
    return node.getAddress()
  }

  // ** tick to services
  tickToService ({ to, event, data }) {
    let { node } = _private.get(this)
    return node.tick({ to, event, data: { data, head: { event, id: node.getId() } } })
  }

  tickAnyService ({ event, data, filter }) {
    let { node } = _private.get(this)
    return node.tickAny({ event, data: { data, head: { event, id: node.getId() } }, filter })
  }

  tickAllServices ({ event, data, filter }) {
    let { node } = _private.get(this)
    return node.tickAll({ event, data: { data, head: { event, id: node.getId() } }, filter })
  }

  requestToService ({ to, event, data, timeout }) {
    let { node } = _private.get(this)
    return node.request({ to, event, data: { data, head: { event, id: node.getId() } }, timeout })
  }

  requestAnyService ({ event, data, timeout, filter }) {
    let { node } = _private.get(this)
    return node.requestAny({ event, data: { data, head: { event, id: node.getId() } }, timeout, filter })
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
    let { node } = _private.get(this)
    let routerOptions = node.getOptions()
    let services = routerOptions.services
    services[welcomeData.id] = welcomeData.options
    setTimeout(() => node.setOptions(routerOptions), 10)
    this.emit(KitooCoreEvents.SERVICE_WELCOME, welcomeData)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _serviceFailHandler (failData) {
  try {
    let { node } = _private.get(this)
    let routerOptions = node.getOptions()
    let services = routerOptions.services
    delete services[failData.id]
    node.setOptions(routerOptions)
    this.emit(KitooCoreEvents.SERVICE_FAIL, failData)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _serviceStopHandler (stopData) {
  try {
    let { node } = _private.get(this)
    let routerOptions = node.getOptions()
    let services = routerOptions.services
    delete services[stopData.id]
    node.setOptions(routerOptions)
    this.emit(KitooCoreEvents.SERVICE_STOP, stopData)
  } catch (err) {
    this.emit('error', err)
  }
}

async function _serviceOptionsUpdate ({ id, newOptions }) {
  try {
    let { node } = _private.get(this)
    let routerOptions = node.getOptions()
    let services = routerOptions.services
    services[id] = newOptions
    node.setOptions(routerOptions)
  } catch (err) {
    this.logger.error('Error while handling service options update:', err)
  }
}

function _routerTickMessageHandler ({type, id, event, data, filter} = {}, head) {
  // here this is zeronode instance
  try {
    // TODO :: some higher level checking if there is service with that filter

    let { node } = _private.get(this)
    switch (type) {
      case MessageTypes.BROADCAST:
        node.tickAll({ event, data: { head: { id: head.id }, data }, filter })
        break
      case MessageTypes.EMIT_ANY:
        let nodeId = this::_findWinnerNode(filter)
        node.tick({ to: nodeId, event, data: { head: { id: head.id }, data } })
        break
      case MessageTypes.EMIT_TO:
        node.tick({ to: id, event, data: { head: { id: head.id }, data } })
        break
      case MessageTypes.PUBLISH:
        let serviceNode = node.getClientInfo({ id: head.id })
        node.tickAll({ event, data, filter: publishPredicateBuilder(event, serviceNode.options.service) })
    }
  } catch (err) {
    this.logger.error(`error while handling service message:`, err)
  }
}

async function _routerRequestMessageHandler (request) {
  try {
    let { node } = _private.get(this)
    let {body, reply, head } = request
    let {type, id, event, data, timeout, filter} = body
    let serviceResponse
        // TODO :: some higher level checking if there is service with that filter
    switch (type) {
      case MessageTypes.EMIT_ANY:
        let nodeId = this::_findWinnerNode(filter)
        serviceResponse = await node.request({ to: nodeId, event, data: { head: { id: head.id }, data }, timeout })
        break
      case MessageTypes.EMIT_TO:
        serviceResponse = await node.request({ to: id, event, data: { head: { id: head.id }, data }, timeout })
        break
    }
    reply(serviceResponse)
  } catch (err) {
    request.next(err)
    // this.logger.error(`error while handling request message: ${err}`)
  }
}

function _defineLoadBalancingStrategyHandler (request) {
  try {
    let { body, reply } = request
    this.defineLoadBalancingStrategy(body)
    reply()
  } catch (err) {
    request.next(err.message)
  }
}

function _findWinnerNode (filter) {
  let nodesFilter = {}
  let { node, strategy } = _private.get(this)

  if (_.isFunction(filter)) {
    nodesFilter.predicate = filter
  } else {
    nodesFilter.options = filter || {}
  }
  let filteredNodes = node.getFilteredNodes(nodesFilter)

  let strategyType = strategy.all

  if (typeof nodesFilter.options.service === 'string') {
    strategyType = strategy[nodesFilter.options.service] || strategyType
  }

  switch (strategyType.strategy) {
    case LoadBalancingStrategies.LATENCY_OPTIMIZED:
      return this::_latencyOptimized(filteredNodes)
    case LoadBalancingStrategies.CPU_OPTIMIZED:
      return this::_cpuOptimized(filteredNodes)
    case LoadBalancingStrategies.VERSION_CUSTOMIZED:
      return this::_versionCustomized(filteredNodes, strategyType.options)
    default:
      return this::_roundRobin(filteredNodes)
  }

}

function _latencyOptimized (nodes) {
  let { node } = _private.get(this)

  let nodeInformations = _.map(nodes, (nodeId) => {
    let { total } = node.metric.getMetrics({ node: nodeId, request: true , out: true })
    total.node = nodeId
    return total
  })

  nodeInformations.sort((a, b) => {
    return a.latency - b.latency
  })

  return nodeInformations[0].node
}

function _roundRobin (nodes) {
  let len = nodes.length
  let idx = Math.floor(Math.random() * len)
  return nodes[idx]
}

function _versionCustomized (nodes, versionInfo) {
  let { node } = _private.get(this)

  nodes = _.map(nodes, (nodeId) => node.getClientInfo({ id: nodeId }))

  let groupedByVersion = _.map(versionInfo, () =>  [])
  groupedByVersion.push([])

  let groupedByVersion2 = _.groupBy(nodes, (node) => {
    let idx = versionInfo.length
    _.find(versionInfo, ({version}, version_i) => {
      if (semver.satisfies(node.options.version, version)) {
        idx = version_i
        return true
      }
    })
    return idx
  })
  _.each(groupedByVersion2, (nodes, index) => {
    groupedByVersion[index] = nodes
  })

  let winnerGroup = randomWithProbablilities(groupedByVersion, _.map(versionInfo, ({prob}) => prob))

  return _roundRobin(winnerGroup).id
}

function _cpuOptimized (nodes) {
  //TODO: implement later
  // now returning round robin
  return _roundRobin(nodes)
}

